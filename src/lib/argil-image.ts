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
    // blob:/data: nao usam CORS; crossOrigin="anonymous" quebra o load em varios browsers.
    if (/^https?:\/\//i.test(source)) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new Error(
          "Nao foi possivel carregar a imagem. Use JPG, PNG ou WEBP (HEIC do iPhone nao e suportado).",
        ),
      );
    image.src = source;
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string" && reader.result.startsWith("data:")) {
        resolve(reader.result);
        return;
      }
      reject(new Error("Nao foi possivel ler o arquivo da imagem."));
    };
    reader.onerror = () => reject(new Error("Nao foi possivel ler o arquivo da imagem."));
    reader.readAsDataURL(file);
  });
}

function isLikelyUnsupportedImage(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    type.includes("heic") ||
    type.includes("heif") ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

export type LoadedArgilImage = {
  /** Fonte segura para <img> e canvas (data URL). */
  displaySrc: string;
  width: number;
  height: number;
};

/** Carrega foto local de forma robusta (FileReader + createImageBitmap). */
export async function loadImageFromFile(file: File): Promise<LoadedArgilImage> {
  if (isLikelyUnsupportedImage(file)) {
    throw new Error(
      "Formato HEIC/HEIF nao e suportado no navegador. Exporte a foto como JPG ou PNG e tente de novo.",
    );
  }

  if (!file.size) {
    throw new Error("O arquivo da imagem esta vazio.");
  }

  // createImageBitmap decodifica o File direto (mais confiavel que blob: + Image).
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const displaySrc = await readFileAsDataUrl(file);
      const width = bitmap.width;
      const height = bitmap.height;
      bitmap.close();
      if (width > 0 && height > 0) {
        return { displaySrc, width, height };
      }
    } catch {
      // Cai no fallback via data URL.
    }
  }

  const displaySrc = await readFileAsDataUrl(file);
  const image = await loadImageElement(displaySrc);
  return {
    displaySrc,
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}

export async function renderArgilCropToFile(
  imageSource: string | File,
  crop: ArgilCropRect,
  fileName: string,
  mimeType = "image/jpeg",
) {
  const source =
    imageSource instanceof File
      ? (await loadImageFromFile(imageSource)).displaySrc
      : imageSource;
  const image = await loadImageElement(source);
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
    throw new Error("Nao foi possivel processar a imagem.");
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
          reject(new Error("Nao foi possivel exportar o recorte."));
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
