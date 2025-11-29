// utils/compareImages.js
import { v2 as cloudinary } from "cloudinary";
import productos from "../productos.json";
import fs from "fs";

// Configuración de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Buscar imágenes similares
 * @param {string} input - Puede ser URL de internet o path local de archivo
 * @returns {Array} coincidencias
 */
export async function buscarImagenSimilar(input) {
  try {
    let urlCloudinary = input;

    // Si es un archivo local, subirlo a Cloudinary primero
    if (fs.existsSync(input)) {
      const uploadResult = await cloudinary.uploader.upload(input, {
        folder: "temp", // Carpeta temporal
        use_filename: true,
        unique_filename: true,
      });
      urlCloudinary = uploadResult.secure_url;
    }

    // Buscar imágenes similares
    const result = await cloudinary.search
      .expression(`similar:${urlCloudinary}`)
      .sort_by("similarity", "desc")
      .max_results(5)
      .execute();

    // Filtrar productos que coincidan
    const coincidencias = productos.filter((prod) =>
      result.resources.some(
        (sim) => prod.imagen && prod.imagen.includes(sim.public_id)
      )
    );

    return coincidencias;
  } catch (error) {
    console.error("Error comparando imágenes:", error);
    return [];
  }
}
