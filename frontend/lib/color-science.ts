export type PixelBuf = {
  data: Uint8ClampedArray | Uint8Array | number[];
  width: number;
  height: number;
};

export function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLin(r / 255);
  const lg = srgbToLin(g / 255);
  const lb = srgbToLin(b / 255);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

function srgbToLin(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function chiSquare(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let acc = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    const s = a[i] + b[i];
    if (s > 1e-9) {
      const d = a[i] - b[i];
      acc += (d * d) / s;
    }
  }
  return acc;
}

export function chiSquareSim(a: ArrayLike<number>, b: ArrayLike<number>): number {
  return Math.exp(-0.5 * chiSquare(a, b));
}

export function dominantColors(
  buf: PixelBuf,
  k = 3,
  keep?: (i: number) => boolean,
): Array<{ r: number; g: number; b: number; weight: number }> {
  const samples: Array<[number, number, number]> = [];
  const { data, width, height } = buf;
  const step = Math.max(4, Math.floor((width * height) / 1200) * 4);
  for (let i = 0; i < data.length; i += step) {
    if (keep && !keep(i / 4)) {
      continue;
    }
    if ((data[i + 3] ?? 255) < 16) {
      continue;
    }
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (samples.length === 0) {
    return [];
  }
  const clusters = samples.slice(0, k).map((row) => [...row] as [number, number, number]);
  for (let iter = 0; iter < 6; iter += 1) {
    const sums = clusters.map(() => [0, 0, 0, 0]);
    for (const sample of samples) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < clusters.length; c += 1) {
        const d =
          (sample[0] - clusters[c][0]) ** 2 +
          (sample[1] - clusters[c][1]) ** 2 +
          (sample[2] - clusters[c][2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      sums[best][0] += sample[0];
      sums[best][1] += sample[1];
      sums[best][2] += sample[2];
      sums[best][3] += 1;
    }
    for (let c = 0; c < clusters.length; c += 1) {
      if (sums[c][3] > 0) {
        clusters[c][0] = sums[c][0] / sums[c][3];
        clusters[c][1] = sums[c][1] / sums[c][3];
        clusters[c][2] = sums[c][2] / sums[c][3];
      }
    }
  }
  const weights = clusters.map(() => 0);
  for (const sample of samples) {
    let best = 0;
    let bestD = Infinity;
    for (let c = 0; c < clusters.length; c += 1) {
      const d =
        (sample[0] - clusters[c][0]) ** 2 +
        (sample[1] - clusters[c][1]) ** 2 +
        (sample[2] - clusters[c][2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    weights[best] += 1;
  }
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  return clusters
    .map((c, i) => ({ r: c[0], g: c[1], b: c[2], weight: weights[i] / total }))
    .filter((c) => c.weight > 0.04)
    .sort((a, b) => b.weight - a.weight);
}

export function phashBits(buf: PixelBuf, size = 32): bigint {
  const gray: number[] = [];
  const { data, width, height } = buf;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sx = Math.min(width - 1, Math.floor((x / size) * width));
      const sy = Math.min(height - 1, Math.floor((y / size) * height));
      const i = (sy * width + sx) * 4;
      gray.push(data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11);
    }
  }
  const dct = dct2(gray, size);
  const coeffs: number[] = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      if (x === 0 && y === 0) {
        continue;
      }
      coeffs.push(dct[y * size + x]);
    }
  }
  const sorted = [...coeffs].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  let bits = 0n;
  for (let i = 0; i < 64 && i < coeffs.length; i += 1) {
    if (coeffs[i] > mid) {
      bits |= 1n << BigInt(i);
    }
  }
  return bits;
}

function dct1(vec: number[]): number[] {
  const n = vec.length;
  const out = new Array<number>(n).fill(0);
  for (let u = 0; u < n; u += 1) {
    let sum = 0;
    for (let x = 0; x < n; x += 1) {
      sum += vec[x] * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * n));
    }
    out[u] = (u === 0 ? Math.sqrt(1 / n) : Math.sqrt(2 / n)) * sum;
  }
  return out;
}

function dct2(gray: number[], n: number): number[] {
  const rows: number[][] = [];
  for (let y = 0; y < n; y += 1) {
    rows.push(dct1(gray.slice(y * n, y * n + n)));
  }
  const out = new Array<number>(n * n).fill(0);
  for (let x = 0; x < n; x += 1) {
    const col = dct1(rows.map((row) => row[x]));
    for (let y = 0; y < n; y += 1) {
      out[y * n + x] = col[y];
    }
  }
  return out;
}

export function hamming(a: bigint, b: bigint): number {
  let x = a ^ b;
  let n = 0;
  while (x) {
    x &= x - 1n;
    n += 1;
  }
  return n;
}

export function phashSim(a: bigint, b: bigint): number {
  return Math.max(0, 1 - hamming(a, b) / 64);
}

export function softmax(values: number[], temperature = 0.14): number[] {
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp((v - max) / Math.max(0.04, temperature)));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((v) => v / sum);
}

export function labStats(buf: PixelBuf, keep?: (i: number) => boolean): { mean: [number, number, number]; std: [number, number, number] } {
  let n = 0;
  const mean: [number, number, number] = [0, 0, 0];
  const { data } = buf;
  for (let i = 0; i < data.length; i += 4) {
    if (keep && !keep(i / 4)) {
      continue;
    }
    if ((data[i + 3] ?? 255) < 16) {
      continue;
    }
    const lab = rgbToOklab(data[i], data[i + 1], data[i + 2]);
    mean[0] += lab[0];
    mean[1] += lab[1];
    mean[2] += lab[2];
    n += 1;
  }
  n = n || 1;
  mean[0] /= n;
  mean[1] /= n;
  mean[2] /= n;
  const acc: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    if (keep && !keep(i / 4)) {
      continue;
    }
    if ((data[i + 3] ?? 255) < 16) {
      continue;
    }
    const lab = rgbToOklab(data[i], data[i + 1], data[i + 2]);
    acc[0] += (lab[0] - mean[0]) ** 2;
    acc[1] += (lab[1] - mean[1]) ** 2;
    acc[2] += (lab[2] - mean[2]) ** 2;
  }
  return {
    mean,
    std: [Math.sqrt(acc[0] / n) || 0.08, Math.sqrt(acc[1] / n) || 0.08, Math.sqrt(acc[2] / n) || 0.08],
  };
}

export function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const r = linToSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = linToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = linToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return [r, g, bl];
}

function linToSrgb(c: number): number {
  const x = Math.min(1, Math.max(0, c));
  return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
}

export function reinhardTransfer(
  src: PixelBuf,
  target: { mean: [number, number, number]; std: [number, number, number] },
  keep?: (i: number) => boolean,
): void {
  const from = labStats(src, keep);
  const { data } = src;
  for (let i = 0; i < data.length; i += 4) {
    if (keep && !keep(i / 4)) {
      continue;
    }
    if ((data[i + 3] ?? 255) < 16) {
      continue;
    }
    const lab = rgbToOklab(data[i], data[i + 1], data[i + 2]);
    const mapped: [number, number, number] = [
      target.mean[0] + ((lab[0] - from.mean[0]) * target.std[0]) / from.std[0],
      target.mean[1] + ((lab[1] - from.mean[1]) * target.std[1]) / from.std[1],
      target.mean[2] + ((lab[2] - from.mean[2]) * target.std[2]) / from.std[2],
    ];
    const rgb = oklabToRgb(mapped[0], mapped[1], mapped[2]);
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
  }
}
