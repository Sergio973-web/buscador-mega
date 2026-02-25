// api/utils/compareImages.js
import fs from "fs";
import path from "path";
import OpenAI from "openai";

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

// ⚡ Cargar productos desde los clusters
async function cargarProductos() {
  const clusterFolder = path.join(process.cwd(), "embeddings");
  const archivos = fs.readdirSync(clusterFolder).filter(f => f.endsWith(".json"));

  let productos = [];
  for (const file of archivos) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(clusterFolder, file), "utf8"));
      productos = productos.concat(data);
    } catch (err) {
      console.warn(`⚠️ Error leyendo cluster ${file}:`, err);
    }
  }

  console.log("✅ Productos cargados desde clusters:", productos.length);

  if (productos.length > 0) {
    // Mostrar solo el primer producto para no llenar los logs
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

    // 3️⃣ Cargar productos desde clusters
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