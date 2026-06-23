import { lerp } from '../simulation';

export function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  };
  const ca = parse(a), cb = parse(b);
  const r  = Math.round(lerp(ca[0], cb[0], t));
  const g  = Math.round(lerp(ca[1], cb[1], t));
  const bl = Math.round(lerp(ca[2], cb[2], t));
  return `rgb(${r},${g},${bl})`;
}
