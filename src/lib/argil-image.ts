/** Proporcoes exigidas pela Argil para avatares IMAGE (16:9 ou 9:16). */
export const ARGIL_LANDSCAPE_RATIO = 16 / 9;
export const ARGIL_PORTRAIT_RATIO = 9 / 16;
const ASPECT_RATIO_TOLERANCE = 0.02;

export type ArgilCropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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

/** Maior retangulo com proporcao Argil que cabe na imagem. */
export function computeMaxArgilCrop(
  imageWidth: number,
  imageHeight: number,
  aspect: number,
): ArgilCropRect {
  const imageRatio = imageWidth / imageHeight;

  let width: number;
  let height: number;

  if (imageRatio > aspect) {
    height = imageHeight;
    width = height * aspect;
  } else {
    width = imageWidth;
    height = width / aspect;
  }

  return {
    x: (imageWidth - width) / 2,
    y: (imageHeight - height) / 2,
    width,
    height,
  };
}

export function clampArgilCrop(
  crop: ArgilCropRect,
  imageWidth: number,
  imageHeight: number,
): ArgilCropRect {
  const width = Math.min(crop.width, imageWidth);
  const height = Math.min(crop.height, imageHeight);
  const x = Math.min(Math.max(crop.x, 0), imageWidth - width);
  const y = Math.min(Math.max(crop.y, 0), imageHeight - height);

  return { x, y, width, height };
}

export function loadImageElement(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    image.src = source;
  });
}

export async function renderArgilCropToFile(
  imageSource: string,
  crop: ArgilCropRect,
  fileName: string,
  mimeType = "image/jpeg",
) {
  const image = await loadImageElement(imageSource);
  const rounded: ArgilCropRect = {
    x: Math.round(crop.x),
    y: Math.round(crop.y),
    width: Math.round(crop.width),
    height: Math.round(crop.height),
  };

  const canvas = document.createElement("canvas");
  canvas.width = rounded.width;
  canvas.height = rounded.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Não foi possível processar a imagem.");
  }

  context.drawImage(
    image,
    rounded.x,
    rounded.y,
    rounded.width,
    rounded.height,
    0,
    0,
    rounded.width,
    rounded.height,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (!value) {
          reject(new Error("Não foi possível exportar o recorte."));
          return;
        }
        resolve(value);
      },
      mimeType,
      0.92,
    );
  });

  return new File([blob], fileName, { type: mimeType, lastModified: Date.now() });
}
