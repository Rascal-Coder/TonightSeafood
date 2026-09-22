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
