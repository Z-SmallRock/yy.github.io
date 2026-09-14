import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(
  __dirname,
  "../public/images/hero/ink-mountain.webp",
);

const WIDTH = 2400;
const HEIGHT = 1200;

const PAPER_TOP = [247, 244, 236];
const PAPER_BOTTOM = [237, 240, 233];
const MIST = [242, 242, 236];

const LAYERS = [
  {
    baseY: 0.57,
    amplitude: 0.2,
    scale: 1.6,
    seed: 11,
    opacity: 0.7,
    peaks: [[0.2, 0.95, 0.15], [0.52, 0.62, 0.2], [0.84, 0.78, 0.17]],
    top: [218, 222, 215],
    bottom: [190, 201, 193],
  },
  {
    baseY: 0.68,
    amplitude: 0.25,
    scale: 2.1,
    seed: 22,
    opacity: 0.76,
    peaks: [[0.08, 0.65, 0.14], [0.36, 0.88, 0.13], [0.7, 0.62, 0.2], [0.93, 0.92, 0.14]],
    top: [168, 181, 173],
    bottom: [125, 145, 134],
  },
  {
    baseY: 0.79,
    amplitude: 0.3,
    scale: 2.6,
    seed: 33,
    opacity: 0.84,
    peaks: [[0.04, 0.76, 0.12], [0.27, 0.9, 0.16], [0.58, 0.72, 0.16], [0.86, 0.98, 0.18]],
    top: [103, 124, 113],
    bottom: [67, 91, 81],
  },
  {
    baseY: 0.91,
    amplitude: 0.27,
    scale: 3.2,
    seed: 44,
    opacity: 0.92,
    peaks: [[0.16, 0.72, 0.14], [0.48, 0.88, 0.15], [0.77, 0.7, 0.13]],
    top: [57, 74, 67],
    bottom: [36, 52, 47],
  },
];

const MIST_BANDS = [
  { centerY: 0.49, halfHeight: 0.035, strength: 0.55 },
  { centerY: 0.61, halfHeight: 0.045, strength: 0.42 },
];

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeValueNoise(seed) {
  const random = mulberry32(seed);
  const table = new Float64Array(256);
  for (let index = 0; index < table.length; index += 1) {
    table[index] = random();
  }

  return function noise(x) {
    const x0 = Math.floor(x);
    const fraction = x - x0;
    const eased = fraction * fraction * (3 - 2 * fraction);
    const a = table[x0 & 255];
    const b = table[(x0 + 1) & 255];
    return a + (b - a) * eased;
  };
}

function fbm(noise, x, octaves = 4) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let normalizer = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    value += amplitude * noise(x * frequency);
    normalizer += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }

  return value / normalizer;
}

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function peakProfile(normalizedX, peaks) {
  return peaks.reduce((highest, [center, strength, width]) => {
    const distance = (normalizedX - center) / width;
    return Math.max(highest, strength * Math.exp(-distance * distance));
  }, 0);
}

function ridgeHeight(layer, noise, x) {
  const normalizedX = x / (WIDTH - 1);
  const broadNoise = fbm(noise, normalizedX * layer.scale, 5);
  const detailNoise = fbm(noise, normalizedX * layer.scale * 2.4 + 19, 3);
  const peaks = peakProfile(normalizedX, layer.peaks);
  const profile = clamp(0.16 + broadNoise * 0.24 + detailNoise * 0.08 + peaks * 0.62);
  return layer.baseY * HEIGHT - layer.amplitude * HEIGHT * profile;
}

function mix(colorA, colorB, amount) {
  return [
    colorA[0] + (colorB[0] - colorA[0]) * amount,
    colorA[1] + (colorB[1] - colorA[1]) * amount,
    colorA[2] + (colorB[2] - colorA[2]) * amount,
  ];
}

function hash2D(x, y) {
  let value = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
  value = Math.imul(value ^ (value >>> 15), 0x85ebca6b);
  value ^= value >>> 13;
  return (value >>> 0) / 4294967296;
}

