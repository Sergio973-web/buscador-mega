import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'No se recibió imagen' });

    const uploadResponse = await cloudinary.uploader.upload(image, {
      folder: 'buscador-mega',
    });

    res.status(200).json({
      url: uploadResponse.secure_url,
      public_id: uploadResponse.public_id,
    });

  } catch (error) {
    console.error('Error al subir imagen:', error);
    res.status(500).json({
      error: 'Error al subir imagen',
      message: error.message,
      stack: error.stack
    });
  }
}
