// api/buscarPorImagen.js
import formidable from "formidable";
import { buscarImagenSimilar } from "./utils/compareImages.js";
import { v2 as cloudinary } from "cloudinary";

export const config = {
  api: { bodyParser: false },
};

// Configuración de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  console.log("📌 Endpoint /api/buscarPorImagen llamado");

  if (req.method !== "POST") {
    console.warn("⚠️ Método no permitido:", req.method);
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
        console.warn("⚠️ No se recibió archivo 'imagen'");
        return res.status(400).json({ error: "No se recibió imagen" });
      }

      if (Array.isArray(file)) file = file[0];

      try {
        console.log("📌 Subiendo imagen a Cloudinary:", file.filepath);
        const upload = await cloudinary.uploader.upload(file.filepath, {
          folder: "comparador",
        });
        console.log("✅ Imagen subida, URL:", upload.secure_url);

        console.log("📌 Buscando similitudes usando compareImages.js");
        const resultados = await buscarImagenSimilar(upload.secure_url);
        console.log("✅ Resultados obtenidos:", resultados.length);

        return res.status(200).json({
          ok: true,
          total: resultados.length,
          resultados,
        });
      } catch (innerErr) {
        console.error("🔥 Error procesando imagen o buscando similitudes:", innerErr);
        return res.status(500).json({
          error: "Error procesando imagen o buscando similitudes",
          detalle: innerErr.message,
        });
      }
    });
  } catch (error) {
    console.error("🔥 Error inesperado en handler:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      detalle: error.message,
    });
  }
}
