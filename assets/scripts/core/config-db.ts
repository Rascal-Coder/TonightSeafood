export interface SeafoodLevel {
  star: number;
  name: string;
  damage: number;
  interval: number;
  range: number;
  displayScale: number;
  sprite: string;
}

export interface SeafoodDef {
  id: string;
  name: string;
  category: string;
  attackType: string;
  projectileSpeed: number;
  pierce: number;
  knockback: number;
  critRate: number;
  critDamage: number;
  targets: number;
  hitAir: boolean;
  projectileRadius: number;
  coneDeg: number;
  levels: SeafoodLevel[];
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  speed: number;
  armor: number;
  gold: number;
  radius: number;
  air: boolean;
  ability: string;
}

export interface BossPhase {
  enterBelow: number;
  skills: string[];
}

export interface BossDef {
  id: string;
  name: string;
  hp: number;
  armor: number;
  speed: number;
  radius: number;
  air?: boolean;
  phases: BossPhase[];
}

export interface UpgradeDef {
  id: string;
  name: string;
  rarity: string;
  desc: string;
  effects: { stat: string; op: string; value: number | boolean | object }[];
  flags?: string[];
}

export interface WaveGroup {
  id: string;
  count: number;
}

export interface WaveDef {
  wave: number;
  duration: number;
  hpMult: number;
  speedMult: number;
  groups: WaveGroup[];
  event: { type: string; options?: string[] };
}

export interface SlotDef {
  id: string;
  row: string;
  x: number;
  y: number;
  openAtSlotCount: number;
}

export interface LaneDef {
  id: "left" | "middle" | "right";
  minX: number;
  maxX: number;
  centerX: number;
}

export interface RecipeDef {
  id: string;
  name: string;
  mods: {
    dotDamage?: number;
    dotInterval?: number;
    dotDuration?: number;
    explodeEveryHits?: number;
    explodeRadius?: number;
    explodeDamageMul?: number;
    intervalMul?: number;
    chainEveryAttacks?: number;
    chainJumps?: number;
    chainDamageMul?: number[];
  };
}

export interface VendorDef {
  id: string;
  name: string;
  passive: string;
  active: { name: string; cooldown: number; rule: string };
}

export interface DemoDef {
  enabledSpecies: string[];
  enabledEnemies: string[];
  bossId: string;
  playWaves: number[];
  appendBossAfter: boolean;
  bossHpScale: number;
  recipesOffered: string[];
  draftIds: string[];
  vendorId: string;
}

export interface GameData {
  balance: {
    lantern: { max: number; leakDamage: number; bossLeakDamage: number; eliteLeakDamage: number };
    leakDistance: number;
    layout: {
      spawnLineY: number;
      leakLineY: number;
      battleZone: { x: number; y: number; w: number; h: number };
      pond: { x: number; y: number; w: number; h: number };
      lanes: LaneDef[];
      slots: SlotDef[];
    };
    pond: {
      capacity: number;
      initialCount?: number;
      spawnIntervalMin: number;
      spawnIntervalMax: number;
      maxSpeed: number;
      separateRadius: number;
    };
    net: { capacity: number; radius: number; cooldown: number; followLerp: number; maxCapacity: number;
      grazeCoverage: number; captureCoverage: number; bodyRadius: Record<string, number> };
    slots: { initial: number; max: number; snapRadius: number };
    tick: { logicDt: number; spatialCell: number };
    combat: { openingGraceSeconds?: number; hitStopMs: { heavy: number; boss: number } };
    feedback: {
      attackSeconds: number; anticipationSeconds: number; hitSeconds: number;
      recoilPixels: number; heavyRecoilPixels: number; shakeSeconds: number; shakePixels: number;
      crabFrameSeconds: number;
      idleFrameSeconds: number; mergeSeconds: number; catchSeconds: number;
      starColors: string[]; starFxScale: number[];
    };
  };
  seafood: SeafoodDef[];
  recipes: RecipeDef[];
  upgrades: UpgradeDef[];
  enemies: EnemyDef[];
  bosses: BossDef[];
  waves: { waves: WaveDef[] };
  vendors: VendorDef[];
  demo: DemoDef;
}

export class ConfigDB {
  readonly seafood = new Map<string, SeafoodDef>();
  readonly enemies = new Map<string, EnemyDef>();
  readonly bosses = new Map<string, BossDef>();
  readonly upgrades = new Map<string, UpgradeDef>();
  readonly recipes = new Map<string, RecipeDef>();
  readonly vendors = new Map<string, VendorDef>();

  constructor(readonly data: GameData) {
    for (const item of data.seafood) this.seafood.set(item.id, item);
    for (const item of data.enemies) this.enemies.set(item.id, item);
    for (const item of data.bosses) this.bosses.set(item.id, item);
    for (const item of data.upgrades) this.upgrades.set(item.id, item);
    for (const item of data.recipes) this.recipes.set(item.id, item);
    for (const item of data.vendors) this.vendors.set(item.id, item);
  }

  requireSeafood(id: string): SeafoodDef {
    const found = this.seafood.get(id);
    if (!found) throw new Error(`缺少海鲜配置 ${id}`);
    return found;
  }

  requireEnemy(id: string): EnemyDef {
    const found = this.enemies.get(id);
    if (!found) throw new Error(`缺少敌人配置 ${id}`);
    return found;
  }

  requireBoss(id: string): BossDef {
    const found = this.bosses.get(id);
    if (!found) throw new Error(`缺少 Boss 配置 ${id}`);
    return found;
  }

  requireUpgrade(id: string): UpgradeDef {
    const found = this.upgrades.get(id);
    if (!found) throw new Error(`缺少升级配置 ${id}`);
    return found;
  }

  requireRecipe(id: string): RecipeDef {
    const found = this.recipes.get(id);
    if (!found) throw new Error(`缺少料理配置 ${id}`);
    return found;
  }
}
