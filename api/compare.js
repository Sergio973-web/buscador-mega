import formidable from "formidable";
import { v2 as cloudinary } from "cloudinary";

// ⛔ NECESARIO para que formidable funcione en Vercel
export const config = {
  api: {
    bodyParser: false,
  },
};

// 🔧 Configurar Cloudinary
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

      // 📸 El archivo TIENE QUE ESTAR en files.imagen
      const file = files.imagen;

      if (!file) {
        return res.status(400).json({ error: "No se envió la imagen" });
      }

      console.log("Archivo recibido por formidable:", file);

      // 📤 SUBIR A CLOUDINARY
      const upload = await cloudinary.uploader.upload(file.filepath, {
        folder: "comparador",
      });

      console.log("Subida exitosa:", upload.secure_url);

      return res.json({
        message: "Imagen subida correctamente",
        url: upload.secure_url,
      });
    });

  } catch (error) {
    console.error("Error general:", error);
    return res.status(500).json({
      error: "Error procesando la imagen",
      details: error.message,
    });
  }
}
