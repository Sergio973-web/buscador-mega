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
// INIT DB
// ===============================
function initDB() {
  try {
    console.log("🗄️ Conectando SQLite...");
    console.log("📦 DB Path:", DB_PATH);

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

initDB();

// ===============================
// COSINE
// ===============================
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ===============================
// SEARCH CONFIG
// ===============================
const THRESHOLD = 0.04;   // 🔥 más resultados sin mucho ruido
const MAX_RESULTS = 100;   // límite seguro
const YIELD_EVERY = 800;  // evita freeze
const MAX_SCAN = 6000;

// ===============================
// SEARCH IMAGE (FINAL)
// ===============================
app.post("/api/buscarPorImagen", async (req, res) => {
  try {
    console.log("📥 Request recibida");

    if (!req.files?.imagen) {
      return res.status(400).json({ error: "No imagen" });
    }

    const file = req.files.imagen;
    const buffer = fs.readFileSync(file.tempFilePath);
    fs.unlinkSync(file.tempFilePath);

    const base64 = buffer.toString("base64");

    // ===============================
    // VISION
    // ===============================
    const vision = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Describe este producto de forma detallada para ecommerce (tipo, uso, categoría, estilo)",
            },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${base64}`,
            },
          ],
        },
      ],
    });

    const descripcion = (vision.output_text || "").trim();
    console.log("🧠 Descripción:", descripcion);

    // ===============================
    // EMBEDDING
    // ===============================
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: `Producto ecommerce: ${descripcion}`,
    });

    const queryEmbedding = emb.data[0].embedding;

    // ===============================
    // SEARCH DB (STREAM SAFE)
    // ===============================
    const stmt = db.prepare("SELECT * FROM embeddings");

    const results = [];
    let processed = 0;

    for (const row of stmt.iterate()) {
      processed++;

      if (!row.embedding) continue;

      let embedding;
      try {
        embedding = JSON.parse(row.embedding);
      } catch {
        continue;
      }

      if (embedding.length !== queryEmbedding.length) continue;

      const score = cosineSimilarity(queryEmbedding, embedding);

      if (score < THRESHOLD) continue;

      results.push({
        url: row.url,
        titulo: row.titulo,
        imagen: row.imagenCloud || null,
        precio: row.precio,
        categoria: row.categoria,
        proveedor: row.proveedor,
        score,
      });

      // 🔥 corte temprano
      if (processed >= MAX_SCAN) break;

      if (results.length >= MAX_RESULTS && processed > 4000) break;
      
      // 🔥 liberar event loop
      if (processed % YIELD_EVERY === 0) {
        await new Promise((r) => setImmediate(r));
      }
    }

    results.sort((a, b) => b.score - a.score);

    console.log("📊 RESULTADOS:", results.length);

    res.json({
      ok: true,
      descripcion,
      total: results.length,
      resultados: results,
    });

  } catch (err) {
    console.error("🔥 ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// STATUS
// ===============================
app.get("/api/status", (req, res) => {
  try {
    const row = db.prepare("SELECT COUNT(*) as c FROM embeddings").get();
    res.json({ db: "ok", total: row.c });
  } catch (err) {
    res.json({ db: "error", error: err.message });
  }
});

// ===============================
// ROOT
// ===============================
app.get("/", (req, res) => {
  res.send("API funcionando 🚀");
});

// ===============================
// START SERVER
// ===============================
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running");
  console.log("📡 PORT:", PORT);
});