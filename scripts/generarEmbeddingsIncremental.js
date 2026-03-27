import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import OpenAI from "openai";
import { fileURLToPath } from "url";

// ======================================================
// PATHS
// ======================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, "../productos.json");
const dbPath = path.join(__dirname, "../embeddings.db");

// ======================================================
// SQLITE INIT
// ======================================================
const db = new Database(dbPath);

console.log("🗄️ Conectando SQLite...");

// optimización básica
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("temp_store = MEMORY");

// ======================================================
// SCHEMA OPTIMIZADO (LIVIANO)
// ======================================================
db.exec(`
CREATE TABLE IF NOT EXISTS embeddings (
  url TEXT PRIMARY KEY,
  titulo TEXT,
  imagenCloud TEXT,
  precio TEXT,
  categoria TEXT,
  proveedor TEXT,
  embedding TEXT
);
`);

console.log("✅ Schema optimizado listo");

// ======================================================
// OPENAI
// ======================================================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ======================================================
// QUERIES
// ======================================================
const existe = db.prepare(`
  SELECT 1 FROM embeddings WHERE url = ?
`);

const insert = db.prepare(`
  INSERT INTO embeddings (
    url,
    titulo,
    imagenCloud,
    precio,
    categoria,
    proveedor,
    embedding
  )
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// ======================================================
// LOAD DATA
// ======================================================
const productos = JSON.parse(fs.readFileSync(filePath, "utf8"));

console.log("📦 Productos totales:", productos.length);

// ======================================================
// CONFIG
// ======================================================
const MAX = Infinity;
const MAX_DB_SIZE = 480 * 1024 * 1024; // 480MB límite seguro

let count = 0;
let skipped = 0;

// ======================================================
// MAIN LOOP
// ======================================================
for (const p of productos) {
  if (!p?.url) continue;

  // ya existe → skip
  if (existe.get(p.url)) {
    skipped++;
    continue;
  }

  const img = p.imagenCloud || p.imagen;

  if (!img?.startsWith("http")) {
    skipped++;
    continue;
  }

  try {
    // =========================
    // VISION (DESCRIPCIÓN)
    // =========================
    const vision = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Describe este producto de forma breve, comercial y precisa."
            },
            {
              type: "input_image",
              image_url: img
            }
          ]
        }
      ]
    });

    const descripcion = vision.output_text?.trim();

    if (!descripcion) {
      skipped++;
      continue;
    }

    // =========================
    // EMBEDDING
    // =========================
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: descripcion
    });

    const vector = JSON.stringify(emb.data[0].embedding);

    // =========================
    // INSERT OPTIMIZADO
    // =========================
    insert.run(
      p.url,
      p.titulo || "",
      p.imagenCloud || "",
      p.precio || "",
      p.categoria || "",
      p.proveedor || "",
      vector
    );

    count++;

    console.log(`✅ [${count}] ${p.titulo}`);

    // =========================
    // CORTE POR TAMAÑO (CRÍTICO)
    // =========================
    const size = fs.statSync(dbPath).size;

    if (size >= MAX_DB_SIZE) {
      console.log("🛑 DB alcanzó límite de 480MB, corte seguro");
      break;
    }

    // =========================
    // THROTTLE (anti rate limit)
    // =========================
    await new Promise(r => setTimeout(r, 150));

    if (count >= MAX) break;

  } catch (err) {
    console.error("❌ error en:", p.url);
    console.error(err.message);
  }
}

// ======================================================
// SUMMARY
// ======================================================
console.log("\n================================");
console.log("🎉 EMBEDDINGS COMPLETADOS");
console.log("✔ nuevos:", count);
console.log("⏭ ignorados:", skipped);
console.log("📦 total productos:", productos.length);
console.log("================================\n");