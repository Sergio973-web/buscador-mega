import productos from "../productos.json";
import Fuse from "fuse.js";

// Convierte precio a número
function parsePrecio(precioStr) {
  if (!precioStr) return null;
  const only = precioStr.replace(/[^\d,.\-]/g, "").replace(/\.(?=\d{3,})/g, "").replace(",", ".");
  const n = parseFloat(only);
  return isFinite(n) ? n : null;
}

export default function handler(req, res) {
  const q = (req.query.q || "").trim();
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

  // Buscar texto
  if (q) {
    // Crear Fuse con opciones estrictas
    const fuse = new Fuse(results, { 
        keys: ["titulo", "proveedor"], 
        threshold: 0.1,       // coincidencias estrictas, pero aún permite variantes pequeñas
        ignoreLocation: true, 
        includeScore: true    // para poder filtrar por score
    });

    // Buscar
    let searchResults = fuse.search(q, { limit: 1000 });

    // Filtrar resultados muy poco relevantes
    results = searchResults
        .filter(r => r.score <= 0.15)   // solo resultados con score menor a 0.15
        .map(r => ({ ...r.item, score: r.score }));

    if (sort === "price_asc") results.sort((a, b) => (a.precioNum || 0) - (b.precioNum || 0));
    else if (sort === "price_desc") results.sort((a, b) => (b.precioNum || 0) - (a.precioNum || 0));
    else results.sort((a, b) => (a.score - b.score));
  } else {
    if (sort === "price_asc") results.sort((a, b) => (a.precioNum || 0) - (b.precioNum || 0));
    else if (sort === "price_desc") results.sort((a, b) => (b.precioNum || 0) - (a.precioNum || 0));
  }

  const total = results.length;
  const start = (page - 1) * perPage;
  const end = start + perPage;

  res.status(200).json({ total, page, perPage, results: results.slice(start, end) });
}
