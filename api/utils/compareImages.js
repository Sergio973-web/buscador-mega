// utils/compareImages.js
import OpenAI from "openai";
import fetch from "node-fetch"; // para Node.js

// ⚡ Inicializar OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 📌 URL de descarga directa de Google Drive
const DRIVE_URL =
  "https://drive.google.com/uc?export=download&id=1A79aWXoVZDlxbjm21bhFBace8BQ-LqjB";

// 📌 cargar embeddings una sola vez (cold start)
let productosCache = null;

async function cargarProductos() {
  if (productosCache) return productosCache;

  try {
    const res = await fetch(DRIVE_URL);
    if (!res.ok) throw new Error(`Error descargando JSON: ${res.status}`);
    productosCache = await res.json();
    console.log("✅ Productos embeddings cargados desde Google Drive");
    return productosCache;
  } catch (err) {
    console.error("❌ Error cargando productos desde Google Drive:", err);
    throw err;
  }
}

// cosine similarity
function cosineSimilarity(a, b) {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// función principal
export async function buscarImagenSimilar(imageUrl) {
  // 1️⃣ describir la imagen subida
  const vision = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "Describe este producto de forma breve y comercial, indicando tipo, material y uso.",
          },
          {
            type: "input_image",
            image_url: imageUrl,
          },
        ],
      },
    ],
  });

  const descripcion = vision.output_text.trim();

  // 2️⃣ embedding de la descripción
  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: descripcion,
  });

  const queryEmbedding = embRes.data[0].embedding;

  // 3️⃣ obtener catálogo desde Google Drive
  const productos = await cargarProductos();

  // 4️⃣ comparar contra catálogo
  const resultados = productos
    .map((prod) => ({
      ...prod,
      score: cosineSimilarity(queryEmbedding, prod.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // 5️⃣ devolver resultados
  return resultados.map((r) => ({
    titulo: r.titulo,
    descripcion: r.descripcion,
    imagen: r.imagen,
    score: Number(r.score.toFixed(4)),
  }));
}
