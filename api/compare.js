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
    // Crear el form
    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Error al parsear FormData:", err);
        return res.status(500).json({ error: "Error al procesar archivo", details: err.message });
      }

      // Validar que exista el archivo
      if (!files.file || files.file.length === 0) {
        return res.status(400).json({ error: "No se subió ningún archivo" });
      }

      // Tomar el primer archivo del array
      const archivo = files.file[0];

      // Obtener la ruta del archivo
      const ruta = archivo.filepath || archivo.path;
      if (!ruta) {
        return res.status(500).json({ error: "No se pudo determinar la ruta del archivo" });
      }

      // Leer el archivo como buffer
      const buffer = fs.readFileSync(ruta);

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
