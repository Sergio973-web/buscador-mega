import fs from "fs";
import path from "path";

// ✅ Cargar productos desde la raíz del proyecto (Vercel-ready)
const productosPath = path.join(process.cwd(), "productos.json");

const productos = JSON.parse(
  fs.readFileSync(productosPath, "utf-8")
);

export default function handler(req, res) {
  const proveedores = [...new Set(
    productos
      .map(p => p.proveedor?.trim())
      .filter(Boolean)
  )];

  res.status(200).json(proveedores);
}
