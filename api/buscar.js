import fs from "fs";
import path from "path";

// ✅ Resolver ruta correctamente en Vercel
const __dirname = new URL(".", import.meta.url).pathname;
const productosPath = path.join(__dirname, "../../productos.json");

// ✅ Cargar JSON de forma segura
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

  // --- BÚSQUEDA EXACTA ---
  if (q) {
    const palabrasBuscadas = q
      .split(/\s+/)
      .map(normalizarPalabra)
      .filter(Boolean);

    results = results.filter(p => {
      const texto = `${p.titulo} ${p.proveedor}`.toLowerCase();
      const palabrasTitulo = texto
        .split(/[^a-z0-9áéíóúñ]+/i)
        .map(normalizarPalabra)
        .filter(Boolean);

      return palabrasBuscadas.every(busq =>
        palabrasTitulo.some(word => word === busq)
      );
    });
  }

  // --- ORDENAMIENTO ---
  if (sort === "price_asc") results.sort((a, b) => (a.precioNum || 0) - (b.precioNum || 0));
  else if (sort === "price_desc") results.sort((a, b) => (b.precioNum || 0) - (a.precioNum || 0));

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
