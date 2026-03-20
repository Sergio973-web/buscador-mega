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
app.use(express.json({ limit: "10mb" }));

app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp",
    createParentPath: true,
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

function initDB() {
  try {
    console.log("🗄️ Conectando SQLite...");

    const dbPath = process.env.DB_PATH || "/data/embeddings.db";
    console.log("📦 DB Path:", dbPath);

    // 🔥 DEBUG FILE SYSTEM
    console.log("📦 DB EXISTS:", fs.existsSync(dbPath));

    if (fs.existsSync(dbPath)) {
      const size = fs.statSync(dbPath).size;
      console.log("📦 DB SIZE (bytes):", size);
    }

    db = new Database(dbPath);

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
loadProducts();

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
    const imageUrl = `data:image/jpeg;base64,${base64}`;

    console.log("🤖 Vision...");

    const vision = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Describe este producto",
            },
            {
              type: "input_image",
              image_url: imageUrl,
            },
          ],
        },
      ],
    });

    const descripcion = (vision.output_text || "").trim();

    console.log("🧠 Descripción:", descripcion);

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

    console.log("📊 RESULTADOS:", results.length);

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

// ===============================
// START SERVER
// ===============================
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running");
  console.log("📡 PORT:", PORT);
});