// api/utils/compareImages.js

import fs from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Ruta de embeddings local
const EMBEDDINGS_PATH = path.join(process.cwd(), "embeddings", "embeddings.json");

// Cache en memoria (runtime)
let productosCache = null;


// ===============================
// Cargar embeddings locales
// ===============================

async function cargarProductos() {

  if (productosCache) {
    return productosCache;
  }

  if (!fs.existsSync(EMBEDDINGS_PATH)) {
    console.error("❌ No se encontró embeddings.json local");
    return [];
  }

  try {

    console.log("⚡ Cargando embeddings locales...");

    const raw = fs.readFileSync(EMBEDDINGS_PATH, "utf8");

    productosCache = JSON.parse(raw);

    console.log("✅ Productos cargados:", productosCache.length);

    return productosCache;

  } catch (err) {

    console.error("🔥 Error leyendo embeddings:", err);

    return [];

  }

}


// ===============================
// Similitud coseno
// ===============================

function cosineSimilarity(a, b) {

  if (!a || !b || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {

    dot += a[i] * b[i];

    normA += a[i] * a[i];

    normB += b[i] * b[i];

  }

  if (!normA || !normB) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));

}


// ===============================
// Función principal
// ===============================

export async function buscarImagenSimilar(imageUrl) {

  console.log("🔎 Buscando similitud para imagen:", imageUrl);

  try {

    // =====================================
    // 1️⃣ Generar descripción de la imagen
    // =====================================

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

    if (!descripcion) {

      console.warn("⚠️ No se generó descripción de la imagen");

      return [];

    }

    console.log("🧠 Descripción generada:", descripcion);


    // =====================================
    // 2️⃣ Generar embedding de la descripción
    // =====================================

    const embRes = await openai.embeddings.create({

      model: "text-embedding-3-small",

      input: descripcion

    });

    const queryEmbedding = embRes?.data?.[0]?.embedding;

    if (!queryEmbedding) {

      console.warn("⚠️ No se pudo generar embedding");

      return [];

    }


    // =====================================
    // 3️⃣ Cargar productos locales
    // =====================================

    const productos = await cargarProductos();

    if (!productos.length) {

      console.warn("⚠️ No hay productos para comparar");

      return [];

    }


    // =====================================
    // 4️⃣ Calcular similitud
    // =====================================

    const resultados = productos.map(prod => {

      let score = 0;

      if (prod.embedding) {
        score = cosineSimilarity(queryEmbedding, prod.embedding);
      }

      return {
        ...prod,
        score
      };

    });


    // Ordenar por score
    resultados.sort((a, b) => b.score - a.score);


    // =====================================
    // 5️⃣ Devolver TOP resultados
    // =====================================

    const top = resultados.slice(0, 10).map(r => ({

      titulo: r.titulo || "",
      descripcion: r.descripcion || "",
      imagen: r.imagen || r.imagenCloud || "",
      precio: r.precio || "",
      proveedor: r.proveedor || "",
      url: r.url || "",
      score: Number(r.score.toFixed(4))

    }));


    console.log("🏆 Resultados encontrados:", top.length);

    return top;


  } catch (err) {

    console.error("🔥 Error en buscarImagenSimilar:", err);

    return [];

  }

}
