import { buscarImagenSimilar } from '../utils/compareImages';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Falta URL de imagen' });

    const resultados = await buscarImagenSimilar(url);

    // aseguramos que sea un array
    res.status(200).json({ resultados: resultados || [] });
  } catch (error) {
    console.error("Error en /api/compare:", error);
    res.status(500).json({ 
      error: 'Error al buscar imágenes similares', 
      message: error.message,
      stack: error.stack
    });
  }
}
