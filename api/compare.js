import formidable from "formidable";
import { buscarImagenSimilar } from "./utils/compareImages.js";
import { v2 as cloudinary } from "cloudinary";

export const config = {
  api: { bodyParser: false },
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const form = formidable({ multiples: false });

  try {
    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    let file = files.imagen;
    if (!file) {
      return res.status(400).json({ error: "No se recibió imagen" });
    }

    if (Array.isArray(file)) file = file[0];

    // 1️⃣ Subir imagen a Cloudinary
    const upload = await cloudinary.uploader.upload(file.filepath, {
      folder: "comparador",
    });

    // 2️⃣ Comparar contra productos.json
    const resultado = await buscarImagenSimilar(upload.secure_url);

    return res.status(200).json(resultado);

  } catch (error) {
    console.error("🔥 buscarPorImagen error:", error);
    return res.status(500).json({ error: "Error procesando imagen" });
  }
}
