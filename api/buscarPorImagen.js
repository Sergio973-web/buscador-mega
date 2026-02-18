import formidable from "formidable";
import { buscarImagenSimilar } from "../utils/compareImages.js";
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

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al leer archivo" });
    }

    let file = files.imagen;
    if (!file) {
      return res.status(400).json({ error: "No se envió imagen" });
    }

    if (Array.isArray(file)) file = file[0];

    // 1️⃣ Subir imagen buscada a Cloudinary
    const upload = await cloudinary.uploader.upload(file.filepath, {
      folder: "comparador",
    });

    // 2️⃣ Comparar contra el catálogo
    const resultado = await buscarImagenSimilar(upload.secure_url);

    res.status(200).json(resultado);
  });
}
