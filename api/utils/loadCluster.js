import fs from "fs";
import path from "path";

const cache = {};

export function loadCluster(id) {
  if (cache[id]) return cache[id];

  const file = path.join(process.cwd(), "embeddings", `cluster_${id}.json`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));

  cache[id] = data;
  return data;
}