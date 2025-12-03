import productos from "../productos.json";

export default function handler(req, res) {
  const proveedores = [...new Set(
    productos
      .map(p => p.proveedor?.trim())   // quitar espacios y evitar undefined
      .filter(Boolean)                 // eliminar null, undefined, ""
  )];
  res.status(200).json(proveedores);
}
