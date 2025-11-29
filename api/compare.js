import { formidable } from "formidable";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Error parseando el formulario" });

    const file = files.imagen; // input del frontend
    if (!file) return res.status(400).json({ error: "No se envió ningún archivo" });

    try {
      const uploaded = await cloudinary.uploader.upload(file.filepath, {
        folder: "imagenes_subidas",
      });

      res.status(200).json({
        success: true,
        public_id: uploaded.public_id,
        url: uploaded.secure_url,
      });
    } catch (error) {
      console.error("Error subiendo a Cloudinary:", error);
      res.status(500).json({ error: "Error subiendo la imagen" });
    }
  });
}
