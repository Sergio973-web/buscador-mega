export const config = {
  api: { bodyParser: false },
};

const API_LOCAL =
  "https://homopterous-cirrose-estella.ngrok-free.dev/api/buscarPorImagen";

export default async function handler(req, res) {
  console.log("📌 Proxy /api/buscarPorImagen");

  // 🚫 evitar cache (evita 304 / respuestas viejas)
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    // ===============================
    // 1. LEER STREAM COMPLETO
    // ===============================
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const bodyBuffer = Buffer.concat(chunks);

    // ===============================
    // 2. FORWARD A NGROK
    // ===============================
    const response = await fetch(API_LOCAL, {
      method: "POST",
      headers: {
        // 🔥 CRÍTICO: mantener multipart correcto
        "Content-Type": req.headers["content-type"] || "",

        // 🔥 evita pantalla ngrok warning
        "ngrok-skip-browser-warning": "true",
      },
      body: bodyBuffer,
    });

    const text = await response.text();

    // ===============================
    // 3. VALIDACIÓN SEGURA JSON
    // ===============================
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("❌ Respuesta no JSON del backend local:");
      console.error(text);

      return res.status(500).json({
        error: "Respuesta inválida del servidor local",
        raw: text,
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("🔥 Error proxy:", err);

    return res.status(500).json({
      error: "No se pudo conectar con el servidor de embeddings",
      detalle: err.message,
    });
  }
}