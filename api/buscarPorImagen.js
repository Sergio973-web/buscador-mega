import formidable from "formidable";
import fs from "fs";
import path from "path";
import { buscarImagenSimilar } from "./utils/compareImages.js";
import { v2 as cloudinary } from "cloudinary";

export const config = {
  api: { bodyParser: false },
};

// Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("❌ Error formidable:", err);
        return res.status(500).json({ error: "Error parseando imagen" });
      }

      let file = files.imagen;
      if (!file) {
        return res.status(400).json({ error: "No se recibió imagen" });
      }

      if (Array.isArray(file)) file = file[0];

      // 1️⃣ subir imagen a Cloudinary
      const upload = await cloudinary.uploader.upload(file.filepath, {
        folder: "comparador",
      });

      // 2️⃣ buscar similitudes
      const resultados = await buscarImagenSimilar(upload.secure_url);

      // 3️⃣ devolver JSON SIEMPRE
      return res.status(200).json({
        ok: true,
        total: resultados.length,
        resultados,
      });
    });

  } catch (error) {
    console.error("🔥 buscarPorImagen error:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      detalle: error.message,
    });
  }
}
