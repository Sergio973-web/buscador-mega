const productos = require("../../productos_hash.json");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const imghash = require("imghash");

// Distancia Hamming
function distanciaHamming(h1, h2) {
  let dist = 0;
  for (let i = 0; i < h1.length; i++) {
    if (h1[i] !== h2[i]) dist++;
  }
  return dist;
}

// Crear hash desde URL usando imghash
async function hashDesdeURL(url) {
  // Ruta temporal en /tmp (Vercel permite esto)
  const tempPath = path.join("/tmp", `${Date.now()}.jpg`);

  const response = await axios.get(url, { responseType: "arraybuffer" });
  fs.writeFileSync(tempPath, Buffer.from(response.data));

  try {
    const hash = await imghash.hash(tempPath, 16); // 16 = tamaño del hash
    return hash;
  } finally {
    fs.unlinkSync(tempPath); // limpiar archivo temporal
  }
}

// Buscar imágenes similares
async function buscarImagenSimilar(urlSubida) {
  try {
    const hashSubida = await hashDesdeURL(urlSubida);

    const resultados = productos
      .filter(p => p.hash)
      .map(p => ({
        ...p,
        distancia: distanciaHamming(hashSubida, p.hash)
      }))
      .sort((a, b) => a.distancia - b.distancia);

    return {
      ok: true,
      imagenSubida: urlSubida,
      resultados: resultados.slice(0, 20),
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = { buscarImagenSimilar };
