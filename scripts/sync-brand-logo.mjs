import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const source = path.join(root, "mandato_digital_logo.png");
const output = path.join(root, "public", "brand-logo.png");

function main() {
  if (!fs.existsSync(source)) {
    console.error("Arquivo mandato_digital_logo.png nao encontrado na raiz do projeto.");
    process.exit(1);
  }

  fs.copyFileSync(source, output);

  console.log(
    JSON.stringify(
      {
        source: path.basename(source),
        output: path.basename(output),
        sizeBytes: fs.statSync(output).size,
      },
      null,
      2,
    ),
  );
}

main();
