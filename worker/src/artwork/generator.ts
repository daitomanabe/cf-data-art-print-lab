export type Metrics = {
  seed: string;
  generated_at: string;
  sleep_score?: number;
  resting_hr?: number;
  steps?: number;
  note?: string;
};

export type ArtworkSpec = {
  width_mm: number;
  height_mm: number;
  kind: "sample" | "preview";
};

/**
 * MVP generator: outputs SVG only.
 * - Works in Workers (no heavy libs)
 * - Vector -> decent for quick print tests
 */
export function generateSvg(metrics: Metrics, spec: ArtworkSpec): string {
  const w = spec.width_mm;
  const h = spec.height_mm;

  // deterministic pseudo art from seed
  const seed = hashToInt(metrics.seed);
  const rand = mulberry32(seed);
  const lines = 120;
  const padding = 12;

  const bg = "#0b0b0c";
  const fg = "#e7e7ea";
  const accent = "#7afcff";

  let paths: string[] = [];
  for (let i = 0; i < lines; i++) {
    const x1 = lerp(padding, w - padding, rand());
    const y1 = lerp(padding, h - padding, rand());
    const x2 = lerp(padding, w - padding, rand());
    const y2 = lerp(padding, h - padding, rand());
    const stroke = i % 9 === 0 ? accent : fg;
    const alpha = i % 9 === 0 ? 0.9 : 0.16;
    const sw = i % 9 === 0 ? 0.6 : 0.25;
    paths.push(
      `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${stroke}" stroke-opacity="${alpha}" stroke-width="${sw}"/>`
    );
  }

  const metaLines = [
    `kind: ${spec.kind}`,
    `generated_at: ${metrics.generated_at}`,
    metrics.sleep_score != null ? `sleep_score: ${metrics.sleep_score}` : null,
    metrics.resting_hr != null ? `resting_hr: ${metrics.resting_hr}` : null,
    metrics.steps != null ? `steps: ${metrics.steps}` : null,
    metrics.note ? `note: ${escapeXml(metrics.note).slice(0, 90)}` : null,
  ].filter(Boolean) as string[];

  const metaText = metaLines
    .map((t, i) => `<text x="${padding}" y="${h - padding - (metaLines.length - 1 - i) * 4.2}" font-size="3.2" fill="${fg}" fill-opacity="0.7" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">${escapeXml(t)}</text>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">
  <rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>
  <g>
    ${paths.join("\n")}
  </g>
  ${metaText}
</svg>`;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function hashToInt(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function escapeXml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
