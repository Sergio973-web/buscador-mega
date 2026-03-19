import fs from "fs";
import Database from "better-sqlite3";

const filePath = "./embeddings/embeddings.json";

// ======================================================
// 1. INIT DB (PRODUCTION MODE)
// ======================================================
const db = new Database("embeddings.db");

console.log("🗄️ Inicializando SQLite PRO...");

// 🔥 optimización real SQLite
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("temp_store = MEMORY");
db.pragma("cache_size = -200000"); // ~200MB cache si hay RAM

// ======================================================
// 2. SCHEMA COMPLETO (NO FALTA NADA)
// ======================================================
db.exec(`
CREATE TABLE IF NOT EXISTS embeddings (
  url TEXT PRIMARY KEY,

  titulo TEXT,
  titulo_original TEXT,
  descripcion TEXT,

  imagen TEXT,
  imagenCloud TEXT,

  precio TEXT,
  categoria TEXT,
  proveedor TEXT,

  embedding TEXT
);

CREATE INDEX IF NOT EXISTS idx_titulo ON embeddings(titulo);
CREATE INDEX IF NOT EXISTS idx_categoria ON embeddings(categoria);
CREATE INDEX IF NOT EXISTS idx_proveedor ON embeddings(proveedor);
`);

console.log("✅ Schema + índices listos");

// ======================================================
// 3. PREPARED STATEMENT
// ======================================================
const insert = db.prepare(`
  INSERT OR REPLACE INTO embeddings (
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
// 4. TRANSACTION BATCH (CLAVE DE PERFORMANCE)
// ======================================================
const insertBatch = db.transaction((items) => {
  for (const p of items) {
    if (!p?.url) continue;

    insert.run(
      p.url || "",
      p.titulo || "",
      p.titulo_original || "",
      p.descripcion || "",
      p.imagen || "",
      p.imagenCloud || "",
      p.precio || "",
      p.categoria || "",
      p.proveedor || "",
      JSON.stringify(p.embedding || [])
    );
  }
});

// ======================================================
// 5. STREAM READER (MEMORY SAFE)
// ======================================================
const stream = fs.createReadStream(filePath, {
  encoding: "utf8",
  highWaterMark: 1024 * 1024
});

let buffer = "";
let batch = [];
let count = 0;

function flush() {
  if (batch.length === 0) return;

  insertBatch(batch);
  count += batch.length;

  console.log(`⏳ migrados: ${count}`);
  batch = [];
}

// ======================================================
// 6. PARSER ROBUSTO
// ======================================================
stream.on("data", (chunk) => {
  buffer += chunk;

  let start = buffer.indexOf("{");

  while (start !== -1) {
    let end = buffer.indexOf("}", start + 1);

    if (end === -1) break;

    const raw = buffer.slice(start, end + 1);

    try {
      const obj = JSON.parse(raw);
      batch.push(obj);

      // batch control (performance sweet spot)
      if (batch.length >= 500) {
        flush();
      }

      buffer = buffer.slice(end + 1);
      start = buffer.indexOf("{");
    } catch {
      start = buffer.indexOf("{", start + 1);
    }
  }
});

// ======================================================
// 7. FINISH
// ======================================================
stream.on("end", () => {
  flush();

  console.log("\n================================");
  console.log("🚀 MIGRACIÓN FINALIZADA");
  console.log("📦 TOTAL:", count);
  console.log("🧠 SQLite listo para buscador semántico");
  console.log("================================\n");
});