import { v2 as cloudinary } from "cloudinary";

// IMPORTAR productos.json DESDE DONDE VOS YA LO TENÍAS FUNCIONANDO
import productos from "../../productos.json";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Buscar imágenes similares en Cloudinary y comparar con productos.json
export async function buscarImagenSimilar(urlImagenSubida) {
  try {
    console.log("🔎 Buscando similitudes en Cloudinary para:", urlImagenSubida);

    const resultado = await cloudinary.search
      .expression(`similar:${urlImagenSubida}`)
      .sort_by("similarity", "desc")
      .max_results(10)
      .execute();

    console.log("📸 Cantidad de imágenes similares encontradas:", resultado.resources.length);

    // Comparar productos.json con los resultados de Cloudinary
    const coincidencias = productos.filter((producto) =>
      resultado.resources.some((sim) => {
        return producto.imagen && producto.imagen.includes(sim.public_id);
      })
    );

    console.log("🟢 Coincidencias encontradas en productos.json:", coincidencias.length);

    return {
      similaresCloudinary: resultado.resources,
      coincidenciasProductos: coincidencias,
    };

  } catch (error) {
    console.error("❌ Error en buscarImagenSimilar:", error);
    return {
      similaresCloudinary: [],
      coincidenciasProductos: [],
      error: error.message,
    };
  }
}
