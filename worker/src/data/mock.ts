import type { Metrics } from "../artwork/generator";
import { hourKeyUtc } from "../util/id";

/**
 * MVP mock data.
 * - sample: stable within the same hour (idempotent-ish)
 * - preview: unique per request
 */
export function makeSampleMetrics(now = new Date()): Metrics {
  const hk = hourKeyUtc(now);
  const seed = `sample:${hk}`;
  const r = seeded(seed);
  return {
    seed,
    generated_at: now.toISOString(),
    sleep_score: Math.floor(60 + r() * 40),
    resting_hr: Math.floor(45 + r() * 35),
    steps: Math.floor(r() * 12000),
    note: "mock sample",
  };
}

export function makePreviewMetrics(seed: string, now = new Date()): Metrics {
  const r = seeded(seed);
  return {
    seed,
    generated_at: now.toISOString(),
    sleep_score: Math.floor(60 + r() * 40),
    resting_hr: Math.floor(45 + r() * 35),
    steps: Math.floor(r() * 12000),
    note: "mock preview",
  };
}

function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    // xorshift
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    // 0..1
    return ((h >>> 0) % 100000) / 100000;
  };
}
