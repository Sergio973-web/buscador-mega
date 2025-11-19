// servidor_mega.js
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");
const Fuse = require("fuse.js");
const cors = require("cors");

const app = express();
const PORT = 3000;
const BASES_DIR = path.join(__dirname, "bases");

app.use(cors());
app.use(express.static(__dirname)); // sirve el HTML

// Carga todas las bases (lectura simple, no keep open)
function cargarTodosProductos() {
    const archivos = fs.readdirSync(BASES_DIR).filter(f => f.endsWith(".db"));
    let todos = [];

    archivos.forEach(archivo => {
        const ruta = path.join(BASES_DIR, archivo);
        try {
            const db = new sqlite3.Database(ruta, sqlite3.OPEN_READONLY);
            const rows = db.prepare
                ? db.prepare // just to avoid lint
                : null;

            // Consulta síncrona vía callback convertida a Promise
            const productos = new Promise(resolve => {
                db.all(
                    `SELECT titulo, url, imagen, precio FROM productos;`,
                    (err, rows) => {
                        if (err || !rows) {
                            resolve([]);
                        } else {
                            // añadir proveedor
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
                    }
                );
            });

            // bloquear y recoger
            const sync = require("deasync");
            let done = false;
            let result = [];
            productos.then(r => { result = r; done = true; });
            while(!done) { sync.sleep(10); }

            todos = todos.concat(result);
            db.close();
        } catch (e) {
            console.warn("No se pudo abrir:", ruta, e.message);
        }
    });

    return todos;
}

// Pre-carga inicial (se puede recargar con ?refresh=1)
let cacheProductos = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 min cache

function getProductos(force = false) {
    const now = Date.now();
    if (force || !cacheProductos || (now - cacheTime) > CACHE_TTL_MS) {
        cacheProductos = cargarTodosProductos();
        cacheTime = now;
    }
    return cacheProductos;
}

// Util: parse precio a número si posible
function parsePrecio(precioStr) {
    if (!precioStr) return null;
    // limpiar moneda y puntos, comas etc.
    const only = precioStr.replace(/[^\d,.\-]/g, "").replace(/\.(?=\d{3,})/g, "").replace(",", ".");
    const n = parseFloat(only);
    return isFinite(n) ? n : null;
}

// Endpoint search
// Query params:
// q (texto), minPrice, maxPrice, proveedor (coma-separated), sort: relevance|price_asc|price_desc
// page (1-based), perPage
app.get("/api/buscar", (req, res) => {
    const q = (req.query.q || "").trim();
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
    const proveedorQ = req.query.proveedor ? String(req.query.proveedor).split(",").map(s=>s.trim()).filter(Boolean) : [];
    const sort = req.query.sort || "relevance";
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const perPage = Math.min(100, Math.max(5, parseInt(req.query.perPage || "24", 10)));
    const refresh = req.query.refresh === "1";

    // Cargar productos (de cache)
    const productos = getProductos(refresh);

    // Filtrar por proveedor si aplica
    let candidates = productos;
    if (proveedorQ.length > 0) {
        candidates = candidates.filter(p => proveedorQ.includes(p.proveedor));
    }

    // Filtrar por precio si aplica (parseamos)
    candidates = candidates.map(p => {
        const precioNum = parsePrecio(p.precio);
        return { ...p, precioNum };
    }).filter(p => {
        if (minPrice !== null && (p.precioNum === null || p.precioNum < minPrice)) return false;
        if (maxPrice !== null && (p.precioNum === null || p.precioNum > maxPrice)) return false;
        return true;
    });

    // Si no hay query, devolvemos ordenado por precio asc por defecto
    if (!q) {
        // ordenar
        if (sort === "price_asc") candidates.sort((a,b)=> (a.precioNum||0) - (b.precioNum||0));
        else if (sort === "price_desc") candidates.sort((a,b)=> (b.precioNum||0) - (a.precioNum||0));
        // paginar
        const total = candidates.length;
        const slice = candidates.slice((page-1)*perPage, page*perPage);
        return res.json({ total, page, perPage, results: slice });
    }

    // Fuzzy search con Fuse.js (tunea opciones)
    const options = {
        keys: ["titulo", "proveedor"],
        threshold: 0.4, // 0.0 = exacto, 1.0 = muy relajado
        ignoreLocation: true,
        distance: 200,
        minMatchCharLength: 2,
        useExtendedSearch: true
    };

    const fuse = new Fuse(candidates, options);
    const fuseRes = fuse.search(q, { limit: 1000 }); // límite razonable

    // Construir resultados con score y parse precio
    let results = fuseRes.map(r => {
        const item = r.item;
        return {
            titulo: item.titulo,
            url: item.url,
            imagen: item.imagen,
            precio: item.precio,
            precioNum: item.precioNum,
            proveedor: item.proveedor,
            score: r.score // menor = mejor
        };
    });

    // Ordenar según parámetro sort
    if (sort === "price_asc") {
        results.sort((a,b) => (a.precioNum||0) - (b.precioNum||0));
    } else if (sort === "price_desc") {
        results.sort((a,b) => (b.precioNum||0) - (a.precioNum||0));
    } else { // relevance
        results.sort((a,b) => (a.score - b.score)); // menor score = más relevante
    }

    // Paginación
    const total = results.length;
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const pageResults = results.slice(start, end);

    res.json({ total, page, perPage, results: pageResults });
});

// endpoint simple para listar proveedores
app.get("/api/proveedores", (req, res) => {
    const archivos = fs.readdirSync(BASES_DIR).filter(f => f.endsWith(".db"));
    const provs = archivos.map(a => path.basename(a, ".db"));
    res.json(provs);
});

app.listen(PORT, () => {
    console.log(`🔥 Buscador Mega listo en http://localhost:${PORT}`);
});
