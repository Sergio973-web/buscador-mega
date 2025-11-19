import productos from "../productos.json";

export default function handler(req, res) {
  const proveedores = [...new Set(productos.map(p => p.proveedor))];
  res.status(200).json(proveedores);
}
