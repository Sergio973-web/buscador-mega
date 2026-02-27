// api/utils/compareImages.js
import OpenAI from "openai";
import fetch from "node-fetch";

// 🔑 OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🌐 Index de clusters en Cloudinary
const INDEX_URL =
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190380/clusters/index.json";

// ⏱️ Cache (en ms) → 10 minutos
const CACHE_TTL = 10 * 60 * 1000;

// 🧠 Cache en memoria
let productosCache = null;
let lastCacheTime = 0;

// 📐 Cosine similarity
function cosineSimilarity(a, b) {
  if (!a || !b) return 0;

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

// 📦 Cargar productos (con cache)
async function cargarProductos() {
  const now = Date.now();

  // ✅ Cache válido
  if (productosCache && now - lastCacheTime < CACHE_TTL) {
    console.log("⚡ Usando productos desde cache");
    return productosCache;
  }

  console.log("🔄 Cache vencido o vacío, recargando clusters...");

  try {
    // 1️⃣ Leer index.json
    const indexRes = await fetch(INDEX_URL);
    const clusterURLs = await indexRes.json();

    let productos = [];

    // 2️⃣ Descargar todos los clusters
    for (const url of clusterURLs) {
      const res = await fetch(url);
      const data = await res.json();
      productos.push(...data);
    }

    // 3️⃣ Guardar en cache
    productosCache = productos;
    lastCacheTime = now;

    console.log("📌 Productos cargados en cache:", productos.length);
    return productos;

  } catch (err) {
    console.error("🔥 Error cargando clusters:", err);
    return [];
  }
}

// 🔍 Buscar imagen similar
export async function buscarImagenSimilar(imageUrl) {
  console.log("📌 Iniciando búsqueda de imagen:", imageUrl);

  try {
    // 1️⃣ Describir imagen
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

    const descripcion = vision.output_text?.trim();
    if (!descripcion) return [];

    // 2️⃣ Embedding de la descripción
    const embRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: descripcion,
    });

    const queryEmbedding = embRes.data?.[0]?.embedding;
    if (!queryEmbedding) return [];

    // 3️⃣ Cargar productos (cacheados)
    const productos = await cargarProductos();
    if (!productos.length) return [];

    // 4️⃣ Calcular similitud
    const resultados = productos.map((prod) => ({
      ...prod,
      score: prod.embedding
        ? cosineSimilarity(queryEmbedding, prod.embedding)
        : 0,
    }));

    resultados.sort((a, b) => b.score - a.score);

    // 5️⃣ Top 10 (producto completo)
    return resultados.slice(0, 10).map((r) => ({
      id: r.id,
      titulo: r.titulo,
      descripcion: r.descripcion || "",
      imagen: r.imagen,
      precio: r.precio,
      proveedor: r.proveedor,
      url: r.url,
      fecha_scrapeo: r.fecha_scrapeo,
      score: Number(r.score.toFixed(4)),
    }));

  } catch (err) {
    console.error("🔥 Error en buscarImagenSimilar:", err);
    return [];
  }
}