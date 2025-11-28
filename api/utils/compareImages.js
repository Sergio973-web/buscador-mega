import { v2 as cloudinary } from 'cloudinary';

import productos from '../../productos.json';
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function buscarImagenSimilar(urlSubida) {
  try {
    const result = await cloudinary.search
      .expression(`similar:${urlSubida}`)
      .sort_by("similarity", "desc")
      .max_results(5)
      .execute();

    // comparar con productos.json
    const coincidencias = productos.filter(prod =>
      result.resources.some(sim => prod.imagen && prod.imagen.includes(sim.public_id))
    );

    return coincidencias;

  } catch (error) {
    console.error("Error comparando imágenes", error);
    return [];
  }
}

