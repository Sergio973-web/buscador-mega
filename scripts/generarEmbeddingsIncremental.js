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
    titulo_original,
    descripcion,
    imagen,
    imagenCloud,
    precio,
    categoria,
    proveedor,
    embedding
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    // VISION
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
    // INSERT FULL RECORD
    // =========================
    insert.run(
      p.url,
      p.titulo || "",
      p.titulo_original || "",
      descripcion,
      p.imagen || "",
      p.imagenCloud || "",
      p.precio || "",
      p.categoria || "",
      p.proveedor || "",
      vector
    );

    count++;

    console.log(`✅ [${count}] ${p.titulo}`);

    // opcional throttle (evita rate limit)
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