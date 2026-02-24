// utils/compareImages.js
import fs from "fs";
import path from "path";
import OpenAI from "openai";

// ⚡ Inicializar OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 📌 Ruta local del JSON con embeddings
const FILE_PATH = path.join(process.cwd(), "api/utils/productos_embeddings.json");

// 📌 cache para embeddings (cold start)
let productosCache = null;

async function cargarProductos(limit = 20) {
  if (productosCache) return productosCache.slice(0, limit);

  try {
    console.log("📌 Leyendo archivo local de embeddings:", FILE_PATH);
    const data = fs.readFileSync(FILE_PATH, "utf8");
    productosCache = JSON.parse(data);
    console.log("✅ Productos embeddings cargados desde archivo local");
    console.log("📊 Total productos cargados:", productosCache.length);

    return productosCache.slice(0, limit); // 🔹 limitar para debug
  } catch (err) {
    console.error("❌ Error cargando productos desde archivo local:", err);
    return []; // devolver array vacío para no romper la función
  }
}

// cosine similarity
function cosineSimilarity(a, b) {
  if (!a || !b) return 0; // prevenir arrays vacíos
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// función principal
export async function buscarImagenSimilar(imageUrl) {
  console.log("📌 Iniciando búsqueda de imagen:", imageUrl);

  try {
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

    const descripcion = vision.output_text?.trim();
    console.log("📝 Descripción generada:", descripcion);

    if (!descripcion) {
      console.warn("⚠️ La descripción de OpenAI está vacía");
      return [];
    }

    // 2️⃣ embedding de la descripción
    let queryEmbedding;
    try {
      const embRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: descripcion,
      });
      queryEmbedding = embRes.data?.[0]?.embedding;
      console.log("✅ Embedding generado, longitud:", queryEmbedding?.length || 0);
    } catch (err) {
      console.error("❌ Error generando embedding de OpenAI:", err);
      return [];
    }

    if (!queryEmbedding) {
      console.warn("⚠️ No se generó embedding para la descripción");
      return [];
    }

    // 3️⃣ obtener catálogo desde archivo local
    const productos = await cargarProductos();
    if (!productos || productos.length === 0) {
      console.warn("⚠️ No hay productos cargados para comparar");
      return [];
    }

    // 4️⃣ comparar contra catálogo
    const resultados = productos.map((prod, i) => {
      if (!prod.embedding) {
        console.warn(`⚠️ Producto ${i} (${prod.titulo || "sin título"}) no tiene embedding`);
        return { ...prod, score: 0 };
      }
      return { ...prod, score: cosineSimilarity(queryEmbedding, prod.embedding) };
    });

    resultados.sort((a, b) => b.score - a.score);
    const top10 = resultados.slice(0, 10);

    console.log("✅ Resultados calculados, top 10:", top10.length);

    return top10.map((r) => ({
      titulo: r.titulo,
      descripcion: r.descripcion,
      imagen: r.imagen,
      score: Number(r.score.toFixed(4)),
    }));
  } catch (err) {
    console.error("🔥 Error en buscarImagenSimilar:", err);
    return []; // devolver array vacío para que el endpoint no se caiga
  }
}
