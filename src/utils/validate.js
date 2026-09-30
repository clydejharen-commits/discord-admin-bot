export function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function resolveColor(input) {
  if (!input) return null;

  const hexMatch = input.match(/^#?([0-9a-fA-F]{6})$/);
  if (hexMatch) {
    return parseInt(hexMatch[1], 16);
  }

  const intMatch = input.match(/^(\d+)$/);
  if (intMatch) {
    const num = parseInt(intMatch[1], 10);
    if (num >= 0 && num <= 0xffffff) return num;
  }

  return undefined;
}
