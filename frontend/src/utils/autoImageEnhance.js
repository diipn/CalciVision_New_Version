const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getScaledDimensions = (width, height, maxSide = 192) => {
  if (!width || !height) {
    return { width: maxSide, height: maxSide };
  }

  const scale = Math.min(1, maxSide / Math.max(width, height));

  return {
    width: Math.max(32, Math.round(width * scale)),
    height: Math.max(32, Math.round(height * scale)),
  };
};

const getLuminance = (data, index) => {
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const loadImageBitmap = async (imageUrl) => {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error("Não foi possível carregar a imagem para otimização.");
  }

  const blob = await response.blob();

  if (typeof window !== "undefined" && "createImageBitmap" in window) {
    return createImageBitmap(blob);
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível descodificar a imagem."));
    };

    image.src = objectUrl;
  });
};

export async function computeAutoImageSettings(imageUrl, currentSettings = {}) {
  if (!imageUrl) {
    throw new Error("Sem frame disponível para otimização.");
  }

  const imageBitmap = await loadImageBitmap(imageUrl);
  const { width, height } = getScaledDimensions(imageBitmap.width, imageBitmap.height);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Não foi possível analisar o frame atual.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(imageBitmap, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);
  const luminanceValues = new Float32Array(width * height);

  let totalLuminance = 0;
  let totalLuminanceSquared = 0;

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const dataIndex = pixelIndex * 4;
    const luminance = getLuminance(data, dataIndex);

    luminanceValues[pixelIndex] = luminance;
    totalLuminance += luminance;
    totalLuminanceSquared += luminance * luminance;
  }

  const pixelCount = width * height;
  const meanLuminance = totalLuminance / pixelCount;
  const variance = Math.max(0, totalLuminanceSquared / pixelCount - meanLuminance ** 2);
  const contrastDeviation = Math.sqrt(variance);

  let localVariation = 0;
  let edgeStrength = 0;
  let sampleCount = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const centerIndex = y * width + x;
      const center = luminanceValues[centerIndex];
      const left = luminanceValues[centerIndex - 1];
      const right = luminanceValues[centerIndex + 1];
      const top = luminanceValues[centerIndex - width];
      const bottom = luminanceValues[centerIndex + width];

      const neighbourhoodAverage = (left + right + top + bottom) / 4;
      localVariation += Math.abs(center - neighbourhoodAverage);
      edgeStrength += (Math.abs(center - right) + Math.abs(center - bottom)) / 2;
      sampleCount += 1;
    }
  }

  const noiseScore = sampleCount > 0 ? localVariation / sampleCount : 0;
  const edgeScore = sampleCount > 0 ? edgeStrength / sampleCount : 0;

  const brightness = clamp(1 + (132 - meanLuminance) / 180, 0.88, 1.22);
  const contrast = clamp(1 + (56 - contrastDeviation) / 90, 0.92, 1.35);
  const blur = clamp((noiseScore - edgeScore * 0.18 - 6) / 16, 0, 1.25);

  if (typeof imageBitmap.close === "function") {
    imageBitmap.close();
  }

  return {
    brightness,
    contrast,
    blur,
    zoom: currentSettings?.zoom ?? 1,
    diagnostics: {
      meanLuminance,
      contrastDeviation,
      noiseScore,
      edgeScore,
    },
  };
}
