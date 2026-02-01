export function uuid(): string {
  return crypto.randomUUID();
}

export function hourKeyUtc(date = new Date()): string {
  // YYYY-MM-DDTHH (UTC)
  const iso = date.toISOString();
  return iso.slice(0, 13);
}
