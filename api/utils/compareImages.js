import fs from "fs";
import path from "path";
import axios from "axios";
import crypto from "crypto";
import { fileURLToPath } from "url";

// Fix __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// productos.json (raíz del proyecto)
const PRODUCTOS_FILE = path.join(__dirname, "..", "..", "productos.json");

function hashImagen(buffer) {
  return crypto.createHash("sha1").update(buffer).digest("hex");
}

function distanciaHash(hash1, hash2) {
  if (!hash1 || !hash2) return Infinity;
  let dist = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) dist++;
  }
  return dist;
}

export async function buscarImagenSimilar(imagenUrl) {
  // 1️⃣ Descargar imagen subida (Cloudinary)
  const res = await axios.get(imagenUrl, {
    responseType: "arraybuffer",
  });

  const hashConsulta = hashImagen(res.data);

  // 2️⃣ Leer productos.json
  const productos = JSON.parse(
    fs.readFileSync(PRODUCTOS_FILE, "utf8")
  );

  // 3️⃣ Comparar contra hashes cacheados
  const resultados = [];

  for (const p of productos) {
    if (!p.hashVisual || !p.imagenCloud) continue;

    const distancia = distanciaHash(hashConsulta, p.hashVisual);

    resultados.push({
      ...p,
      score: distancia,
    });
  }

  // 4️⃣ Ordenar por similitud
  resultados.sort((a, b) => a.score - b.score);

  // 5️⃣ Devolver top 10
  return resultados.slice(0, 10);
}
