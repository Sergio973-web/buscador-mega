// api/utils/compareImages.js
import OpenAI from "openai";
import fetch from "node-fetch";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==========================
// Cosine similarity
// ==========================
function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ==========================
// Cache en memoria
// ==========================
let productosCache = null;
let cacheTime = 0;
const CACHE_TTL = 1000 * 60 * 30; // 30 minutos

// ==========================
// URL DEL INDEX
// ==========================
const INDEX_URL =
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190380/clusters/index.json";

// ==========================
// Cargar productos desde Cloudinary
// ==========================
async function cargarProductos() {
  const now = Date.now();

  if (productosCache && now - cacheTime < CACHE_TTL) {
    console.log("⚡ Usando cache en memoria");
    return productosCache;
  }

  console.log("🔄 Cache vencido o vacío, recargando clusters...");

  try {
    // 1️⃣ Cargar index.json
    const indexRes = await fetch(INDEX_URL);
    const clusterURLs = await indexRes.json();

    if (!Array.isArray(clusterURLs)) {
      throw new Error("index.json no contiene un array");
    }

    let productos = [];

    // 2️⃣ Cargar cada cluster
    for (const url of clusterURLs) {
      try {
        const res = await fetch(url);
        const data = await res.json();
        productos.push(...data);
        console.log(`✅ Cluster cargado (${data.length}) → ${url}`);
      } catch (err) {
        console.warn("⚠️ Error cargando cluster:", url);
      }
    }

    console.log("📦 Total productos cargados:", productos.length);
    console.log(
      "🧪 Productos con embedding:",
      productos.filter(p => Array.isArray(p.embedding)).length
    );

    productosCache = productos;
    cacheTime = now;
    return productos;

  } catch (err) {
    console.error("🔥 Error cargando clusters:", err);
    return [];
  }
}

// ==========================
// FUNCIÓN PRINCIPAL
// ==========================
export async function buscarImagenSimilar(imageUrl) {
  console.log("📌 Iniciando búsqueda de imagen:", imageUrl);

  try {
    // 1️⃣ Vision
    const vision = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Describe este producto de forma breve y comercial, indicando tipo, material y uso.",
          },
          { type: "input_image", image_url: imageUrl },
        ],
      }],
    });

    const descripcion = vision.output_text?.trim();
    console.log("🖼️ Descripción generada:", descripcion);

    if (!descripcion) return [];

    // 2️⃣ Embedding de la query
    const embRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: descripcion,
    });

    const queryEmbedding = embRes.data?.[0]?.embedding;
    if (!queryEmbedding) return [];

    // 3️⃣ Cargar productos
    const productos = await cargarProductos();
    if (!productos.length) return [];

    // 4️⃣ Similaridad
    const resultados = productos.map(p => ({
      ...p,
      score: p.embedding
        ? cosineSimilarity(queryEmbedding, p.embedding)
        : 0,
    }));

    resultados.sort((a, b) => b.score - a.score);

    console.log(
      "📊 Top 5 scores:",
      resultados.slice(0, 5).map(r => r.score)
    );

    // 5️⃣ Top 10 enriquecido
    return resultados.slice(0, 10).map(r => ({
      titulo: r.titulo,
      descripcion: r.descripcion,
      imagen: r.imagen,
      precio: r.precio || "",
      proveedor: r.proveedor || "",
      url: r.url || "",
      score: Number(r.score.toFixed(4)),
    }));

  } catch (err) {
    console.error("🔥 Error en buscarImagenSimilar:", err);
    return [];
  }
}