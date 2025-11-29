import formidable from "formidable";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

// Configuración de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const config = {
  api: {
    bodyParser: false, // importante para recibir archivos
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const form = new formidable();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: "Error al parsear el formulario" });
    }

    try {
      // files.imagen es el input que envías desde el frontend
      const file = files.imagen;
      if (!file) {
        return res.status(400).json({ error: "No se envió ningún archivo" });
      }

      // Subida a Cloudinary
      const uploaded = await cloudinary.uploader.upload(file.filepath, {
        folder: "imagenes_subidas", // puedes cambiar la carpeta
      });

      // Retornar info de la imagen subida
      res.status(200).json({ 
        success: true, 
        public_id: uploaded.public_id, 
        url: uploaded.secure_url 
      });
    } catch (error) {
      console.error("Error subiendo a Cloudinary:", error);
      res.status(500).json({ error: "Error subiendo la imagen" });
    }
  });
}
