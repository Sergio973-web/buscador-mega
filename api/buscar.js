import fs from "fs";
import path from "path";
import Fuse from "fuse.js";

// Ruta a productos.json
const productosPath = path.join(process.cwd(), "productos.json");
const productos = JSON.parse(fs.readFileSync(productosPath, "utf-8"));

// --- Convierte precio a número ---
function parsePrecio(precioStr) {
  if (!precioStr) return null;
  const only = precioStr
    .replace(/[^\d,.\-]/g, "")
    .replace(/\.(?=\d{3,})/g, "")
    .replace(",", ".");
  const n = parseFloat(only);
  return isFinite(n) ? n : null;
}

// --- Normalizaciones simples ---
const normalizaciones = {
  "ojotigre": "ojo de tigre",
  "taroot": "tarot"
};

// --- Generar sinónimos automáticos ---
function generarSinonimos(productos) {
  const sinonimos = {};
  productos.forEach(p => {
    const palabras = p.titulo.toLowerCase().split(/\s+/);
    palabras.forEach(word => {
      const clean = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!clean || clean.length < 2) return;
      if (clean.endsWith("s") && clean.length > 3) sinonimos[clean.slice(0, -1)] = clean;
      else sinonimos[clean + "s"] = clean;
      if (clean.length > 5) sinonimos[clean.slice(0, 4)] = clean;
    });
  });
  return sinonimos;
}
const sinonimos = generarSinonimos(productos);

// --- Palabras comunes a ignorar ---
const stopwords = new Set([
  "de","en","para","con","y","el","la","los","las","un","una","unos","unas"
]);

// --- Indexar Fuse.js una sola vez ---
const fuseIndex = new Fuse(productos, {
  keys: ["titulo", "proveedor"],
  includeScore: true,
  threshold: 0.4,
  ignoreLocation: true,
  minMatchCharLength: 2
});

// --- Normalizar palabra ---
function normalizarPalabra(word) {
  word = word.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (sinonimos[word]) return sinonimos[word];
  if (normalizaciones[word]) return normalizaciones[word];
  if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
  return word;
}

// --- Handler principal ---
export default function handler(req, res) {
  let q = (req.query.q || "").trim();
  const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
  const proveedorQ = req.query.proveedor
    ? String(req.query.proveedor).split(",").map(s => s.trim()).filter(Boolean)
    : [];
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const perPage = Math.min(100, Math.max(5, parseInt(req.query.perPage || "24", 10)));

  let results = productos.map(p => ({ ...p, precioNum: parsePrecio(p.precio) }));

  // --- FILTRO POR PROVEEDOR ---
  if (proveedorQ.length > 0) {
    results = results.filter(p => proveedorQ.includes(p.proveedor));
  }

  // --- FILTRO POR PRECIO ---
  results = results.filter(p =>
    !(minPrice !== null && (p.precioNum === null || p.precioNum < minPrice)) &&
    !(maxPrice !== null && (p.precioNum === null || p.precioNum > maxPrice))
  );

  if (q) {
    const palabrasBuscadas = q
      .split(/\s+/)
      .map(normalizarPalabra)
      .filter(word => word && !stopwords.has(word));

    // --- Coincidencias exactas (todas las palabras) ---
    let exactMatches = results.filter(p =>
      palabrasBuscadas.every(w => p.titulo.toLowerCase().includes(w))
    ).map(p => ({ ...p, score: 100 }));

    // --- Búsqueda difusa para el resto ---
    let fuseResults = fuseIndex.search(palabrasBuscadas.join(" "));
    fuseResults = fuseResults
      .map(r => ({ ...r.item, precioNum: parsePrecio(r.item.precio), score: r.score ? 1 / r.score : 0 }))
      .filter(r => !exactMatches.some(em => em.titulo === r.titulo)); // evitar duplicados

    results = [...exactMatches, ...fuseResults];
  } else {
    results = results.map(p => ({ ...p, score: 0 }));
  }

  // --- ORDENAMIENTO: primero stock, luego score ---
  results.sort((a, b) => {
    if (a.stock && !b.stock) return -1;
    if (!a.stock && b.stock) return 1;
    return (b.score || 0) - (a.score || 0);
  });

  // --- PAGINACIÓN ---
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
