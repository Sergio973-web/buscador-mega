import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import 'dotenv/config';

import fileUpload from "express-fileupload";
import OpenAI from "openai";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Middleware para subir archivos
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: "./tmp"
}));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const EMBEDDINGS_PATH = path.join(process.cwd(), "embeddings", "embeddings.json");

let productos = [];

// ===============================
// Similitud coseno
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
// Cargar embeddings
// ===============================
function cargarEmbeddings() {

  console.log("📦 Cargando embeddings...");

  if (!fs.existsSync(EMBEDDINGS_PATH)) {
    console.error("❌ embeddings.json no encontrado");
    process.exit(1);
  }

  const raw = fs.readFileSync(EMBEDDINGS_PATH, "utf8");
  productos = JSON.parse(raw);

  console.log("✅ Embeddings cargados:", productos.length);
}

// ===============================
// Endpoint búsqueda por imagen
// ===============================
app.post("/api/buscarPorImagen", async (req, res) => {

  try {

    console.log("📥 Request recibida");

    if (!req.files || !req.files.imagen) {
      console.log("⚠️ No se recibió imagen");
      return res.status(400).json({ error: "No se recibió imagen" });
    }

    const file = req.files.imagen;

    console.log("🖼 Imagen recibida:", file.name);

    // leer archivo
    const buffer = fs.readFileSync(file.tempFilePath);

    // convertir a base64
    const base64 = buffer.toString("base64");

    // crear data url
    const imageUrl = `data:image/jpeg;base64,${base64}`;

    console.log("🔎 Analizando imagen base64");

    // 1️⃣ GPT Vision describe el producto
    const vision = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Describe este producto brevemente indicando tipo, material y uso."
          },
          {
            type: "input_image",
            image_url: imageUrl
          }
        ]
      }]
    });

    const descripcion = (vision.output_text || "").trim();

    console.log("🧠 Descripción:", descripcion);

    if (!descripcion) {
      return res.json({ resultados: [] });
    }

    // 2️⃣ Crear embedding
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: descripcion
    });

    const queryEmbedding = emb.data[0].embedding;

    // 3️⃣ Comparar con productos
    const resultados = productos.map(p => ({
      ...p,
      score: p.embedding ? cosineSimilarity(queryEmbedding, p.embedding) : 0
    }));

    resultados.sort((a, b) => b.score - a.score);

    // 4️⃣ Top resultados
    const top = resultados.slice(0, 10).map(r => ({
      titulo: r.titulo,
      descripcion: r.descripcion,
      imagen: r.imagen || r.imagenCloud,
      precio: r.precio,
      proveedor: r.proveedor,
      url: r.url,
      score: Number(r.score.toFixed(4))
    }));

    console.log("🏆 Resultados:", top.length);

    res.json({
      ok: true,
      total: top.length,
      resultados: top
    });

  } catch (err) {

    console.error("🔥 Error:", err);

    res.status(500).json({
      error: "Error procesando imagen",
      detalle: err.message
    });

  }

});

// ===============================
// Endpoints de control
// ===============================

app.get("/ping", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/status", (req, res) => {
  res.json({
    estado: "ok",
    productos: productos.length
  });
});

// ===============================
// Inicio servidor
// ===============================

cargarEmbeddings();

app.listen(PORT, () => {
  console.log("🚀 Servidor local activo");
  console.log(`📡 http://localhost:${PORT}`);
});