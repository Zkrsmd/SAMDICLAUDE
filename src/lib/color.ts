/** Maps a hex colour to a coarse, human colour family used by listing filters. */
export function colorFamily(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l < 0.18) return 'black';
  if (s < 0.14) return l > 0.82 ? 'white' : 'grey';
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 12 || h >= 345) return 'red';
  if (h < 22) return 'coral';
  if (h < 40) return l < 0.45 ? 'brown' : 'orange';
  if (h < 52) return s < 0.6 ? 'gold' : 'orange';
  if (h < 68) return 'yellow';
  if (h < 160) return 'green';
  if (h < 195) return 'aqua';
  if (h < 250) return 'blue';
  if (h < 300) return 'purple';
  return 'pink';
}

export const FAMILY_SWATCH: Record<string, string> = {
  black: '#171A18',
  white: '#FFFFFF',
  grey: '#9AA19C',
  red: '#C8302E',
  coral: '#EE5A4E',
  orange: '#F36A32',
  brown: '#8B5A3C',
  gold: '#C8A451',
  yellow: '#F2C230',
  green: '#89C94A',
  aqua: '#64D7D1',
  blue: '#218FB0',
  purple: '#8B5CC9',
  pink: '#E58FB6',
};
