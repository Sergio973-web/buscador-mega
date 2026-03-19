import express from "express";
import fs from "fs";
import cors from "cors";
import "dotenv/config";
import fileUpload from "express-fileupload";
import OpenAI from "openai";
import Database from "better-sqlite3";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "./tmp",
  })
);

// ===============================
// OPENAI
// ===============================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===============================
// SQLITE (singleton)
// ===============================
const db = new Database("embeddings.db");

console.log("🗄️ Conectando SQLite...");

// ===============================
// CACHE EN MEMORIA (CRÍTICO)
// ===============================
let PRODUCTS_CACHE = [];

function loadProducts() {
  console.log("📦 Cargando embeddings desde SQLite...");

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
}

// cargar 1 vez al inicio
loadProducts();

// ===============================
// COSENO
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

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ===============================
// SEARCH POR IMAGEN
// ===============================
app.post("/api/buscarPorImagen", async (req, res) => {
  try {
    console.log("\n===============================");
    console.log("📥 REQUEST IMAGEN");
    console.log("===============================");

    if (!req.files?.imagen) {
      return res.status(400).json({ error: "No se recibió imagen" });
    }

    const file = req.files.imagen;

    const buffer = fs.readFileSync(file.tempFilePath);
    const base64 = buffer.toString("base64");
    const imageUrl = `data:image/jpeg;base64,${base64}`;

    console.log("🔎 Vision AI...");

    // ===============================
    // 1. VISION
    // ===============================
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

    const descripcion = (vision.output_text || "").trim();

    if (!descripcion) {
      return res.json({ ok: false, resultados: [] });
    }

    console.log("🧠 Query:", descripcion);

    // ===============================
    // 2. EMBEDDING QUERY
    // ===============================
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: descripcion,
    });

    const queryEmbedding = emb.data[0].embedding;

    // ===============================
    // 3. SEARCH
    // ===============================
    const resultados = [];

    for (let i = 0; i < PRODUCTS_CACHE.length; i++) {
      const p = PRODUCTS_CACHE[i];

      if (!p.embedding) continue;

      const score = cosineSimilarity(queryEmbedding, p.embedding);

      // threshold ajustable
      if (score < 0.15) continue;

      resultados.push({
        ...p,
        score,
      });

      if (i % 2000 === 0) {
        console.log(`⏳ procesados ${i}/${PRODUCTS_CACHE.length}`);
      }
    }

    // ===============================
    // 4. RANKING
    // ===============================
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

    console.log("🏆 TOP listo");

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
// STATUS
// ===============================
app.get("/api/status", (req, res) => {
  const count = db.prepare("SELECT COUNT(*) as c FROM embeddings").get();

  res.json({
    estado: "ok",
    embeddings: count.c,
    cache: PRODUCTS_CACHE.length,
  });
});

// ===============================
// RELOAD CACHE (IMPORTANTE)
// ===============================
app.get("/api/reload", (req, res) => {
  loadProducts();
  res.json({ ok: true, reloaded: PRODUCTS_CACHE.length });
});

// ===============================
// START
// ===============================
app.listen(PORT, () => {
  console.log("🚀 Servidor activo");
  console.log(`📡 http://localhost:${PORT}`);
});