const buffer = Buffer.alloc(WIDTH * HEIGHT * 4);

// 宣纸底色：从上到下的极轻微渐变。
for (let y = 0; y < HEIGHT; y += 1) {
  const amount = y / (HEIGHT - 1);
  const color = mix(PAPER_TOP, PAPER_BOTTOM, amount);
  for (let x = 0; x < WIDTH; x += 1) {
    const offset = (y * WIDTH + x) * 4;
    buffer[offset] = Math.round(color[0]);
    buffer[offset + 1] = Math.round(color[1]);
    buffer[offset + 2] = Math.round(color[2]);
    buffer[offset + 3] = 255;
  }
}

// 层叠山体：由远及近叠加低频山脊，保留清晰的峰谷轮廓。
for (const layer of LAYERS) {
  const noise = makeValueNoise(layer.seed);
  const ridgeLines = new Float64Array(WIDTH);
  for (let x = 0; x < WIDTH; x += 1) {
    ridgeLines[x] = ridgeHeight(layer, noise, x);
  }

  for (let x = 0; x < WIDTH; x += 1) {
    const topY = Math.max(0, Math.floor(ridgeLines[x]));

    for (let y = topY; y < HEIGHT; y += 1) {
      const amount = (y - topY) / Math.max(1, HEIGHT - topY);
      const color = mix(layer.top, layer.bottom, amount);
      const opacity = layer.opacity * (0.82 + amount * 0.18);
      const offset = (y * WIDTH + x) * 4;
      buffer[offset] = Math.round(buffer[offset] * (1 - opacity) + color[0] * opacity);
      buffer[offset + 1] = Math.round(buffer[offset + 1] * (1 - opacity) + color[1] * opacity);
      buffer[offset + 2] = Math.round(buffer[offset + 2] * (1 - opacity) + color[2] * opacity);
    }
  }
}

// 横向雾带：在山体交界处柔和过渡，避免生硬切边。
for (let y = 0; y < HEIGHT; y += 1) {
  let veil = 0;
  for (const band of MIST_BANDS) {
    const center = band.centerY * HEIGHT;
    const halfHeight = band.halfHeight * HEIGHT;
    const distance = Math.abs(y - center);
    if (distance < halfHeight) {
      const factor = 1 - distance / halfHeight;
      veil = Math.max(veil, factor * factor * band.strength);
    }
  }

  if (veil <= 0) {
    continue;
  }

  for (let x = 0; x < WIDTH; x += 1) {
    const offset = (y * WIDTH + x) * 4;
    const color = mix(
      [buffer[offset], buffer[offset + 1], buffer[offset + 2]],
      MIST,
      veil,
    );
    buffer[offset] = Math.round(color[0]);
    buffer[offset + 1] = Math.round(color[1]);
    buffer[offset + 2] = Math.round(color[2]);
  }
}

// 细颗粒宣纸质感：仅加轻微亮度扰动。
for (let y = 0; y < HEIGHT; y += 1) {
  for (let x = 0; x < WIDTH; x += 1) {
    const offset = (y * WIDTH + x) * 4;
    const grain = (hash2D(x, y) - 0.5) * 4.5;
    buffer[offset] = Math.max(0, Math.min(255, Math.round(buffer[offset] + grain)));
    buffer[offset + 1] = Math.max(0, Math.min(255, Math.round(buffer[offset + 1] + grain)));
    buffer[offset + 2] = Math.max(0, Math.min(255, Math.round(buffer[offset + 2] + grain)));
  }
}

await mkdir(path.dirname(outputPath), { recursive: true });
await sharp(buffer, {
  raw: { width: WIDTH, height: HEIGHT, channels: 4 },
}).webp({ quality: 88, effort: 4 }).toFile(outputPath);

console.log(`Wrote ${outputPath} (${WIDTH}x${HEIGHT})`);
