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

  // 👉 CASO 1: viene una URL (click en imagen)
  if (req.headers["content-type"]?.includes("application/json")) {
    const { imagenUrl } = req.body;

    if (!imagenUrl) {
      return res.status(400).json({ error: "Falta imagenUrl" });
    }

    const resultados = await buscarImagenSimilar(imagenUrl);
    return res.json({ ok: true, resultados });
  }

  // 👉 CASO 2: viene archivo (input file)
  const form = formidable({ multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Error formulario" });

    let file = files.imagen;
    if (!file) return res.status(400).json({ error: "Sin imagen" });
    if (Array.isArray(file)) file = file[0];

    const upload = await cloudinary.uploader.upload(file.filepath, {
      folder: "comparador"
    });

    const resultados = await buscarImagenSimilar(upload.secure_url);
    res.json({ ok: true, resultados });
  });
}

