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

function distanciaLevenshtein(a, b) {
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = b[i - 1] === a[j - 1]
        ? m[i - 1][j - 1]
        : 1 + Math.min(m[i - 1][j], m[i][j - 1], m[i - 1][j - 1]);
    }
  }
  return m[b.length][a.length];
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
    const palabrasBuscadas = q
      .toLowerCase()
      .split(/\s+/)
      .map(w => normalizaciones[w] || w)
      .filter(Boolean);

    results = results.filter(p => {
      const texto = `${p.titulo} ${p.proveedor}`.toLowerCase();
      const palabrasTitulo = texto.split(/[^a-z0-9áéíóúñ]+/i); // palabras reales del título

      // Cada palabra buscada debe coincidir con alguna del título
      return palabrasBuscadas.every(busq =>
        palabrasTitulo.some(word =>
          word === busq ||          // coincidencia exacta
          word.startsWith(busq) ||  // palabra comienza igual ("aro" → "aros")
          distanciaLevenshtein(word, busq) <= 1 // permitir errores pequeños
        )
      );
    });

    if (sort === "price_asc") results.sort((a,b)=> (a.precioNum||0)-(b.precioNum||0));
    else if (sort === "price_desc") results.sort((a,b)=> (b.precioNum||0)-(a.precioNum||0));
  }


    // Ordenamiento
    if (sort === "price_asc") results.sort((a,b)=> (a.precioNum||0)-(b.precioNum||0));
    else if (sort === "price_desc") results.sort((a,b)=> (b.precioNum||0)-(a.precioNum||0));
  }


  const total = results.length;
  const start = (page - 1) * perPage;
  const end = start + perPage;

  res.status(200).json({ total, page, perPage, results: results.slice(start, end) });
}
