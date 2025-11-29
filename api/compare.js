import formidable from "formidable";
import { v2 as cloudinary } from "cloudinary";

export const config = {
  api: {
    bodyParser: false,
  },
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

  try {
    const form = formidable({
      multiples: false,
      keepExtensions: true,
    });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Error parseando con formidable:", err);
        return res.status(500).json({ error: "Error parseando el formulario" });
      }

      let file = files.imagen;

      // 📌 Si viene como array, tomar el primer elemento
      if (Array.isArray(file)) {
        file = file[0];
      }

      if (!file) {
        return res.status(400).json({ error: "No se recibió el archivo" });
      }

      console.log("➡ Archivo listo para subir:", file.filepath);

      // 📤 Subir a Cloudinary
      const upload = await cloudinary.uploader.upload(file.filepath, {
        folder: "comparador",
      });

      console.log("✔ Imagen subida:", upload.secure_url);

      return res.json({
        message: "Imagen subida correctamente",
        url: upload.secure_url,
      });
    });

  } catch (error) {
    console.error("❌ Error general:", error);
    return res.status(500).json({
      error: "Error procesando la imagen",
      details: error.message,
    });
  }
}
