// api/proveedores.js
export default function handler(req,res){
  res.status(200).json(["Proveedor1","Proveedor2"]);
}

// api/buscar.js
export default function handler(req,res){
  res.status(200).json({
    results:[
      {titulo:"Anillo de cuarzo rosa",precio:"$1200",imagen:"https://via.placeholder.com/300",proveedor:"Proveedor1",url:"#",score:0.95},
      {titulo:"Pulsera de amatista",precio:"$800",imagen:"https://via.placeholder.com/300",proveedor:"Proveedor2",url:"#",score:0.88}
    ],
    total:2,
    page: parseInt(req.query.page)||1,
    perPage: parseInt(req.query.perPage)||24
  });
}
