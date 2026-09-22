const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "data", "seals.json");
const outputPath = path.join(root, "assets", "catalog.js");
const catalog = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

if (!Array.isArray(catalog.templates) || !Array.isArray(catalog.levels) || !Array.isArray(catalog.servers)) {
    throw new Error("data/seals.json não contém um catálogo de selos válido.");
}

fs.writeFileSync(outputPath, `window.SEAL_CATALOG = ${JSON.stringify(catalog)};\n`, "utf8");
process.stdout.write(`Catálogo estático gerado: ${catalog.templates.length} templates.\n`);
