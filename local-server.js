import express from "express";
import fs from "fs";
import cors from "cors";
import "dotenv/config";
import fileUpload from "express-fileupload";
import OpenAI from "openai";
import Database from "better-sqlite3";

const app = express();
const PORT = process.env.PORT || 3001;

// ===============================
// MIDDLEWARE
// ===============================
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "1000mb", extended: true }));

app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp",
    createParentPath: true,
    limits: { fileSize: 5 * 1024 * 1024 },
    abortOnLimit: true,
  })
);

// ===============================
// ERROR LOGGING
// ===============================
process.on("uncaughtException", (err) => {
  console.error("💥 uncaughtException:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("💥 unhandledRejection:", reason);
});

// ===============================
// OPENAI
// ===============================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===============================
// DB INIT
// ===============================
let db = null;
const DB_PATH = process.env.DB_PATH || "/data/embeddings.db";

// ===============================
// COPY DB TO VOLUME (SAFE)
// ===============================
const LOCAL_DB = "./embeddings.db";
const VOLUME_DB = "/data/embeddings.db";

try {
  console.log("🔍 Verificando DB...");

  const localExists = fs.existsSync(LOCAL_DB);
  const volumeExists = fs.existsSync(VOLUME_DB);

  console.log("📁 LOCAL_DB existe:", localExists);
  console.log("📁 VOLUME_DB existe:", volumeExists);

  if (!volumeExists && localExists) {
    console.log("📥 Copiando DB inicial al volumen...");
    fs.copyFileSync(LOCAL_DB, VOLUME_DB);
    console.log("✅ DB copiada correctamente");
  } else if (volumeExists) {
    console.log("ℹ️ DB ya existe en volumen");
  } else {
    console.log("❌ No hay DB disponible");
  }
} catch (err) {
  console.error("❌ Error copiando DB:", err.message);
}

// ===============================
// INIT DB
// ===============================
function initDB() {
  try {
    console.log("🗄️ Conectando SQLite...");

    db = new Database(DB_PATH);

    db.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        url TEXT PRIMARY KEY,
        titulo TEXT,
        imagenCloud TEXT,
        precio TEXT,
        categoria TEXT,
        proveedor TEXT,
        embedding TEXT
      );
    `);

    console.log("✅ SQLite conectado");
  } catch (err) {
    console.error("❌ SQLite error:", err.message);
    db = null;
  }
}

// ===============================
// STARTUP
// ===============================
initDB();

// ===============================
// COSINE
// ===============================
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ===============================
// STATUS (SIN CACHE)
// ===============================
app.get("/api/status", (req, res) => {
  let count = 0;

  try {
    const row = db.prepare("SELECT COUNT(*) as c FROM embeddings").get();
    count = row?.c || 0;
  } catch (e) {
    console.log("status error:", e.message);
  }

  res.json({
    db: db ? "ok" : "null",
    total: count,
  });
});

// ===============================
// UPLOAD DB
// ===============================
app.post("/api/upload-db", async (req, res) => {
  try {
    if (!req.files || !req.files.db) {
      return res.status(400).json({ error: "No DB file" });
    }

    const file = req.files.db;
    await file.mv(DB_PATH);

    db = new Database(DB_PATH);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// SEARCH IMAGE (OPTIMIZADO SIN CACHE)
// ===============================
app.post("/api/buscarPorImagen", async (req, res) => {
  try {
    if (!req.files?.imagen) {
      return res.status(400).json({ error: "No imagen" });
    }

    const file = req.files.imagen;
    const buffer = fs.readFileSync(file.tempFilePath);

    try {
      fs.unlinkSync(file.tempFilePath);
    } catch {}

    const base64 = buffer.toString("base64");

    const vision = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Describe este producto" },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${base64}`,
            },
          ],
        },
      ],
    });

    const descripcion = (vision.output_text || "").trim();

    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: descripcion,
    });

    const queryEmbedding = emb.data[0].embedding;

    const results = [];

    const stmt = db.prepare("SELECT * FROM embeddings LIMIT 200");

    const MAX_RESULTS = 10;
    const MIN_SCORE = 0.15;
    
    for (const row of stmt.iterate()) {

      if (!row.embedding) continue;

      let embedding;
      try {
        embedding = JSON.parse(row.embedding);
      } catch {
        continue;
      }

      if (!Array.isArray(embedding)) continue;
      if (embedding.length !== queryEmbedding.length) continue;

      const score = cosineSimilarity(queryEmbedding, embedding);

      if (score < MIN_SCORE) continue;

      results.push({
        url: row.url,
        titulo: row.titulo,
        descripcion: row.descripcion,
        imagen: row.imagenCloud || row.imagen || null,
        precio: row.precio,
        categoria: row.categoria,
        proveedor: row.proveedor,
        score,
      });

      // 🔥 corte inmediato (CRÍTICO)
      if (results.length >= MAX_RESULTS) break;

      // 🔥 protección de memoria
      if (process.memoryUsage().heapUsed > 300 * 1024 * 1024) {
        console.log("⚠️ memory safe stop");
        break;
      }
    }


    res.json({
      ok: true,
      descripcion,
      total: results.length,
      resultados: results.slice(0, 10),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// ROOT
// ===============================
app.get("/", (req, res) => {
  res.send("API funcionando 🚀");
});

// ===============================
// DELETE DB
// ===============================
app.get("/api/delete-db", (req, res) => {
  try {
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
      return res.json({ ok: true });
    }
    res.json({ ok: false });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// ===============================
// START SERVER
// ===============================
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running");
  console.log("📡 PORT:", PORT);
});