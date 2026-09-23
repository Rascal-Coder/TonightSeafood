export interface PondCritter {
  uid: number;
  speciesId: string;
  category: string;
  star: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  special?: "gold" | "mutant" | "seasoned" | "frozen" | "chest";
  recipeId?: string;
}

export interface ScoopUnit {
  speciesId: string;
  star: number;
  special?: PondCritter["special"];
  recipeId?: string;
  category: string;
}

export interface ScoopResult {
  units: ScoopUnit[];
  platter: boolean;
  seasoningCharge: number;
}

const MAX_STAR = 5;

/** Fraction of a critter's circular body covered by the net (not its sprite canvas). */
export function circleCoverage(distance: number, netRadius: number, bodyRadius: number): number {
  if (bodyRadius <= 0 || netRadius <= 0) return 0;
  if (distance >= netRadius + bodyRadius) return 0;
  if (distance <= Math.abs(netRadius - bodyRadius)) return Math.min(1, netRadius * netRadius / (bodyRadius * bodyRadius));
  const d = Math.max(distance, Number.EPSILON), r = bodyRadius, R = netRadius;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const area = r * r * Math.acos(clamp((d * d + r * r - R * R) / (2 * d * r)))
    + R * R * Math.acos(clamp((d * d + R * R - r * r) / (2 * d * R)))
    - Math.sqrt(Math.max(0, (-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R))) / 2;
  return Math.max(0, Math.min(1, area / (Math.PI * r * r)));
}

export function resolveScoop(caught: PondCritter[], pairStarBonus: number): ScoopResult {
  const groups = new Map<string, PondCritter[]>();
  const order: string[] = [];
  for (const critter of caught) {
    if (!groups.has(critter.speciesId)) {
      groups.set(critter.speciesId, []);
      order.push(critter.speciesId);
    }
    groups.get(critter.speciesId)!.push(critter);
  }

  const units: ScoopUnit[] = [];
  for (const speciesId of order) {
    const group = groups.get(speciesId)!;
    const maxStar = group.reduce((max, item) => Math.max(max, item.star), 1);
    let star = group.length === 1 ? group[0].star : Math.min(MAX_STAR, maxStar + group.length - 1);
    if (group.length === 2 && pairStarBonus > 0) {
      star = Math.min(MAX_STAR, star + pairStarBonus);
    }
    const donor = group[0];
    units.push({
      speciesId,
      star,
      special: donor.special,
      recipeId: donor.recipeId,
      category: donor.category,
    });
  }

  const species = new Set(caught.map((item) => item.speciesId));
  const platter = species.has("shrimp") && species.has("crab") && (species.has("oyster") || species.has("scallop"));
  const categories = new Set(caught.map((item) => item.category));
  return {
    units,
    platter,
    seasoningCharge: categories.size >= 3 ? 1 : 0,
  };
}
