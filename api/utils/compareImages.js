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

// ⚡ URLs de clusters en Cloudinary (todas las partes subidas)
const clusterURLs = [
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190347/clusters/productos_part0.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190347/clusters/productos_part1.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190348/clusters/productos_part2.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190349/clusters/productos_part3.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190349/clusters/productos_part4.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190350/clusters/productos_part5.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190351/clusters/productos_part6.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190352/clusters/productos_part7.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190353/clusters/productos_part8.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190354/clusters/productos_part9.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190355/clusters/productos_part10.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190356/clusters/productos_part11.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190357/clusters/productos_part12.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190358/clusters/productos_part13.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190358/clusters/productos_part14.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190359/clusters/productos_part15.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190360/clusters/productos_part16.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190361/clusters/productos_part17.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190362/clusters/productos_part18.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190363/clusters/productos_part19.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190363/clusters/productos_part20.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190364/clusters/productos_part21.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190366/clusters/productos_part22.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190367/clusters/productos_part23.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190367/clusters/productos_part24.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190368/clusters/productos_part25.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190369/clusters/productos_part26.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190369/clusters/productos_part27.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190371/clusters/productos_part28.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190371/clusters/productos_part29.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190372/clusters/productos_part30.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190373/clusters/productos_part31.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190374/clusters/productos_part32.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190374/clusters/productos_part33.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190375/clusters/productos_part34.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190376/clusters/productos_part35.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190377/clusters/productos_part36.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190378/clusters/productos_part37.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190378/clusters/productos_part38.json",
    "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772190379/clusters/productos_part39.json"
  ];

// ⚡ Cargar productos desde clusters en línea
async function cargarProductos() {
  let productos = [];
  for (const url of clusterURLs) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      productos = productos.concat(data);
      console.log(`✅ Cargado cluster desde ${url} con ${data.length} items`);
    } catch (err) {
      console.warn(`⚠️ Error cargando cluster desde ${url}:`, err);
    }
  }
  console.log("📌 Total productos cargados:", productos.length);
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
      precio: r.precio || "",      // si lo tenés en productos.json
      proveedor: r.proveedor || "",// si lo tenés en productos.json
      url: r.url || "",            // URL del producto
      score: Number(r.score.toFixed(4)),
    }));
        
  } catch (err) {
    console.error("🔥 Error en buscarImagenSimilar:", err);
    return [];
  }
}