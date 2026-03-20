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
    limits: { fileSize: 1000 * 1024 * 1024 }, // 1000MB
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

    const stats = fs.statSync(LOCAL_DB);
    console.log("📦 Tamaño DB local:", stats.size);

    fs.copyFileSync(LOCAL_DB, VOLUME_DB);

    console.log("✅ DB copiada correctamente");
  } else if (volumeExists) {
    console.log("ℹ️ DB ya existe en volumen");
  } else {
    console.log("❌ No hay DB disponible en ningún lado");
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
    console.log("📦 DB Path:", DB_PATH);

    const exists = fs.existsSync(DB_PATH);
    console.log("📦 DB EXISTS:", exists);

    if (exists) {
      const size = fs.statSync(DB_PATH).size;
      console.log("📦 DB SIZE (bytes):", size);
    }

    db = new Database(DB_PATH);

    db.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        url TEXT PRIMARY KEY,
        titulo TEXT,
        titulo_original TEXT,
        descripcion TEXT,
        imagen TEXT,
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
// CACHE
// ===============================
let PRODUCTS_CACHE = [];

function loadProducts() {
  try {
    if (!db) {
      console.log("⚠️ DB no disponible");
      PRODUCTS_CACHE = [];
      return;
    }

    console.log("📦 Cargando embeddings...");

    const countCheck = db
      .prepare("SELECT COUNT(*) as c FROM embeddings")
      .get();

    console.log("🔢 TOTAL EN DB:", countCheck.c);

    const rows = db.prepare("SELECT * FROM embeddings").all();

    console.log("📊 ROWS FETCHED:", rows.length);

    PRODUCTS_CACHE = rows.map((r) => ({
      url: r.url,
      titulo: r.titulo,
      descripcion: r.descripcion,
      imagen: r.imagenCloud || r.imagen || null,
      precio: r.precio,
      categoria: r.categoria,
      proveedor: r.proveedor,
      embedding: r.embedding ? JSON.parse(r.embedding) : null,
    }));

    console.log(`✅ Productos en memoria: ${PRODUCTS_CACHE.length}`);
  } catch (err) {
    console.error("❌ loadProducts error:", err.message);
    PRODUCTS_CACHE = [];
  }
}

// ===============================
// STARTUP
// ===============================
initDB();

// cargar en background (NO bloquea el arranque)
setTimeout(() => {
  console.log("⏳ Cargando productos en background...");
  loadProducts();
}, 2000);
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
// UPLOAD DB (🔥 CLAVE)
// ===============================
app.post("/api/upload-db", async (req, res) => {
  try {
    console.log("📥 Upload DB iniciado");

    if (!req.files || !req.files.db) {
      console.log("❌ No se recibió archivo");
      return res.status(400).json({ error: "No DB file" });
    }

    const file = req.files.db;

    console.log("📦 Nombre:", file.name);
    console.log("📦 Tamaño:", file.size);

    const targetPath = DB_PATH;

    console.log("💾 Guardando en:", targetPath);

    await file.mv(targetPath);

    console.log("✅ DB subida correctamente");

    // 🔄 recargar DB
    db = new Database(DB_PATH);
    loadProducts();

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// API SEARCH IMAGE
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

    const vision = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Describe este producto" },
            { type: "input_image", image_url: `data:image/jpeg;base64,${base64}` },
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

    for (const p of PRODUCTS_CACHE) {
      if (!p.embedding) continue;

      const score = cosineSimilarity(queryEmbedding, p.embedding);
      if (score < 0.15) continue;

      results.push({ ...p, score });
    }

    results.sort((a, b) => b.score - a.score);

    res.json({
      ok: true,
      descripcion,
      total: results.length,
      resultados: results.slice(0, 10),
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
  res.json({
    cache: PRODUCTS_CACHE.length,
    db: db ? "ok" : "null",
  });
});

// ===============================
// RELOAD
// ===============================
app.get("/api/reload", (req, res) => {
  loadProducts();
  res.json({ ok: true, cache: PRODUCTS_CACHE.length });
});

app.get("/", (req, res) => {
  res.send("API funcionando 🚀");
});

app.get("/api/delete-db", (req, res) => {
  try {
    const path = "/data/embeddings.db";
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
      return res.json({ ok: true, deleted: true });
    }
    res.json({ ok: true, deleted: false });
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