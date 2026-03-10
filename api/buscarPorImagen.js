// api/buscarPorImagen.js
import formidable from "formidable";
import fs from "fs";
import path from "path";
import { buscarImagenSimilar } from "./utils/compareImages.js";

export const config = {
  api: { bodyParser: false },
};

// Verificar si existen embeddings locales
const EMBEDDINGS_PATH = path.join(process.cwd(), "embeddings", "embeddings.json");
let embeddingsDisponibles = fs.existsSync(EMBEDDINGS_PATH);

if (embeddingsDisponibles) {
  console.log("✅ Embeddings locales encontrados. Búsqueda por imagen activada.");
} else {
  console.log("⚠️ Embeddings locales NO encontrados. Búsqueda por imagen desactivada.");
}

export default async function handler(req, res) {
  console.log("📌 Endpoint /api/buscarPorImagen llamado");

  if (!embeddingsDisponibles) {
    return res.status(200).json({
      ok: false,
      error: "Busqueda por imagen no disponible en esta instalación",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("❌ Error formidable:", err);
        return res.status(500).json({ error: "Error parseando imagen", detalle: err.message });
      }

      let file = files.imagen;
      if (!file) {
        return res.status(400).json({ error: "No se recibió imagen" });
      }
      if (Array.isArray(file)) file = file[0];

      try {
        // Convertir archivo a URL local
        const localUrl = `file://${file.filepath}`;

        console.log("📌 Buscando similitudes para imagen local:", file.filepath);

        const resultados = await buscarImagenSimilar(localUrl);

        return res.status(200).json({
          ok: true,
          total: resultados.length,
          resultados,
        });

      } catch (innerErr) {
        console.error("🔥 Error buscando similitudes:", innerErr);
        return res.status(500).json({
          error: "Error procesando imagen o buscando similitudes",
          detalle: innerErr.message,
        });
      }
    });

  } catch (error) {
    console.error("🔥 Error inesperado en handler:", error);
    return res.status(500).json({ error: "Error interno del servidor", detalle: error.message });
  }
}