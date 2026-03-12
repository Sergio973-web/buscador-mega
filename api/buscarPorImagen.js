import formidable from "formidable";
import fs from "fs";
import path from "path";

export const config = {
  api: { bodyParser: false },
};

const EMBEDDINGS_PATH = path.join(process.cwd(), "embeddings", "embeddings.json");

export default async function handler(req, res) {

  console.log("📌 Endpoint /api/buscarPorImagen llamado");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const embeddingsDisponibles = fs.existsSync(EMBEDDINGS_PATH);

  try {
    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {

      if (err) {
        console.error("❌ Error formidable:", err);
        return res.status(500).json({ error: "Error parseando imagen" });
      }

      let file = files.imagen;
      if (!file) {
        return res.status(400).json({ error: "No se recibió imagen" });
      }

      if (Array.isArray(file)) file = file[0];

      // Si existen embeddings locales
      if (embeddingsDisponibles) {

        console.log("✅ Usando embeddings locales");

        const { buscarImagenSimilar } = await import("./utils/compareImages.js");

        const localUrl = `file://${file.filepath}`;

        const resultados = await buscarImagenSimilar(localUrl);

        return res.json({
          ok: true,
          resultados
        });

      }

      // Si NO existen embeddings → reenviar a servidor local
      console.log("⚠️ Embeddings no encontrados. Redirigiendo a localhost");

      const formData = new FormData();
      const buffer = fs.readFileSync(file.filepath);

      formData.append("imagen", new Blob([buffer]), "busqueda.jpg");

      const response = await fetch("http://localhost:3001/api/buscarPorImagen", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      return res.json(data);

    });

  } catch (error) {

    console.error("🔥 Error inesperado:", error);

    return res.status(500).json({
      error: "Error interno",
      detalle: error.message
    });

  }

}