import fs from "fs";
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

// Límite por ejecución (para no sobrecargar)
const MAX_POR_EJECUCION = 10_000;

// Cargar JSON
function cargarJSON(path, fallback = []) {
  if (!fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

// Verificar si es una URL de imagen válida
function imagenValida(url) {
  return typeof url === "string" && url.startsWith("http");
}

async function generarEmbeddingsIncremental() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

  const productos = cargarJSON(INPUT_FILE);
  const existentes = cargarJSON(OUTPUT_FILE);

  const procesados = new Set(existentes.map(p => p.id ?? p.titulo));

  console.log(`📦 Productos totales: ${productos.length}`);
  console.log(`♻️ Ya procesados: ${procesados.size}`);

  let procesadosAhora = 0;

  for (const prod of productos) {
    const key = prod.id ?? prod.titulo;

    if (procesados.has(key)) continue;

    const imgUrl = prod.imagenCloud || prod.imagen;
    if (!imagenValida(imgUrl)) {
      console.warn(`⚠️ Imagen inválida: ${prod.titulo}`);
      continue;
    }

    try {
      // 1️⃣ Generar descripción de la imagen
      const vision = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Describe este producto de forma breve y comercial, indicando tipo, material y uso." },
              { type: "input_image", image_url: imgUrl }
            ]
          }
        ]
      });

      const descripcion = vision.output_text?.trim();
      if (!descripcion) throw new Error("Descripción vacía");

      // 2️⃣ Generar embedding del texto
      const embRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: descripcion
      });

      const nuevo = {
        ...prod,
        descripcion,
        embedding: embRes.data[0].embedding
      };

      existentes.push(nuevo);
      procesados.add(key);
      procesadosAhora++;

      // Guardar progreso incremental
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existentes, null, 2));

      console.log(`✅ OK: ${prod.titulo} (${procesadosAhora})`);

      if (procesadosAhora >= MAX_POR_EJECUCION) {
        console.log("🛑 Límite por ejecución alcanzado");
        break;
      }

    } catch (err) {
      console.error(`❌ Error en ${prod.titulo}:`, err.message);

      // Guardar aunque falle para no repetir
      existentes.push({
        ...prod,
        descripcion: null,
        embedding: null,
        error: "imagen_no_accesible"
      });
      procesados.add(key);

      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existentes, null, 2));
    }
  }

  console.log("🎉 Proceso finalizado");
  console.log(`➕ Nuevos embeddings: ${procesadosAhora}`);
  console.log(`📁 Total acumulado: ${existentes.length}`);
}

// Ejecutar
generarEmbeddingsIncremental();