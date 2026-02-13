import fs from "fs";
import path from "path";
import Fuse from "fuse.js";

// Ruta a productos.json
const productosPath = path.join(process.cwd(), "productos.json");
const productos = JSON.parse(fs.readFileSync(productosPath, "utf-8"));

// --- Convierte precio a número ---
function parsePrecio(precioStr) {
  if (!precioStr) return null;
  const only = precioStr.replace(/[^\d,.\-]/g, "").replace(/\.(?=\d{3,})/g, "").replace(",", ".");
  const n = parseFloat(only);
  return isFinite(n) ? n : null;
}

// --- Palabras comunes a ignorar ---
const stopwords = new Set([
  "de","en","para","con","y","el","la","los","las","un","una","unos","unas"
]);

// --- Normalizaciones simples ---
const normalizaciones = {
  "ojotigre": "ojo de tigre",
  "taroot": "tarot"
};

// --- Normalizar palabra ---
function normalizar(word) {
  word = word.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (normalizaciones[word]) return normalizaciones[word];
  if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
  return word;
}

// --- Boost por palabras importantes ---
function calcularBoost(palabrasQuery, titulo) {
  const tituloNorm = titulo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let boost = 0;

  palabrasQuery.forEach((w, i) => {
    if (tituloNorm.includes(w)) boost += 10;          // palabra presente
    if (tituloNorm.indexOf(w) === tituloNorm.indexOf(palabrasQuery[i])) boost += 5; // mismo orden
    if (i === palabrasQuery.length - 1 && tituloNorm.includes(w)) boost += 3;      // última palabra
  });

  return boost;
}

// --- Index Fuse.js para coincidencias difusas ---
const fuse = new Fuse(productos, {
  keys: ["titulo"],
  threshold: 0.4,
  ignoreLocation: true,
  minMatchCharLength: 2
});

// --- Handler principal ---
export default function handler(req, res) {
  const query = (req.query.q || "").trim();
  const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
  const proveedorQ = req.query.proveedor
    ? String(req.query.proveedor).split(",").map(s => s.trim()).filter(Boolean)
    : [];
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const perPage = Math.min(100, Math.max(5, parseInt(req.query.perPage || "24", 10)));

  let results = productos.map(p => ({ ...p, precioNum: parsePrecio(p.precio) }));

  // --- FILTRO POR PROVEEDOR ---
  if (proveedorQ.length) {
    results = results.filter(p => proveedorQ.includes(p.proveedor));
  }

  // --- FILTRO POR PRECIO ---
  results = results.filter(p =>
    !(minPrice !== null && (p.precioNum === null || p.precioNum < minPrice)) &&
    !(maxPrice !== null && (p.precioNum === null || p.precioNum > maxPrice))
  );

  if (query) {
    const palabrasQuery = query.split(/\s+/)
      .map(normalizar)
      .filter(w => w && !stopwords.has(w));

    // --- Coincidencias exactas (todas las palabras presentes) ---
    let exactMatches = results.filter(p =>
      palabrasQuery.every(w => p.titulo.toLowerCase().includes(w))
    ).map(p => ({ ...p, score: 100 + calcularBoost(palabrasQuery, p.titulo) }));

    // --- Búsqueda difusa para el resto ---
    let fuzzyResults = fuse.search(palabrasQuery.join(" "))
      .map(r => ({ ...r.item, score: r.score ? 50 + 1 / r.score : 50 }))
      .filter(r => !exactMatches.some(em => em.titulo === r.titulo));

    results = [...exactMatches, ...fuzzyResults];
  } else {
    results = results.map(p => ({ ...p, score: 0 }));
  }

  // --- Orden final: stock primero, luego score ---
  results.sort((a, b) => {
    if (a.stock && !b.stock) return -1;
    if (!a.stock && b.stock) return 1;
    return (b.score || 0) - (a.score || 0);
  });

  const total = results.length;
  const start = (page - 1) * perPage;
  const end = start + perPage;

  res.status(200).json({
    total,
    page,
    perPage,
    results: results.slice(start, end)
  });
}
