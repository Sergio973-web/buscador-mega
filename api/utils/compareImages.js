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
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021804/clusters/pvxfinp1zgjpzarsymkd.json", // cluster_0_part0
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021801/clusters/u0gnbofhuhm281oluiis.json", // cluster_0_part1
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021802/clusters/n42zsyc15qytewnpwpv9.json", // cluster_0_part2
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021803/clusters/soe5hwdmjgc2dimndprg.json", // cluster_1_part0
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021806/clusters/obn90uyqnftxazp2qkws.json", // cluster_1_part1
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021800/clusters/rqlkzct474pp57b8r4g3.json", // cluster_1_part2
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021805/clusters/xzogtkx3wtugjqukmgk2.json", // cluster_2_part0
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021803/clusters/bs7c4sl3h53h1yjmjbmt.json", // cluster_2_part1
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021800/clusters/tuiemaqa7ekhvowtapa1.json", // cluster_2_part2
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021803/clusters/pbf72uexnepfxahbwprv.json", // cluster_3_part0
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021804/clusters/dzhaxiuhpnak1lsxlwhk.json", // cluster_3_part1
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021798/clusters/fyjeyrdxpmmvnwnynwz2.json", // cluster_3_part3
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021801/clusters/oihtoj5oszjt3umisj1y.json", // cluster_4_part0
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021804/clusters/hrjpy2jlgqhvguvrxt9k.json", // cluster_4_part1
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021799/clusters/ykkhjfnb6j3alwugls9h.json", // cluster_4_part2
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021803/clusters/dx3csc3wnfhunnlrvupy.json", // cluster_5_part0
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021802/clusters/z6dzprhrwpchnsjaygsh.json", // cluster_5_part2
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021802/clusters/bltclgsxbyo1ybuwjbso.json", // cluster_5_part4
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021803/clusters/yblcvon3w7xpfjbgjnl0.json", // cluster_5_part5
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021802/clusters/zsbxnropgsf2vrcjvcug.json", // cluster_5_part1
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021805/clusters/lbiqvzepcnjj8iobkvz2.json", // cluster_7_part5
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021804/clusters/zekmlpadx4llfpndr7kz.json", // cluster_7_part1
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021808/clusters/o8gszvn3jqkm0mpxxifw.json", // cluster_7_part0
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021804/clusters/cqynezcakxb5mxa5cbou.json", // cluster_7_part2
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021804/clusters/nyaclzkxdvog1osy986e.json", // cluster_7_part4
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021802/clusters/p72fqlaq4j8pvlod3dhu.json", // cluster_7_part3
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021805/clusters/m6jzhmq1qwlxzkemnld2.json", // cluster_9_part0
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021805/clusters/sumnkakc8ufgvemtmemw.json", // cluster_9_part1
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021798/clusters/npmsk0nbxkv12fn0ei3r.json", // cluster_8_part3
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021804/clusters/t0zoxfbr3gdjw7fitwpp.json", // cluster_8_part2
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021804/clusters/lmdzkno0ayee4fhtk8qa.json", // cluster_8_part1
  "https://res.cloudinary.com/dagvhiryj/raw/upload/v1772021804/clusters/zrrpuhppzswmmcyy1z0l.json", // cluster_8_part0
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
      score: Number(r.score.toFixed(4)),
    }));

  } catch (err) {
    console.error("🔥 Error en buscarImagenSimilar:", err);
    return [];
  }
}