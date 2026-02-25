// api/utils/compareImages.js
import OpenAI from "openai";
import fetch from "node-fetch"; // Node 18+ ya tiene fetch global, sino instalar node-fetch

// ⚡ Inicializar OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ⚡ Cosine similarity
function cosineSimilarity(a, b) {
  if (!a || !b) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ⚡ URLs de clusters en GitHub
const clusterURLs = [
  "https://raw.githubusercontent.com/Sergio973-web/buscador-mega/main/embeddings/cluster_0.json",
  "https://raw.githubusercontent.com/Sergio973-web/buscador-mega/main/embeddings/cluster_1.json",
  "https://raw.githubusercontent.com/Sergio973-web/buscador-mega/main/embeddings/cluster_2.json",
  "https://raw.githubusercontent.com/Sergio973-web/buscador-mega/main/embeddings/cluster_3.json",
  "https://raw.githubusercontent.com/Sergio973-web/buscador-mega/main/embeddings/cluster_4.json",
  "https://raw.githubusercontent.com/Sergio973-web/buscador-mega/main/embeddings/cluster_5.json",
  "https://raw.githubusercontent.com/Sergio973-web/buscador-mega/main/embeddings/cluster_6.json",
  "https://raw.githubusercontent.com/Sergio973-web/buscador-mega/main/embeddings/cluster_7.json",
  "https://raw.githubusercontent.com/Sergio973-web/buscador-mega/main/embeddings/cluster_8.json",
  "https://raw.githubusercontent.com/Sergio973-web/buscador-mega/main/embeddings/cluster_9.json",
];

// ⚡ Cargar productos desde clusters en línea
async function cargarProductos() {
  let productos = [];
  for (const url of clusterURLs) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      productos = productos.concat(data);
    } catch (err) {
      console.error(`⚠️ Error cargando cluster desde ${url}:`, err);
    }
  }

  console.log("✅ Productos cargados desde clusters en línea:", productos.length);
  if (productos.length > 0) {
    console.log("📌 Primer producto cargado:", {
      titulo: productos[0].titulo,
      tieneEmbedding: !!productos[0].embedding,
      embeddingLength: productos[0].embedding?.length || 0
    });
  } else {
    console.warn("⚠️ No se cargaron productos desde los clusters.");
  }

  return productos;
}

// ⚡ Función principal
export async function buscarImagenSimilar(imageUrl) {
  console.log("📌 Iniciando búsqueda de imagen:", imageUrl);

  try {
    // 1️⃣ Generar descripción de la imagen
    const vision = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Describe este producto de forma breve y comercial, indicando tipo, material y uso.",
            },
            { type: "input_image", image_url: imageUrl },
          ],
        },
      ],
    });

    const descripcion = vision.output_text?.trim();
    if (!descripcion) return [];

    // 2️⃣ Generar embedding de la descripción
    const embRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: descripcion,
    });
    const queryEmbedding = embRes.data?.[0]?.embedding;
    if (!queryEmbedding) return [];

    // 3️⃣ Cargar productos desde clusters en línea
    const productos = await cargarProductos();
    if (!productos || productos.length === 0) return [];

    // 4️⃣ Calcular similitud
    const resultados = productos.map((prod) => ({
      ...prod,
      score: prod.embedding ? cosineSimilarity(queryEmbedding, prod.embedding) : 0,
    }));

    resultados.sort((a, b) => b.score - a.score);

    // 5️⃣ Devolver top 10
    return resultados.slice(0, 10).map((r) => ({
      titulo: r.titulo,
      descripcion: r.descripcion,
      imagen: r.imagen,
      score: Number(r.score.toFixed(4)),
    }));

  } catch (err) {
    console.error("🔥 Error en buscarImagenSimilar:", err);
    return [];
  }
}