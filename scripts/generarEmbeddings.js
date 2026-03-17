iimport fs from "fs";
import path from "path";
import OpenAI from "openai";
import { fileURLToPath } from "url";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Fix rutas en Node (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Archivos
const INPUT_FILE = path.join(__dirname, "../productos.json");
const OUTPUT_DIR = path.join(__dirname, "../embeddings");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "embeddings.json");

// Límite por ejecución
const MAX_POR_EJECUCION = 10_000;

// Cargar JSON
function cargarJSON(pathFile, fallback = []) {
  if (!fs.existsSync(pathFile)) return fallback;
  return JSON.parse(fs.readFileSync(pathFile, "utf8"));
}

// Validar imagen
function imagenValida(url) {
  return typeof url === "string" && url.startsWith("http");
}

async function generarEmbeddingsIncremental() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

  const productos = cargarJSON(INPUT_FILE);
  const existentes = cargarJSON(OUTPUT_FILE);

  // 🧠 --- LIMPIAR embeddings que ya no existen ---
  const productosKeys = new Set(productos.map(p => p.url));

  let embeddingsLimpios = existentes.filter(e => productosKeys.has(e.url));

  // 🧠 --- MAP para acceso rápido ---
  const embeddingsMap = new Map();
  embeddingsLimpios.forEach(e => embeddingsMap.set(e.url, e));

  console.log(`📦 Productos actuales: ${productos.length}`);
  console.log(`♻️ Embeddings reutilizables: ${embeddingsMap.size}`);

  let procesadosAhora = 0;

  for (const prod of productos) {
    const key = prod.url;

    if (!key) {
      console.warn(`⚠️ Producto sin URL: ${prod.titulo}`);
      continue;
    }

    // ✅ Ya tiene embedding → reutilizar
    if (embeddingsMap.has(key)) continue;

    const imgUrl = prod.imagenCloud || prod.imagen;

    if (!imagenValida(imgUrl)) {
      console.warn(`⚠️ Imagen inválida: ${prod.titulo}`);
      continue;
    }

    try {
      // 1️⃣ Generar descripción
      const vision = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Describe este producto de forma breve y comercial, indicando tipo, material y uso."
              },
              {
                type: "input_image",
                image_url: imgUrl
              }
            ]
          }
        ]
      });

      const descripcion = vision.output_text?.trim();
      if (!descripcion) throw new Error("Descripción vacía");

      // 2️⃣ Generar embedding
      const embRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: descripcion
      });

      const nuevo = {
        ...prod,
        descripcion,
        embedding: embRes.data[0].embedding
      };

      embeddingsLimpios.push(nuevo);
      embeddingsMap.set(key, nuevo);
      procesadosAhora++;

      // 💾 Guardado incremental
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(embeddingsLimpios, null, 2));

      console.log(`✅ OK: ${prod.titulo} (${procesadosAhora})`);

      if (procesadosAhora >= MAX_POR_EJECUCION) {
        console.log("🛑 Límite por ejecución alcanzado");
        break;
      }

    } catch (err) {
      console.error(`❌ Error en ${prod.titulo}:`, err.message);

      const fallback = {
        ...prod,
        descripcion: null,
        embedding: null,
        error: "imagen_no_accesible"
      };

      embeddingsLimpios.push(fallback);
      embeddingsMap.set(key, fallback);

      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(embeddingsLimpios, null, 2));
    }
  }

  console.log("🎉 Proceso finalizado");
  console.log(`➕ Nuevos embeddings: ${procesadosAhora}`);
  console.log(`📁 Total embeddings: ${embeddingsLimpios.length}`);
}

// Ejecutar
generarEmbeddingsIncremental();