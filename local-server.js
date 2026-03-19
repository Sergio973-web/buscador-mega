import express from "express";
import fs from "fs";
import cors from "cors";
import "dotenv/config";
import fileUpload from "express-fileupload";
import OpenAI from "openai";
import Database from "better-sqlite3";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "./tmp",
    createParentPath: true,
  })
);

// ===============================
// OPENAI
// ===============================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===============================
// SQLITE SAFE INIT
// ===============================
let db = null;

function initDB() {
  try {
    console.log("🗄️ Conectando SQLite...");

    db = new Database("/data/embeddings.db");

    db.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id INTEGER PRIMARY KEY,
        url TEXT,
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

    console.log("✅ SQLite listo");
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
      console.log("⚠️ DB no disponible, cache vacío");
      PRODUCTS_CACHE = [];
      return;
    }

    console.log("📦 Cargando embeddings...");

    const rows = db.prepare("SELECT * FROM embeddings").all();

    PRODUCTS_CACHE = rows.map((r) => ({
      url: r.url,
      titulo: r.titulo,
      titulo_original: r.titulo_original,
      descripcion: r.descripcion,
      imagen: r.imagenCloud || r.imagen || null,
      precio: r.precio || null,
      categoria: r.categoria || null,
      proveedor: r.proveedor || null,
      embedding: r.embedding ? JSON.parse(r.embedding) : null,
    }));

    console.log(`✅ Productos en memoria: ${PRODUCTS_CACHE.length}`);
  } catch (err) {
    console.error("❌ loadProducts error:", err.message);
    PRODUCTS_CACHE = [];
  }
}

// ===============================
// INIT STARTUP
// ===============================
initDB();
loadProducts();

// ===============================
// COSINE SIMILARITY
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
// SEARCH IMAGE
// ===============================
app.post("/api/buscarPorImagen", async (req, res) => {
  try {
    if (!req.files?.imagen) {
      return res.status(400).json({ error: "No se recibió imagen" });
    }

    const file = req.files.imagen;
    const buffer = fs.readFileSync(file.tempFilePath);
    fs.unlinkSync(file.tempFilePath);

    const base64 = buffer.toString("base64");
    const imageUrl = `data:image/jpeg;base64,${base64}`;

    let descripcion = "";

    try {
      const vision = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Describe este producto con precisión: tipo, material, uso.",
              },
              {
                type: "input_image",
                image_url: imageUrl,
              },
            ],
          },
        ],
      });

      descripcion = (vision.output_text || "").trim();
    } catch (e) {
      console.error("❌ Vision error:", e.message);
      return res.status(500).json({ error: "Vision failed" });
    }

    if (!descripcion) {
      return res.json({ ok: false, resultados: [] });
    }

    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: descripcion,
    });

    const queryEmbedding = emb.data[0].embedding;

    const resultados = [];

    for (let i = 0; i < PRODUCTS_CACHE.length; i++) {
      const p = PRODUCTS_CACHE[i];

      if (!p.embedding) continue;

      const score = cosineSimilarity(queryEmbedding, p.embedding);

      if (score < 0.15) continue;

      resultados.push({ ...p, score });
    }

    resultados.sort((a, b) => b.score - a.score);

    const top = resultados.slice(0, 10).map((r) => ({
      titulo: r.titulo,
      descripcion: r.descripcion,
      imagen: r.imagen,
      precio: r.precio,
      proveedor: r.proveedor,
      url: r.url,
      score: Number(r.score.toFixed(4)),
    }));

    res.json({
      ok: true,
      descripcion,
      total: top.length,
      resultados: top,
    });

  } catch (err) {
    console.error("🔥 ERROR:", err.message);

    res.status(500).json({
      error: "Error procesando imagen",
      detalle: err.message,
    });
  }
});

// ===============================
// STATUS SAFE
// ===============================
app.get("/api/status", (req, res) => {
  try {
    if (!db) {
      return res.json({
        estado: "warning",
        embeddings: 0,
        cache: PRODUCTS_CACHE.length,
        db: "no disponible",
      });
    }

    const count = db.prepare("SELECT COUNT(*) as c FROM embeddings").get();

    res.json({
      estado: "ok",
      embeddings: count.c,
      cache: PRODUCTS_CACHE.length,
    });

  } catch (err) {
    res.json({
      estado: "error",
      error: err.message,
    });
  }
});

// ===============================
// RELOAD CACHE
// ===============================
app.get("/api/reload", (req, res) => {
  loadProducts();
  res.json({ ok: true, reloaded: PRODUCTS_CACHE.length });
});

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => {
  console.log("🚀 Servidor activo");
  console.log(`📡 Puerto: ${PORT}`);
});