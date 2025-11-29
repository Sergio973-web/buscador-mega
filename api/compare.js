import formidable from "formidable";
import fs from "fs";
import { buscarImagenSimilar } from "./utils/compareImages.js";

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Error al procesar archivo", details: err.message });

    const archivo = files.file;
    console.log("Files recibidos:", files);
    if (!archivo) return res.status(400).json({ error: "No se subió ningún archivo" });

    const ruta = archivo.filepath || archivo.path;
    if (!ruta) return res.status(500).json({ error: "No se pudo determinar la ruta del archivo" });

    const buffer = fs.readFileSync(ruta);
    const resultados = await buscarImagenSimilar(buffer);

    res.status(200).json({ resultados: resultados || [] });
  });
}
