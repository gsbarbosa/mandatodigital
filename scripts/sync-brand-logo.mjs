import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const source = path.join(root, "mandato_digital_logo.png");
const outputDark = path.join(root, "public", "brand-logo-on-dark.png");
const outputLegacy = path.join(root, "public", "brand-logo.png");

function main() {
  if (!fs.existsSync(source)) {
    console.error("Arquivo mandato_digital_logo.png nao encontrado na raiz do projeto.");
    process.exit(1);
  }

  fs.copyFileSync(source, outputDark);
  fs.copyFileSync(source, outputLegacy);

  console.log(
    JSON.stringify(
      {
        source: path.basename(source),
        outputs: [path.basename(outputDark), path.basename(outputLegacy)],
        note: "Regenere brand-logo-on-light.png com o script de contraste se alterar a arte.",
        sizeBytes: fs.statSync(outputDark).size,
      },
      null,
      2,
    ),
  );
}

main();
