export function applyArmor(raw: number, armor: number, dot: boolean): number {
  const soaked = dot ? armor * 0.5 : armor;
  return Math.max(1, raw - soaked);
}
