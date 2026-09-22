export function canFieldMerge(
  a: { speciesId: string; star: number },
  b: { speciesId: string; star: number },
): boolean {
  return a.speciesId === b.speciesId && a.star === b.star && a.star < 5;
}

export function nextStar(star: number): number {
  return Math.min(5, star + 1);
}
