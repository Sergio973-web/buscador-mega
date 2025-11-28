import { buscarImagenSimilar } from '../utils/compareImages';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Falta URL de imagen' });

  const resultados = await buscarImagenSimilar(url);
  res.status(200).json({ resultados });
}
