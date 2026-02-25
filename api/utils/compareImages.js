// utils/compareImages.js
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { cosineSimilarity } from "./cosine.js"; // o define la función inline
import { getImageEmbedding } from "./getImageEmbedding.js"; // para generar embedding de la imagen
import { loadCluster } from "./loadCluster.js"; // nuevo, carga clusters JSON

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ⚡ buscar imagen similar
export async function buscarImagenSimilar(imageUrl) {
  console.log("📌 Iniciando búsqueda de imagen:", imageUrl);

  try {
    // 1️⃣ embedding de la imagen (ya no description + embedding)
    const queryEmbedding = await getImageEmbedding(imageUrl);
    console.log("✅ Embedding generado, longitud:", queryEmbedding?.length || 0);

    if (!queryEmbedding) return [];

    // 2️⃣ elegir clusters a buscar (por ahora 0, luego top centroides)
    const CLUSTER_ID = 0;
    const productos = loadCluster(CLUSTER_ID);
    console.log("📊 Productos cargados del cluster:", productos.length);

    // 3️⃣ comparar embedding
    const resultados = productos
      .map((prod, i) => {
        if (!prod.embedding) {
          console.warn(`⚠️ Producto ${i} (${prod.titulo || "sin título"}) sin embedding`);
          return { ...prod, score: 0 };
        }
        return { ...prod, score: cosineSimilarity(queryEmbedding, prod.embedding) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 24); // top 24 para el buscador

    console.log("✅ Resultados calculados:", resultados.length);

    // 4️⃣ map a formato para frontend
    return resultados.map((r) => ({
      titulo: r.titulo,
      descripcion: r.descripcion || "",
      imagen: r.imagenCloud || r.imagen || "",
      url: r.url || "",
      score: Number(r.score.toFixed(4)),
    }));
  } catch (err) {
    console.error("🔥 Error en buscarImagenSimilar:", err);
    return [];
  }
}