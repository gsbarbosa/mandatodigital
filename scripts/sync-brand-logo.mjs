import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/** Fonte canônica da marca (Proposta 2). Fallback: legado na raiz. */
const candidates = [
  path.join(root, "brand", "propostas-logo", "exports", "brand-logo.png"),
  path.join(root, "mandato_digital_logo.png"),
];

const output = path.join(root, "public", "brand-logo.png");
const outputDark = path.join(root, "public", "brand-logo-on-dark.png");
const outputLight = path.join(
  root,
  "brand",
  "propostas-logo",
  "exports",
  "md-lockup-horizontal-light.png",
);
const outputLightPublic = path.join(root, "public", "brand-logo-on-light.png");
const darkLockup = path.join(
  root,
  "brand",
  "propostas-logo",
  "exports",
  "md-lockup-horizontal-dark.png",
);

function main() {
  const source = candidates.find((p) => fs.existsSync(p));
  if (!source) {
    console.error(
      "Nenhuma fonte de logo encontrada (exports/brand-logo.png ou mandato_digital_logo.png).",
    );
    process.exit(1);
  }

  fs.copyFileSync(source, output);
  if (fs.existsSync(darkLockup)) {
    fs.copyFileSync(darkLockup, outputDark);
  } else {
    fs.copyFileSync(source, outputDark);
  }
  if (fs.existsSync(outputLight)) {
    fs.copyFileSync(outputLight, outputLightPublic);
  }

  console.log(
    JSON.stringify(
      {
        source: path.relative(root, source),
        outputs: [
          path.relative(root, output),
          path.relative(root, outputDark),
          ...(fs.existsSync(outputLightPublic)
            ? [path.relative(root, outputLightPublic)]
            : []),
        ],
        sizeBytes: fs.statSync(output).size,
      },
      null,
      2,
    ),
  );
}

main();
