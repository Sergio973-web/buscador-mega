const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");
const Fuse = require("fuse.js");

const BASES_DIR = path.join(__dirname, "../bases");

// Parse precio a número
function parsePrecio(precioStr) {
  if (!precioStr) return null;
  const only = precioStr.replace(/[^\d,.\-]/g, "").replace(/\.(?=\d{3,})/g, "").replace(",", ".");
  const n = parseFloat(only);
  return isFinite(n) ? n : null;
}

// Cargar todos los productos
function cargarTodosProductos() {
  const archivos = fs.readdirSync(BASES_DIR).filter(f => f.endsWith(".db"));
  let todos = [];

  archivos.forEach(archivo => {
    const ruta = path.join(BASES_DIR, archivo);
    try {
      const db = new sqlite3.Database(ruta, sqlite3.OPEN_READONLY);
      const rows = db.prepare ? db.prepare : null;

      const productos = new Promise(resolve => {
        db.all(`SELECT titulo, url, imagen, precio FROM productos;`, (err, rows) => {
          if (err || !rows) resolve([]);
          else {
            const prov = path.basename(archivo, ".db");
            const mapped = rows.map(r => ({
              titulo: r.titulo || "",
              url: r.url || "",
              imagen: r.imagen || "",
              precio: String(r.precio || "").replace(/\s+/g, " ").trim(),
              proveedor: prov
            }));
            resolve(mapped);
          }
        });
      });

      const deasync = require("deasync");
      let done = false, result = [];
      productos.then(r => { result = r; done = true; });
      while(!done) deasync.sleep(10);

      todos = todos.concat(result);
      db.close();
    } catch (e) { console.warn("No se pudo abrir:", ruta, e.message); }
  });

  return todos;
}

let cacheProductos = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60*1000;

function getProductos(force = false) {
  const now = Date.now();
  if(force || !cacheProductos || (now - cacheTime) > CACHE_TTL_MS){
    cacheProductos = cargarTodosProductos();
    cacheTime = now;
  }
  return cacheProductos;
}

module.exports = (req, res) => {
  const q = (req.query.q || "").trim();
  const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
  const proveedorQ = req.query.proveedor ? String(req.query.proveedor).split(",").map(s=>s.trim()).filter(Boolean) : [];
  const sort = req.query.sort || "relevance";
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const perPage = Math.min(100, Math.max(5, parseInt(req.query.perPage || "24", 10)));
  const refresh = req.query.refresh === "1";

  let productos = getProductos(refresh);

  if(proveedorQ.length>0) productos = productos.filter(p => proveedorQ.includes(p.proveedor));

  productos = productos.map(p => ({ ...p, precioNum: parsePrecio(p.precio) }))
                       .filter(p => !(minPrice!==null && (p.precioNum===null||p.precioNum<minPrice)) &&
                                    !(maxPrice!==null && (p.precioNum===null||p.precioNum>maxPrice)));

  let results = [];
  if(!q){
    results = [...productos];
    if(sort==="price_asc") results.sort((a,b)=> (a.precioNum||0)-(b.precioNum||0));
    else if(sort==="price_desc") results.sort((a,b)=> (b.precioNum||0)-(a.precioNum||0));
  } else {
    const fuse = new Fuse(productos, { keys:["titulo","proveedor"], threshold:0.4, ignoreLocation:true, distance:200 });
    results = fuse.search(q, { limit:1000 }).map(r => ({ ...r.item, score: r.score }));
    if(sort==="price_asc") results.sort((a,b)=> (a.precioNum||0)-(b.precioNum||0));
    else if(sort==="price_desc") results.sort((a,b)=> (b.precioNum||0)-(a.precioNum||0));
    else results.sort((a,b)=> (a.score - b.score));
  }

  const total = results.length;
  const start = (page-1)*perPage;
  const end = start + perPage;
  const pageResults = results.slice(start,end);

  res.json({ total, page, perPage, results: pageResults });
};
