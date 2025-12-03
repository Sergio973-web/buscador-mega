import formidable from "formidable";
import { buscarImagenSimilar } from "./utils/compareImages.js";
import { v2 as cloudinary } from "cloudinary";

export const config = {
  api: { bodyParser: false },
};

// Configurar Cloudinary
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
    const form = formidable({ multiples: false, keepExtensions: true });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("❌ Error parseando formulario:", err);
        return res.status(500).json({ error: "Error parseando archivo" });
      }

      let file = files.imagen;
      if (!file) return res.status(400).json({ error: "No se recibió archivo" });

      if (Array.isArray(file)) file = file[0];

      const filePath = file.filepath;

      // 1️⃣ Subir archivo temporal a Cloudinary
      const upload = await cloudinary.uploader.upload(filePath, {
        folder: "comparador",
      });

      // 2️⃣ Pasar la URL pública a tu función
      const resultado = await buscarImagenSimilar(upload.secure_url);

      return res.json(resultado);
    });

  } catch (error) {
    console.error("🔥 compare.js error:", error);
    return res.status(500).json({ error: error.message });
  }
}
