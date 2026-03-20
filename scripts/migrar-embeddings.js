import fs from "fs";
import Database from "better-sqlite3";

const filePath = "./embeddings/embeddings.json";

// límite 480MB (margen de seguridad)
const MAX_DB_SIZE = 480 * 1024 * 1024;

const db = new Database("embeddings.db");

db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("temp_store = MEMORY");

// ===============================
// SCHEMA OPTIMIZADO
// ===============================
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

const insert = db.prepare(`
  INSERT OR REPLACE INTO embeddings (
    url, titulo, imagenCloud, precio, categoria, proveedor, embedding
  )
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertBatch = db.transaction((items) => {
  for (const p of items) {
    insert.run(
      p.url || "",
      p.titulo || "",
      p.imagenCloud || "",
      p.precio || "",
      p.categoria || "",
      p.proveedor || "",
      JSON.stringify(p.embedding || [])
    );
  }
});

// ===============================
// STREAM
// ===============================
const stream = fs.createReadStream(filePath, {
  encoding: "utf8",
  highWaterMark: 1024 * 1024
});

let buffer = "";
let batch = [];
let count = 0;
let stopped = false;

function getDBSize() {
  try {
    return fs.statSync("embeddings.db").size;
  } catch {
    return 0;
  }
}

function flush() {
  if (batch.length === 0 || stopped) return;

  insertBatch(batch);
  count += batch.length;

  const size = getDBSize();

  console.log(`⏳ migrados: ${count} | DB: ${(size / 1024 / 1024).toFixed(2)} MB`);

  // 🚨 corte automático
  if (size >= MAX_DB_SIZE) {
    console.log("🛑 LIMITE ALCANZADO, DETENIENDO...");
    stopped = true;
    stream.destroy();
  }

  batch = [];
}

// ===============================
// PARSER
// ===============================
stream.on("data", (chunk) => {
  if (stopped) return;

  buffer += chunk;

  let start = buffer.indexOf("{");

  while (start !== -1) {
    let end = buffer.indexOf("}", start + 1);
    if (end === -1) break;

    const raw = buffer.slice(start, end + 1);

    try {
      const obj = JSON.parse(raw);
      batch.push(obj);

      if (batch.length >= 500) flush();

      buffer = buffer.slice(end + 1);
      start = buffer.indexOf("{");
    } catch {
      start = buffer.indexOf("{", start + 1);
    }
  }
});

// ===============================
// FIN
// ===============================
stream.on("end", () => {
  flush();

  console.log("\n================================");
  console.log("🚀 DB OPTIMIZADA LISTA");
  console.log("📦 TOTAL:", count);
  console.log("================================\n");
});