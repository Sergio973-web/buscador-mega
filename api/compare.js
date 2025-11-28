import formidable from "formidable";
import fs from "fs";
import { buscarImagenSimilar } from "./utils/compareImages.js"; // ojo con la extensión .js

export const config = {
  api: {
    bodyParser: false, // importante para poder manejar archivos
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    // Crear el form con la nueva API de formidable
    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Error al parsear FormData:", err);
        return res.status(500).json({ error: "Error al procesar archivo" });
      }

      const archivo = files.file; // depende del name en tu frontend
      if (!archivo) {
        return res.status(400).json({ error: "No se subió ningún archivo" });
      }

      // Leer el archivo como buffer
      const buffer = fs.readFileSync(archivo.filepath);

      // Pasar el buffer a la función que compara imágenes
      const resultados = await buscarImagenSimilar(buffer);

      res.status(200).json({ resultados: resultados || [] });
    });
  } catch (error) {
    console.error("Error en /api/compare:", error);
    res.status(500).json({
      error: "Error al buscar imágenes similares",
      message: error.message,
      stack: error.stack,
    });
  }
}
