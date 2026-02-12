import fs from "fs";
import path from "path";
import Fuse from "fuse.js";

// ✅ Esto SIEMPRE apunta a la raíz real del proyecto en Vercel
const productosPath = path.join(process.cwd(), "productos.json");

// ✅ Carga segura del JSON
const productos = JSON.parse(
  fs.readFileSync(productosPath, "utf-8")
);

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

// --- Normalizaciones y singular/plural simplificado ---
const normalizaciones = {
  "aroos": "aros",
  "runass": "runas",
  "taroot": "tarot",
  "tigre": "tigre",
  "ojotigre": "ojo de tigre"
};

function normalizarPalabra(word) {
  word = word.toLowerCase().trim();

  if (normalizaciones[word]) return normalizaciones[word];

  if (
    word.endsWith("s") &&
    word.length > 3 &&
    !/[aeiou]ros$/.test(word) &&
    !/[aeiou]dos$/.test(word) &&
    !/[aeiou]nos$/.test(word)
  ) {
    return word.slice(0, -1);
  }

  return word;
}

// --- Palabras comunes a ignorar ---
const stopwords = new Set([
  "de","en","para","con","y","el","la","los","las","un","una","unos","unas"
]);

// --- Handler principal ---
export default function handler(req, res) {
  let q = (req.query.q || "").trim();
  const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
  const proveedorQ = req.query.proveedor
    ? String(req.query.proveedor).split(",").map(s => s.trim()).filter(Boolean)
    : [];
  const sort = req.query.sort || "relevance";
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const perPage = Math.min(100, Math.max(5, parseInt(req.query.perPage || "24", 10)));

  let results = productos;

  // --- FILTRO POR PROVEEDOR ---
  if (proveedorQ.length > 0) {
    results = results.filter(p => proveedorQ.includes(p.proveedor));
  }

  // --- FILTRO POR PRECIO ---
  results = results
    .map(p => ({ ...p, precioNum: parsePrecio(p.precio) }))
    .filter(
      p =>
        !(minPrice !== null && (p.precioNum === null || p.precioNum < minPrice)) &&
        !(maxPrice !== null && (p.precioNum === null || p.precioNum > maxPrice))
    );

  // --- BÚSQUEDA DIFUSA con Fuse.js ---
  if (q) {
    // Filtrar stopwords y normalizar
    const palabrasBuscadas = q
      .split(/\s+/)
      .map(normalizarPalabra)
      .filter(word => word && !stopwords.has(word))
      .join(" "); // Fuse puede usar string completo

    const fuse = new Fuse(results, {
      keys: ["titulo", "proveedor"], // campos a buscar
      includeScore: true,
      threshold: 0.4, // 0 exacto, 1 muy flexible
      ignoreLocation: true,
      minMatchCharLength: 2
    });

    const fuseResults = fuse.search(palabrasBuscadas);

    // Fuse devuelve { item, score }, score bajo = mejor
    results = fuseResults.map(r => ({
      ...r.item,
      score: r.score ? 1 / r.score : 100 // convertir score para que más alto = mejor
    }));
  } else {
    results = results.map(p => ({ ...p, score: 0 }));
  }

  // --- ORDENAMIENTO ---
  if (sort === "price_asc") results.sort((a, b) => (a.precioNum || 0) - (b.precioNum || 0));
  else if (sort === "price_desc") results.sort((a, b) => (b.precioNum || 0) - (a.precioNum || 0));
  else results.sort((a, b) => (b.score || 0) - (a.score || 0)); // por relevancia

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
