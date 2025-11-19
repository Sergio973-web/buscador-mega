import productos from "../productos.json";

// Convierte precio a número
function parsePrecio(precioStr) {
  if (!precioStr) return null;
  const only = precioStr.replace(/[^\d,.\-]/g, "").replace(/\.(?=\d{3,})/g, "").replace(",", ".");
  const n = parseFloat(only);
  return isFinite(n) ? n : null;
}

// Mapa de sinónimos o correcciones
const normalizaciones = {
  "aroos": "aros",
  "runass": "runas",
  "taroot": "tarot",
  // agrega las excepciones que quieras
};

function normalizar(query) {
  const q = query.toLowerCase().trim();
  return normalizaciones[q] || q;
}

export default function handler(req, res) {
  let q = (req.query.q || "").trim();
  q = normalizar(q);  // aplicar normalización

  const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
  const proveedorQ = req.query.proveedor ? String(req.query.proveedor).split(",").map(s => s.trim()).filter(Boolean) : [];
  const sort = req.query.sort || "relevance";
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const perPage = Math.min(100, Math.max(5, parseInt(req.query.perPage || "24", 10)));

  let results = productos;

  // Filtrar por proveedor
  if (proveedorQ.length > 0) {
    results = results.filter(p => proveedorQ.includes(p.proveedor));
  }

  // Parsear precios y filtrar
  results = results.map(p => ({ ...p, precioNum: parsePrecio(p.precio) }))
    .filter(p => !(minPrice !== null && (p.precioNum === null || p.precioNum < minPrice)) &&
                 !(maxPrice !== null && (p.precioNum === null || p.precioNum > maxPrice)));

  // --- BÚSQUEDA AVANZADA ---
  if (q) {
    // Normalizar y dividir en palabras
    const palabras = q
      .toLowerCase()
      .split(/\s+/)
      .map(p => normalizaciones[p] || p)  // corregir cada palabra
      .filter(Boolean);

    results = results.filter(p => {
      const texto = `${p.titulo} ${p.proveedor}`.toLowerCase();

      // Cada palabra debe existir en el texto, sin importar el orden
      return palabras.every(palabra => texto.includes(palabra));
    });

    // Ordenamiento
    if (sort === "price_asc") results.sort((a,b)=> (a.precioNum||0)-(b.precioNum||0));
    else if (sort === "price_desc") results.sort((a,b)=> (b.precioNum||0)-(a.precioNum||0));
  }


  const total = results.length;
  const start = (page - 1) * perPage;
  const end = start + perPage;

  res.status(200).json({ total, page, perPage, results: results.slice(start, end) });
}
