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

async function cargarProductos() {
  if (productosCache) return productosCache;

  try {
    console.log("📌 Leyendo archivo local de embeddings:", FILE_PATH);
    const data = fs.readFileSync(FILE_PATH, "utf8");
    productosCache = JSON.parse(data);
    console.log("✅ Productos embeddings cargados desde archivo local");
    console.log("📊 Total productos cargados:", productosCache.length);
    return productosCache;
  } catch (err) {
    console.error("❌ Error cargando productos desde archivo local:", err);
    throw err;
  }
}

// cosine similarity
function cosineSimilarity(a, b) {
  if (!a || !b) return 0; // prevenir arrays vacíos
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
  try {
    console.log("📌 Procesando imagen:", imageUrl);

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

    console.log("✅ Descripción generada por OpenAI");
    const descripcion = vision.output_text?.trim();
    console.log("📝 Descripción:", descripcion);

    if (!descripcion) {
      throw new Error("La descripción de OpenAI está vacía");
    }

    // 2️⃣ embedding de la descripción
    const embRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: descripcion,
    });

    const queryEmbedding = embRes.data?.[0]?.embedding;
    if (!queryEmbedding) {
      throw new Error("No se generó embedding para la descripción");
    }
    console.log("✅ Embedding generado, longitud:", queryEmbedding.length);

    // 3️⃣ obtener catálogo desde archivo local
    const productos = await cargarProductos();

    if (!productos || productos.length === 0) {
      throw new Error("No hay productos cargados en productos_embeddings.json");
    }

    // 4️⃣ comparar contra catálogo
    const resultados = productos
      .map((prod, i) => {
        if (!prod.embedding) {
          console.warn(`⚠️ Producto ${i} no tiene embedding`);
          return { ...prod, score: 0 };
        }
        return { ...prod, score: cosineSimilarity(queryEmbedding, prod.embedding) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // 5️⃣ devolver resultados
    console.log("✅ Resultados calculados:", resultados.length);
    return resultados.map((r) => ({
      titulo: r.titulo,
      descripcion: r.descripcion,
      imagen: r.imagen,
      score: Number(r.score.toFixed(4)),
    }));
  } catch (err) {
    console.error("🔥 Error en buscarImagenSimilar:", err);
    throw err; // esto hará que tu endpoint también registre el error
  }
}