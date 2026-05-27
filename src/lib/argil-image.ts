/** Proporcoes exigidas pela Argil para avatares IMAGE (16:9 ou 9:16). */
export const ARGIL_LANDSCAPE_RATIO = 16 / 9;
export const ARGIL_PORTRAIT_RATIO = 9 / 16;
const ASPECT_RATIO_TOLERANCE = 0.02;

export function pickArgilTargetRatio(width: number, height: number) {
  return width >= height ? ARGIL_LANDSCAPE_RATIO : ARGIL_PORTRAIT_RATIO;
}

export function isArgilCompatibleAspectRatio(
  width: number,
  height: number,
  tolerance = ASPECT_RATIO_TOLERANCE,
) {
  if (width <= 0 || height <= 0) {
    return false;
  }

  const ratio = width / height;
  return (
    Math.abs(ratio - ARGIL_LANDSCAPE_RATIO) <= tolerance ||
    Math.abs(ratio - ARGIL_PORTRAIT_RATIO) <= tolerance
  );
}

export function describeArgilAspectRatio(width: number, height: number) {
  return width >= height ? "16:9 (paisagem)" : "9:16 (retrato)";
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nao foi possivel ler a imagem enviada."));
    };

    image.src = url;
  });
}

function canvasToFile(canvas: HTMLCanvasElement, filename: string, mimeType: string) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Nao foi possivel processar a imagem."));
          return;
        }

        resolve(
          new File([blob], filename, {
            type: mimeType,
            lastModified: Date.now(),
          }),
        );
      },
      mimeType,
      0.92,
    );
  });
}

/**
 * Recorta ao centro na proporcao 9:16 (retrato) ou 16:9 (paisagem), conforme a Argil.
 */
export async function cropImageToArgilAspectRatio(file: File) {
  const image = await loadImageFromFile(file);
  const { width, height } = image;
  const targetRatio = pickArgilTargetRatio(width, height);
  const currentRatio = width / height;

  let cropWidth: number;
  let cropHeight: number;

  if (currentRatio > targetRatio) {
    cropHeight = height;
    cropWidth = Math.round(height * targetRatio);
  } else {
    cropWidth = width;
    cropHeight = Math.round(width / targetRatio);
  }

  const sx = Math.max(0, Math.round((width - cropWidth) / 2));
  const sy = Math.max(0, Math.round((height - cropHeight) / 2));

  const canvas = document.createElement("canvas");
  canvas.width = cropWidth;
  canvas.height = cropHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Nao foi possivel processar a imagem no navegador.");
  }

  context.drawImage(image, sx, sy, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  const outputName = file.name.replace(/\.[^.]+$/, "") || "avatar";
  const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";

  return canvasToFile(canvas, `${outputName}-argil.jpg`, mimeType);
}

export type PrepareAvatarImageResult = {
  file: File;
  wasCropped: boolean;
  width: number;
  height: number;
};

/** Garante proporcao Argil antes do upload (recorte central automatico se necessario). */
export async function prepareAvatarImageForArgil(file: File): Promise<PrepareAvatarImageResult> {
  const image = await loadImageFromFile(file);
  const { width, height } = image;

  if (isArgilCompatibleAspectRatio(width, height)) {
    return { file, wasCropped: false, width, height };
  }

  const cropped = await cropImageToArgilAspectRatio(file);
  const croppedImage = await loadImageFromFile(cropped);

  return {
    file: cropped,
    wasCropped: true,
    width: croppedImage.width,
    height: croppedImage.height,
  };
}
