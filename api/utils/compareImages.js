// utils/compareImages.js
import fs from "fs";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// cargar embeddings una sola vez
const productos = JSON.parse(
  fs.readFileSync("./productos_embeddings.json", "utf8")
);

// cosine similarity
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

  // 2️⃣ embedding de la imagen (vía texto)
  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: descripcion,
  });

  const queryEmbedding = embRes.data[0].embedding;

  // 3️⃣ comparar contra catálogo
  const resultados = productos
    .map((prod) => ({
      ...prod,
      score: cosineSimilarity(queryEmbedding, prod.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // 4️⃣ devolver resultados
  return resultados.map((r) => ({
    titulo: r.titulo,
    descripcion: r.descripcion,
    imagen: r.imagen,
    score: Number(r.score.toFixed(4)),
  }));
}
