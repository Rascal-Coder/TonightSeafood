import { applyArmor } from "./armor";
import { ConfigDB, type GameData, type SeafoodDef, type SlotDef, type WaveDef } from "./config-db";
import { canFieldMerge, nextStar } from "./merge";
import { circleCoverage, resolveScoop, type PondCritter } from "./scoop";
import { SpatialHash } from "./spatial";

export interface TrayItem {
  uid: number;
  speciesId: string;
  category: string;
  star: number;
}

export interface Deployed {
  uid: number;
  speciesId: string;
  category: string;
  star: number;
  slotId: string;
  x: number;
  y: number;
  recipeId: string | null;
  cooldown: number;
  attackCount: number;
  hitCounts: Map<number, number>;
  unanchored: boolean;
  reanchorIn: number;
  displayScale: number;
  mergeFlash: number;
}

export interface EnemyRt {
  uid: number;
  defId: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  armor: number;
  radius: number;
  air: boolean;
  gold: number;
  boss: boolean;
  leakDamage: number;
  parked: boolean;
  leakPulse: number;
  blockCd: number;
  blockLeft: number;
  summonCd: number;
  rollCd: number;
  rolling: number;
  rollTouched: Set<number>;
  slowLeft: number;
  slowMul: number;
  phase2: boolean;
  laneId: "left" | "middle" | "right" | null;
}

interface UnitDragState {
  uid: number;
  originSlotId: string;
  originX: number;
  originY: number;
  pushCooldowns: Map<number, number>;
}

export interface Shot {
  uid: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  maxHits: number;
  hit: Set<number>;
  kind: string;
  recipeId: string | null;
  ownerUid: number;
  speciesId: string;
  star: number;
  tint: string;
  starScale: number;
}

export interface BattleFx {
  type: string;
  x?: number;
  y?: number;
  text?: string;
  uid?: number;
  heavy?: boolean;
  directionX?: number;
  directionY?: number;
  speciesId?: string;
  star?: number;
  amount?: number;
  remaining?: number;
  combo?: number;
}

type Phase = "combat" | "draft" | "recipe" | "result";

interface Dot {
  enemyUid: number;
  raw: number;
  interval: number;
  acc: number;
  remain: number;
}

class Mods {
  private muls = new Map<string, number>();
  private adds = new Map<string, number>();

  absorb(effects: { stat: string; op: string; value: number | boolean | object }[]): void {
    for (const effect of effects) {
      if (effect.op === "mul") this.muls.set(effect.stat, (this.muls.get(effect.stat) ?? 1) * Number(effect.value));
      if (effect.op === "add") this.adds.set(effect.stat, (this.adds.get(effect.stat) ?? 0) + Number(effect.value));
    }
  }

  mul(stat: string): number {
    return this.muls.get(stat) ?? 1;
  }

  add(stat: string): number {
    return this.adds.get(stat) ?? 0;
  }
}

export class BattleWorld {
  readonly db: ConfigDB;
  phase: Phase = "combat";
  result: "win" | "lose" | null = null;
  lantern: number;
  gold = 0;
  fishbone = 0;
  seasoningCharge = 0;
  chainProcs = 0;
  waveNumber = 1;
  waveLabel = "1";
  recipeId: string | null = null;
  skillCd = 0;
  readonly skillName: string;
  readonly skillMaxCd: number;
  netX: number;
  netY: number;
  netCooldown = 0;
  draggingNet = false;
  pond: PondCritter[] = [];
  tray: TrayItem[] = [];
  seafood: Deployed[] = [];
  enemies: EnemyRt[] = [];
  shots: Shot[] = [];
  fx: BattleFx[] = [];
  tutorialDone = false;
  kills = 0;
  leaks = 0;
  lanternLost = 0;
  leakCombo = 0;
  leakComboWindow = 0;
  elapsed = 0;
  private movedNet = false;
  private merged = false;
  private attacked = false;
  private drafted = false;
  private pointerX = 0;
  private pointerY = 0;
  private travel = 0;
  private uid = 1;
  private mods = new Mods();
  private dots: Dot[] = [];
  private hitStop = 0;
  private pondTimer = 0.4;
  private waves: WaveDef[] = [];
  private waveIndex = 0;
  private waveTime = 0;
  private spawnQueue: { at: number; id: string }[] = [];
  private spawned = 0;
  private sandbox: boolean;
  private rng: () => number;
  private hash: SpatialHash<EnemyRt>;
  private unitDrag: UnitDragState | null = null;

  constructor(data: GameData, rng: () => number = Math.random, options?: { sandbox?: boolean }) {
    this.db = new ConfigDB(data);
    this.rng = rng;
    this.sandbox = options?.sandbox ?? false;
    this.lantern = data.balance.lantern.max;
    this.hash = new SpatialHash(data.balance.tick.spatialCell);
    const pond = data.balance.layout.pond;
    this.netX = pond.x + pond.w * 0.5;
    this.netY = pond.y + pond.h * 0.45;
    const vendor = data.vendors.find((item) => item.id === data.demo.vendorId) ?? data.vendors[0];
    this.skillName = vendor.active.name;
    this.skillMaxCd = vendor.active.cooldown;
    if (!this.sandbox) {
      this.prepareWaves();
      const count = Math.min(data.balance.pond.initialCount ?? 0, data.balance.pond.capacity);
      for (let i = 0; i < count; i++) {
        const species = i < 2 ? "shrimp" : data.demo.enabledSpecies[(i - 1) % data.demo.enabledSpecies.length];
        const x = i < 2 ? pond.x + pond.w / 2 + (i ? 28 : -28) : pond.x + 65 + ((i - 2) % 2) * (pond.w - 130);
        const y = pond.y + pond.h / 2 + (i >= 4 ? 35 : 0);
        this.addCritter(species, x, y);
      }
    }
  }

  get slotCount(): number {
    return Math.min(this.db.data.balance.slots.max, this.db.data.balance.slots.initial + this.mods.add("slot.countAdd"));
  }

  get waveProgress(): number {
    const wave = this.waves[this.waveIndex];
    return wave ? Math.min(1, this.waveTime / wave.duration) : 0;
  }

  get preparingSeconds(): number { return Math.max(0, Math.ceil(-this.waveTime)); }

  cancelPointer(): void { this.draggingNet = false; }

  /** Start the formal-night field drag. The unit remains in combat while held. */
  beginUnitDrag(uid: number): boolean {
    if (this.phase !== "combat" || this.unitDrag) return false;
    const unit = this.seafood.find((item) => item.uid === uid);
    if (!unit) return false;
    this.unitDrag = {
      uid,
      originSlotId: unit.slotId,
      originX: unit.x,
      originY: unit.y,
      pushCooldowns: new Map(),
    };
    return true;
  }

  /** Keep attack origin and collision body on the pointer while the player drags. */
  dragUnit(uid: number, x: number, y: number): boolean {
    if (this.phase !== "combat" || this.unitDrag?.uid !== uid) return false;
    const unit = this.seafood.find((item) => item.uid === uid);
    if (!unit) return false;
    const zone = this.db.data.balance.layout.battleZone;
    unit.x = Math.max(zone.x + 36, Math.min(zone.x + zone.w - 36, x));
    unit.y = Math.max(zone.y + 36, Math.min(zone.y + zone.h - 36, y));
    return true;
  }

  /** Resolve snap / merge / swap, or spring back to the original slot. */
  endUnitDrag(uid: number, x: number, y: number): boolean {
    const drag = this.unitDrag;
    const unit = this.seafood.find((item) => item.uid === uid);
    if (!drag || drag.uid !== uid || !unit) return false;
    const slot = nearest(this.openSlots(), x, y);
    const valid = slot && Math.hypot(slot.x - x, slot.y - y) <= this.db.data.balance.slots.snapRadius;
    if (!valid) {
      this.restoreDraggedUnit(unit, drag);
      this.unitDrag = null;
      return false;
    }
    const other = this.seafood.find((item) => item.uid !== uid && item.slotId === slot.id);
    if (other && canFieldMerge(unit, other)) {
      other.star = nextStar(other.star);
      other.displayScale = this.levelOf(other.speciesId, other.star).displayScale;
      other.mergeFlash = 0.12;
      this.seafood = this.seafood.filter((item) => item !== unit);
      this.merged = true;
      this.fx.push({ type: "merge", uid: other.uid, speciesId: other.speciesId, star: other.star, x: other.x, y: other.y, text: `${this.levelOf(other.speciesId, other.star).name} · ${other.star}星` });
    } else {
      if (other) {
        other.slotId = drag.originSlotId;
        other.x = drag.originX;
        other.y = drag.originY;
      }
      unit.slotId = slot.id;
      unit.x = slot.x;
      unit.y = slot.y;
      unit.recipeId = this.recipeId;
    }
    this.unitDrag = null;
    return true;
  }

  cancelUnitDrag(): void {
    if (!this.unitDrag) return;
    const unit = this.seafood.find((item) => item.uid === this.unitDrag!.uid);
    if (unit) this.restoreDraggedUnit(unit, this.unitDrag);
    this.unitDrag = null;
  }

  private restoreDraggedUnit(unit: Deployed, drag: UnitDragState): void {
    unit.slotId = drag.originSlotId;
    unit.x = drag.originX;
    unit.y = drag.originY;
  }

  mergeTray(sourceUid: number, targetUid: number): boolean {
    if (this.phase !== "combat" || sourceUid === targetUid) return false;
    const a = this.tray.find((u) => u.uid === sourceUid), b = this.tray.find((u) => u.uid === targetUid);
    if (!a || !b || !canFieldMerge(a, b)) return false;
    b.star = nextStar(b.star);
    this.tray = this.tray.filter((u) => u !== a);
    this.merged = true;
    this.fx.push({ type: "merge", uid: b.uid, speciesId: b.speciesId, star: b.star, x: 375, y: 370, text: `${this.levelOf(b.speciesId, b.star).name} · ${b.star}星` });
    return true;
  }

  /** Reposition an existing defender without taking it out of combat during the drag. */
  moveUnit(uid: number, x: number, y: number): boolean {
    if (this.phase !== "combat") return false;
    const unit = this.seafood.find((item) => item.uid === uid);
    const slot = nearest(this.openSlots(), x, y);
    if (!unit || !slot || Math.hypot(slot.x - x, slot.y - y) > this.db.data.balance.slots.snapRadius) return false;
    const other = this.seafood.find((item) => item.uid !== uid && item.slotId === slot.id);
    if (other && canFieldMerge(unit, other)) {
      other.star = nextStar(other.star);
      other.displayScale = this.levelOf(other.speciesId, other.star).displayScale;
      other.mergeFlash = 0.12;
      this.seafood = this.seafood.filter((item) => item !== unit);
      this.merged = true;
      this.fx.push({ type: "merge", uid: other.uid, speciesId: other.speciesId, star: other.star, x: other.x, y: other.y, text: `${this.levelOf(other.speciesId, other.star).name} · ${other.star}星` });
    } else {
      if (other) { other.slotId = unit.slotId; other.x = unit.x; other.y = unit.y; }
      unit.slotId = slot.id; unit.x = slot.x; unit.y = slot.y;
      unit.recipeId = this.recipeId;
    }
    return true;
  }

  get netRadius(): number {
    return this.db.data.balance.net.radius * this.mods.mul("net.radiusMul");
  }

  get netCapacity(): number {
    return Math.min(this.db.data.balance.net.maxCapacity, this.db.data.balance.net.capacity + this.mods.add("net.capacityAdd"));
  }

  openSlots(): SlotDef[] {
    return this.db.data.balance.layout.slots.filter((slot) => slot.openAtSlotCount <= this.slotCount);
  }

  tutorialText(): string | null {
    if (this.tutorialDone) return null;
    if (!this.movedNet) return "拖动捞网";
    if (!this.merged) return "捞两只一样的";
    if (!this.attacked) return "放到料理台";
    if (this.phase === "draft" && !this.drafted) return "选一个强化";
    return null;
  }

  pointerDown(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
    this.draggingNet = this.phase === "combat";
    this.travel = 0;
    if (this.draggingNet) this.positionNet(x, y);
  }

  pointerMove(x: number, y: number): void {
    if (!this.draggingNet) return;
    this.travel += Math.hypot(x - this.pointerX, y - this.pointerY);
    this.pointerX = x;
    this.pointerY = y;
    this.positionNet(x, y);
    if (this.travel > 40) this.movedNet = true;
  }

  private positionNet(x: number, y: number): void {
    const pond = this.db.data.balance.layout.pond;
    this.netX = Math.max(pond.x, Math.min(pond.x + pond.w, x));
    this.netY = Math.max(pond.y, Math.min(pond.y + pond.h, y));
  }

  /**
   * One coverage judgment for the net mouth.
   * Caught bodies are covered enough to scoop. Grazed bodies only brush the rim.
   * Preview and release both read this.
   */
  aimNet(): { caught: PondCritter[]; grazed: PondCritter[] } {
    const capture = this.db.data.balance.net.captureCoverage;
    const graze = this.db.data.balance.net.grazeCoverage ?? 0.08;
    const ranked = this.pond
      .map((critter) => ({
        critter,
        coverage: this.netCoverage(critter),
        dist: Math.hypot(critter.x - this.netX, critter.y - this.netY),
      }))
      .filter((item) => item.coverage >= graze)
      .sort((a, b) => a.dist - b.dist || a.critter.uid - b.critter.uid);
    const caught = ranked.filter((item) => item.coverage >= capture).slice(0, this.netCapacity).map((item) => item.critter);
    const caughtIds = new Set(caught.map((item) => item.uid));
    const grazed = ranked
      .filter((item) => item.coverage < capture && !caughtIds.has(item.critter.uid))
      .map((item) => item.critter);
    return { caught, grazed };
  }

  /** The exact, capacity-limited catch, shared by aim feedback and release. */
  previewScoop(): PondCritter[] {
    return this.aimNet().caught;
  }

  netCoverage(critter: PondCritter): number {
    return circleCoverage(Math.hypot(critter.x - this.netX, critter.y - this.netY), this.netRadius,
      this.db.data.balance.net.bodyRadius?.[critter.speciesId] ?? 25);
  }

  pointerUp(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
    if (!this.draggingNet) return;
    this.positionNet(x, y);
    this.draggingNet = false;
    if (this.phase !== "combat") return;
    if (this.netCooldown > 0) {
      this.fx.push({ type: "wobble", x: this.netX, y: this.netY });
      this.fx.push({ type: "toast", text: "捞网回收中，稍等一下" });
      return;
    }
    this.scoop();
  }

  dropTray(trayUid: number, x: number, y: number): boolean {
    if (this.phase !== "combat") return false;
    const index = this.tray.findIndex((item) => item.uid === trayUid);
    if (index < 0) return false;
    const item = this.tray[index];
    const snap = this.db.data.balance.slots.snapRadius;
    const occupied = this.seafood.filter((unit) => !unit.unanchored);
    const nearestUnit = nearest(occupied, x, y);
    if (nearestUnit && Math.hypot(nearestUnit.x - x, nearestUnit.y - y) <= snap) {
      if (canFieldMerge(item, nearestUnit)) {
        this.tray.splice(index, 1);
        nearestUnit.star = nextStar(nearestUnit.star);
        const level = this.levelOf(nearestUnit.speciesId, nearestUnit.star);
        nearestUnit.displayScale = level.displayScale;
        nearestUnit.mergeFlash = 0.12;
        this.merged = true;
        this.fx.push({ type: "merge", uid: nearestUnit.uid, speciesId: nearestUnit.speciesId, star: nearestUnit.star, x: nearestUnit.x, y: nearestUnit.y, text: `${level.name} · ${nearestUnit.star}星` });
        return true;
      }
      this.tray.splice(index, 1);
      this.tray.push({
        uid: this.nextUid(),
        speciesId: nearestUnit.speciesId,
        category: nearestUnit.category,
        star: nearestUnit.star,
      });
      this.writeUnit(nearestUnit, item);
      return true;
    }
    const empty = this.openSlots().filter((slot) => !occupied.some((unit) => unit.slotId === slot.id));
    const slot = nearest(empty, x, y);
    if (slot && Math.hypot(slot.x - x, slot.y - y) <= snap) {
      this.tray.splice(index, 1);
      this.spawnDeployed(item, slot);
      return true;
    }
    return false;
  }

  chooseUpgrade(id: string): void {
    if (this.phase !== "draft") return;
    if (!this.db.data.demo.draftIds.includes(id)) return;
    const upgrade = this.db.requireUpgrade(id);
    this.mods.absorb(upgrade.effects);
    this.drafted = true;
    this.tutorialDone = true;
    this.phase = "combat";
    this.fx.push({ type: "toast", text: upgrade.name });
    this.beginWave();
  }

  chooseRecipe(id: string): void {
    if (this.phase !== "recipe") return;
    if (!this.db.data.demo.recipesOffered.includes(id)) return;
    this.recipeId = id;
    this.phase = "combat";
    this.fx.push({ type: "toast", text: this.db.requireRecipe(id).name });
    this.beginWave();
  }

  castSkill(): boolean {
    if (this.phase !== "combat" || this.skillCd > 0) return false;
    this.skillCd = this.skillMaxCd;
    for (const enemy of this.enemies) {
      if (enemy.air) {
        enemy.slowLeft = 1.5;
        enemy.slowMul = 0.6;
      } else {
        enemy.y += 160;
      }
    }
    this.fx.push({ type: "wave", text: this.skillName });
    return true;
  }

  debugPlace(speciesId: string, star: number, slotId: string): Deployed {
    const slot = this.db.data.balance.layout.slots.find((item) => item.id === slotId);
    if (!slot) throw new Error(`缺少料理位 ${slotId}`);
    const species = this.db.requireSeafood(speciesId);
    const item: TrayItem = { uid: this.nextUid(), speciesId, category: species.category, star };
    return this.spawnDeployed(item, slot);
  }

  debugSpawnEnemy(id: string, x: number, y: number): EnemyRt {
    return this.spawnEnemy(id, x, y, 1, 1);
  }

  debugDefeatAll(): void {
    for (const enemy of [...this.enemies]) {
      if (enemy.hp > 0) this.kill(enemy);
    }
  }

  debugSetRecipe(id: string): void {
    this.recipeId = id;
    for (const unit of this.seafood) unit.recipeId = id;
  }

  drainFx(): BattleFx[] {
    const copy = this.fx;
    this.fx = [];
    return copy;
  }

  step(dt: number): void {
    let left = dt;
    while (left > 0) {
      const slice = Math.min(0.05, left);
      this.tick(slice);
      left -= slice;
    }
  }

  private prepareWaves(): void {
    const demo = this.db.data.demo;
    this.waves = demo.playWaves.map((number) => {
      const found = this.db.data.waves.waves.find((wave) => wave.wave === number);
      if (!found) throw new Error(`缺少波次 ${number}`);
      return {
        ...found,
        groups: found.groups.map((group) => {
          if (demo.enabledEnemies.includes(group.id)) return group;
          return { id: "E001", count: group.count };
        }),
      };
    });
    if (demo.appendBossAfter) {
      const last = this.waves[this.waves.length - 1];
      this.waves.push({
        wave: 18,
        duration: 70,
        hpMult: last?.hpMult ?? 1,
        speedMult: 1,
        groups: [{ id: demo.bossId, count: 1 }],
        event: { type: "boss" },
      });
    }
    this.waveIndex = 0;
    this.beginWave();
  }

  private beginWave(): void {
    if (this.waveIndex >= this.waves.length) return;
    const wave = this.waves[this.waveIndex];
    this.waveNumber = wave.wave;
    this.waveLabel = wave.event.type === "boss" ? "Boss" : String(wave.wave);
    this.waveTime = this.waveIndex === 0 ? -(this.db.data.balance.combat.openingGraceSeconds ?? 0) : 0;
    this.spawned = 0;
    this.spawnQueue = [];
    let cursor = 0;
    const total = wave.groups.reduce((sum, group) => sum + group.count, 0);
    const span = Math.max(0.2, wave.duration * 0.85);
    for (const group of wave.groups) {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push({ at: total <= 1 ? 0.2 : (cursor / total) * span, id: group.id });
        cursor++;
      }
    }
  }

  private tick(dt: number): void {
    if (this.phase !== "combat") return;
    this.elapsed += dt;
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      return;
    }
    this.skillCd = Math.max(0, this.skillCd - dt);
    this.netCooldown = Math.max(0, this.netCooldown - dt);
    this.leakComboWindow = Math.max(0, this.leakComboWindow - dt);
    if (this.leakComboWindow <= 0) this.leakCombo = 0;
    this.tickPond(dt);
    if (!this.sandbox) this.tickSpawns(dt);
    this.tickEnemies(dt);
    this.tickSeafood(dt);
    this.tickShots(dt);
    this.tickDots(dt);
    this.tickLantern();
    if (!this.sandbox) this.tickWaveEnd();
  }

  private tickPond(dt: number): void {
    const pond = this.db.data.balance.layout.pond;
    const left = pond.x + 36;
    const right = pond.x + pond.w - 36;
    const bottom = pond.y + 28;
    const top = pond.y + pond.h - 48;
    for (const critter of this.pond) {
      critter.x += (critter.vx ?? 0) * dt;
      critter.y += (critter.vy ?? 0) * dt;
      if (critter.x <= left || critter.x >= right) critter.vx = -(critter.vx ?? 0);
      if (critter.y <= bottom || critter.y >= top) critter.vy = -(critter.vy ?? 0);
      critter.x = clamp(critter.x, left, right);
      critter.y = clamp(critter.y, bottom, top);
    }
    const gap = this.db.data.balance.pond.separateRadius;
    for (let i = 0; i < this.pond.length; i++) {
      for (let j = i + 1; j < this.pond.length; j++) {
        const a = this.pond[i];
        const b = this.pond[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        if (dist < gap) {
          const push = (gap - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
    this.pondTimer -= dt;
    if (this.pondTimer > 0 || this.sandbox) return;
    this.pondTimer = lerp(this.db.data.balance.pond.spawnIntervalMin, this.db.data.balance.pond.spawnIntervalMax, this.rng());
    if (this.pond.length >= this.db.data.balance.pond.capacity) return;
    if (!this.merged && this.waveNumber < 2 && this.pond.length <= this.db.data.balance.pond.capacity - 2) {
      const midX = (left + right) / 2;
      const midY = (bottom + top) / 2;
      this.addCritter("shrimp", midX - 28, midY);
      this.addCritter("shrimp", midX + 28, midY);
      return;
    }
    this.addCritter(this.rollSpecies(), lerp(left, right, this.rng()), lerp(bottom, top, this.rng()));
  }

  private addCritter(speciesId: string, x: number, y: number): void {
    const species = this.db.requireSeafood(speciesId);
    this.pond.push({
      uid: this.nextUid(),
      speciesId,
      category: species.category,
      star: 1,
      x,
      y,
      vx: Math.cos(this.rng() * Math.PI * 2) * (18 + this.rng() * 14),
      vy: Math.sin(this.rng() * Math.PI * 2) * (12 + this.rng() * 10),
    });
  }

  private rollSpecies(): string {
    const roll = this.rng();
    if (roll < 0.5) return "shrimp";
    if (roll < 0.75) return "crab";
    if (roll < 0.9) return "scallop";
    return "fish";
  }

  private scoop(): void {
    const caught = this.previewScoop();
    if (caught.length === 0) {
      this.fx.push({ type: "wobble", x: this.netX, y: this.netY });
      this.fx.push({ type: "toast", text: "空网啦，把海鲜圈进网里再松手" });
      return;
    }
    const ids = new Set(caught.map((item) => item.uid));
    this.pond = this.pond.filter((item) => !ids.has(item.uid));
    const result = resolveScoop(caught, this.mods.add("scoop.pairStarBonus"));
    for (const unit of result.units) {
      this.tray.push({
        uid: this.nextUid(),
        speciesId: unit.speciesId,
        category: unit.category,
        star: unit.star,
      });
      if (unit.star >= 2) this.merged = true;
    }
    if (result.platter) {
      this.gold += 8;
      this.fx.push({ type: "toast", x: this.netX, y: this.netY, text: "海鲜拼盘" });
    }
    if (result.seasoningCharge > 0) {
      this.seasoningCharge += result.seasoningCharge;
      this.fx.push({ type: "toast", x: this.netX, y: this.netY, text: "多了一味调料" });
    }
    this.netCooldown = this.db.data.balance.net.cooldown;
    this.fx.push({ type: "splash", x: this.netX, y: this.netY, text: `捞起 ${caught.length} 只` });
  }

  private tickSpawns(dt: number): void {
    this.waveTime += dt;
    const ready = this.spawnQueue.filter((item) => item.at <= this.waveTime);
    this.spawnQueue = this.spawnQueue.filter((item) => item.at > this.waveTime);
    const wave = this.waves[this.waveIndex];
    for (const item of ready) {
      const lanes = this.db.data.balance.layout.lanes;
      const lane = lanes[Math.min(lanes.length - 1, Math.floor(this.rng() * lanes.length))];
      const x = lane.minX + this.rng() * (lane.maxX - lane.minX);
      if (item.id.startsWith("S")) this.spawnBoss(item.id, x);
      else this.spawnEnemy(item.id, x, this.db.data.balance.layout.spawnLineY, wave.hpMult, wave.speedMult, lane.id);
      this.spawned++;
    }
  }

  private spawnEnemy(id: string, x: number, y: number, hpMult: number, speedMult: number,
    laneId: EnemyRt["laneId"] = null): EnemyRt {
    const def = this.db.requireEnemy(id);
    const waveBonus = 1 + (Math.max(1, this.waveNumber) - 1) * 0.08;
    const enemy: EnemyRt = {
      uid: this.nextUid(),
      defId: def.id,
      name: def.name,
      x,
      y,
      hp: def.hp * hpMult,
      maxHp: def.hp * hpMult,
      speed: def.speed * speedMult,
      armor: def.armor,
      radius: def.radius,
      air: def.air,
      gold: Math.round(def.gold * waveBonus),
      boss: false,
      leakDamage: id.startsWith("L")
        ? this.db.data.balance.lantern.eliteLeakDamage
        : this.db.data.balance.lantern.leakDamage,
      parked: false,
      leakPulse: 2,
      blockCd: 8,
      blockLeft: 0,
      summonCd: 10,
      rollCd: 6,
      rolling: 0,
      rollTouched: new Set(),
      slowLeft: 0,
      slowMul: 1,
      phase2: false,
      laneId: laneId ?? this.nearestLaneId(x),
    };
    this.enemies.push(enemy);
    return enemy;
  }

  private spawnBoss(id: string, x: number): void {
    const def = this.db.requireBoss(id);
    const hp = def.hp * this.db.data.demo.bossHpScale;
    this.enemies.push({
      uid: this.nextUid(),
      defId: def.id,
      name: def.name,
      x,
      y: this.db.data.balance.layout.spawnLineY,
      hp,
      maxHp: hp,
      speed: def.speed,
      armor: def.armor,
      radius: def.radius,
      air: Boolean(def.air),
      gold: 15,
      boss: true,
      leakDamage: this.db.data.balance.lantern.bossLeakDamage,
      parked: false,
      leakPulse: 2,
      blockCd: 1,
      blockLeft: 0,
      summonCd: 10,
      rollCd: 4,
      rolling: 0,
      rollTouched: new Set(),
      slowLeft: 0,
      slowMul: 1,
      phase2: false,
      laneId: this.nearestLaneId(x),
    });
  }

  private nearestLaneId(x: number): EnemyRt["laneId"] {
    let best = this.db.data.balance.layout.lanes[0];
    for (const lane of this.db.data.balance.layout.lanes) {
      if (!best || Math.abs(lane.centerX - x) < Math.abs(best.centerX - x)) best = lane;
    }
    return best?.id ?? null;
  }

  private tickEnemies(dt: number): void {
    const leakY = this.db.data.balance.layout.leakLineY;
    for (const enemy of [...this.enemies]) {
      if (enemy.slowLeft > 0) enemy.slowLeft = Math.max(0, enemy.slowLeft - dt);
      const slow = enemy.slowLeft > 0 ? enemy.slowMul : 1;
      if (enemy.boss) this.tickBoss(enemy, dt);
      const speed = (enemy.rolling > 0 ? 220 : enemy.speed) * slow;
      if (!enemy.parked) enemy.y -= speed * dt;
      if (enemy.boss && enemy.y <= leakY + enemy.radius) {
        enemy.y = leakY + enemy.radius;
        enemy.parked = true;
        enemy.leakPulse -= dt;
        if (enemy.leakPulse <= 0) {
          enemy.leakPulse = 2;
          this.damagePot(enemy.leakDamage, enemy.x, false);
        }
      }
      if (enemy.rolling > 0) {
        enemy.rolling = Math.max(0, enemy.rolling - dt);
        for (const unit of this.seafood) {
          if (enemy.rollTouched.has(unit.uid)) continue;
          if (Math.hypot(unit.x - enemy.x, unit.y - enemy.y) > enemy.radius + 28) continue;
          enemy.rollTouched.add(unit.uid);
          unit.y -= 36;
          unit.unanchored = true;
          unit.reanchorIn = 0.4;
          this.fx.push({ type: "push", x: unit.x, y: unit.y });
        }
      }
    }
    this.tickDraggedUnitPush(dt);
    for (const unit of this.seafood) {
      if (!unit.unanchored) continue;
      unit.reanchorIn -= dt;
      if (unit.reanchorIn > 0) continue;
      const taken = new Set(this.seafood.filter((other) => other !== unit && !other.unanchored).map((other) => other.slotId));
      const slot = nearest(this.openSlots().filter((item) => !taken.has(item.id)), unit.x, unit.y);
      if (slot) {
        unit.slotId = slot.id;
        unit.x = slot.x;
        unit.y = slot.y;
      }
      unit.unanchored = false;
    }
  }

  private tickDraggedUnitPush(dt: number): void {
    const drag = this.unitDrag;
    if (!drag) return;
    for (const [uid, left] of drag.pushCooldowns) {
      const next = left - dt;
      if (next <= 0) drag.pushCooldowns.delete(uid);
      else drag.pushCooldowns.set(uid, next);
    }
    const unit = this.seafood.find((item) => item.uid === drag.uid);
    if (!unit) return;
    for (const enemy of this.enemies) {
      if (enemy.air || enemy.defId === "E012" || drag.pushCooldowns.has(enemy.uid)) continue;
      if (Math.hypot(unit.x - enemy.x, unit.y - enemy.y) > enemy.radius + 32) continue;
      const push = 48 * (enemy.boss ? 0.35 : 1);
      enemy.y = Math.min(this.db.data.balance.layout.spawnLineY, enemy.y + push);
      drag.pushCooldowns.set(enemy.uid, 0.35);
      this.fx.push({ type: "push", uid: enemy.uid, x: enemy.x, y: enemy.y, directionY: 1 });
    }
  }

  private tickBoss(enemy: EnemyRt, dt: number): void {
    enemy.blockCd -= dt;
    if (enemy.blockCd <= 0) {
      enemy.blockLeft = 2.5;
      enemy.blockCd = 8;
      this.fx.push({ type: "toast", text: "桶盖格挡" });
    }
    if (enemy.blockLeft > 0) enemy.blockLeft = Math.max(0, enemy.blockLeft - dt);
    enemy.summonCd -= dt;
    if (enemy.summonCd <= 0) {
      enemy.summonCd = 10;
      for (let i = 0; i < 4; i++) this.spawnEnemy("E001", enemy.x - 60 + i * 40, enemy.y, 1, 1);
    }
    if (!enemy.phase2 && enemy.hp <= enemy.maxHp * 0.5) enemy.phase2 = true;
    if (!enemy.phase2) return;
    enemy.rollCd -= dt;
    if (enemy.rolling <= 0 && enemy.rollCd <= 0) {
      enemy.rolling = 0.7;
      enemy.rollCd = 6;
      enemy.rollTouched.clear();
      this.hitStop = Math.max(this.hitStop, this.db.data.balance.combat.hitStopMs.boss / 1000);
      this.fx.push({ type: "toast", text: "滚桶" });
    }
  }

  private tickSeafood(dt: number): void {
    this.hash.clear();
    for (const enemy of this.enemies) this.hash.insert(enemy);
    for (const unit of this.seafood) {
      if (unit.mergeFlash > 0) unit.mergeFlash = Math.max(0, unit.mergeFlash - dt);
      unit.cooldown -= dt;
      if (unit.cooldown > 0) continue;
      const species = this.db.requireSeafood(unit.speciesId);
      const level = this.levelOf(unit.speciesId, unit.star);
      const recipe = unit.recipeId ? this.db.requireRecipe(unit.recipeId) : null;
      let interval = level.interval * (recipe?.mods.intervalMul ?? 1);
      if (unit.speciesId === "shrimp") interval *= this.mods.mul("species.shrimp.intervalMul");
      const target = this.pickTarget(unit, species, level.range);
      if (!target) continue;
      unit.cooldown = interval;
      unit.attackCount++;
      this.fx.push({ type: "attack", uid: unit.uid, speciesId: unit.speciesId, star: unit.star, x: unit.x, y: unit.y });
      this.attacked = true;
      this.fire(unit, species, level.damage, level.range, target);
      if (recipe?.id === "C002" && unit.attackCount % (recipe.mods.chainEveryAttacks ?? 5) === 0) {
        const signature = unit.speciesId === "shrimp";
        const jumps = signature ? 3 : recipe.mods.chainJumps ?? 2;
        const coeffs = signature ? [0.7, 0.5, 0.35] : recipe.mods.chainDamageMul ?? [0.7, 0.5];
        this.chain(target, level.damage, jumps, coeffs);
      }
    }
  }

  private pickTarget(unit: Deployed, species: SeafoodDef, range: number): EnemyRt | null {
    let best: EnemyRt | null = null;
    let bestDist = range;
    for (const enemy of this.hash.queryRadius(unit.x, unit.y, range)) {
      if (enemy.air && !species.hitAir) continue;
      const dist = Math.hypot(enemy.x - unit.x, enemy.y - unit.y);
      if (dist <= bestDist) {
        best = enemy;
        bestDist = dist;
      }
    }
    return best;
  }

  private fire(unit: Deployed, species: SeafoodDef, damage: number, range: number, target: EnemyRt): void {
    const rolled = this.rollDamage(species, damage);
    const knock = species.knockback + (unit.speciesId === "crab" ? this.mods.add("species.crab.knockbackAdd") : 0);
    if (species.attackType === "claw") {
      if (target.air && !species.hitAir) return;
      this.hurt(target, rolled, unit.recipeId, unit, knock, false);
      this.hitStop = Math.max(this.hitStop, this.db.data.balance.combat.hitStopMs.heavy / 1000);
      this.fx.push({ type: "claw", x: target.x, y: target.y, speciesId: unit.speciesId, star: unit.star, uid: unit.uid });
      return;
    }
    if (species.attackType === "fan") {
      const half = ((species.coneDeg || 72) * Math.PI) / 180 / 2;
      for (const enemy of this.enemies) {
        if (enemy.air && !species.hitAir) continue;
        const dx = enemy.x - unit.x;
        const dy = enemy.y - unit.y;
        const dist = Math.hypot(dx, dy);
        if (dist > range || dist === 0) continue;
        const angle = Math.acos(clamp(dy / dist, -1, 1));
        if (angle <= half) this.hurt(enemy, rolled, unit.recipeId, unit, species.knockback, false);
      }
      this.fx.push({ type: "fan", x: unit.x, y: unit.y, speciesId: unit.speciesId, star: unit.star, uid: unit.uid });
      return;
    }
    const look = this.starLook(unit.star);
    const dist = Math.hypot(target.x - unit.x, target.y - unit.y) || 1;
    const speed = species.projectileSpeed || 480;
    this.shots.push({
      uid: this.nextUid(),
      x: unit.x,
      y: unit.y + 20,
      vx: ((target.x - unit.x) / dist) * speed,
      vy: ((target.y - unit.y) / dist) * speed,
      damage: rolled,
      radius: (species.projectileRadius || 10) * look.starScale,
      maxHits: species.pierce > 0 ? species.pierce : 1,
      hit: new Set(),
      kind: species.attackType,
      recipeId: unit.recipeId,
      ownerUid: unit.uid,
      speciesId: unit.speciesId,
      star: unit.star,
      tint: look.tint,
      starScale: look.starScale,
    });
  }

  private starLook(star: number): { tint: string; starScale: number } {
    const feel = this.db.data.balance.feedback;
    const index = Math.max(0, Math.min(4, star - 1));
    const colors = feel.starColors ?? ["#f5ddb0", "#8fdfbd", "#77ccff", "#ce9bff", "#ffd26c"];
    const scales = feel.starFxScale ?? [1, 1.12, 1.3, 1.5, 1.75];
    return { tint: colors[index] ?? "#fff1c3", starScale: scales[index] ?? 1 };
  }

  private chain(from: EnemyRt, damage: number, jumps: number, coeffs: number[]): void {
    this.chainProcs++;
    let previous = from;
    const used = new Set<number>([from.uid]);
    for (let i = 0; i < jumps; i++) {
      let next: EnemyRt | null = null;
      let best = 180;
      for (const enemy of this.enemies) {
        if (used.has(enemy.uid) || enemy.hp <= 0) continue;
        const dist = Math.hypot(enemy.x - previous.x, enemy.y - previous.y);
        if (dist < best) {
          best = dist;
          next = enemy;
        }
      }
      if (!next) break;
      used.add(next.uid);
      const raw = damage * (coeffs[i] ?? coeffs[coeffs.length - 1] ?? 0.5);
      this.hurt(next, raw, "C002", null, 0, false);
      this.fx.push({ type: "chili", x: next.x, y: next.y });
      previous = next;
    }
  }

  private rollDamage(species: SeafoodDef, damage: number): number {
    if (this.rng() < species.critRate) return damage * species.critDamage;
    return damage;
  }

  private hurt(
    enemy: EnemyRt,
    raw: number,
    recipeId: string | null,
    source: Deployed | null,
    knockback: number,
    dot: boolean,
  ): void {
    let amount = raw;
    if (enemy.boss && enemy.blockLeft > 0 && (!source || source.y < enemy.y)) amount *= 0.6;
    const dealt = applyArmor(amount, enemy.armor, dot);
    enemy.hp -= dealt;
    if (knockback > 0 && !enemy.boss) enemy.y += knockback;
    this.fx.push({
      type: "hit",
      x: enemy.x,
      y: enemy.y,
      text: String(Math.round(dealt)),
      uid: enemy.uid,
      heavy: !dot && source?.speciesId === "crab",
      speciesId: source?.speciesId,
      star: source?.star ?? 1,
      directionX: source ? enemy.x - source.x : 0,
      directionY: source ? enemy.y - source.y : 1,
    });
    if (recipeId === "C001" && source) {
      const recipe = this.db.requireRecipe("C001");
      this.dots.push({
        enemyUid: enemy.uid,
        raw: recipe.mods.dotDamage ?? 3,
        interval: recipe.mods.dotInterval ?? 0.5,
        acc: 0,
        remain: recipe.mods.dotDuration ?? 2,
      });
      const hits = (source.hitCounts.get(enemy.uid) ?? 0) + 1;
      source.hitCounts.set(enemy.uid, hits);
      if (hits % (recipe.mods.explodeEveryHits ?? 4) === 0) {
        const radius = (recipe.mods.explodeRadius ?? 48) * this.starLook(source.star).starScale;
        const boom = raw * (recipe.mods.explodeDamageMul ?? 0.4);
        for (const other of this.enemies) {
          if (Math.hypot(other.x - enemy.x, other.y - enemy.y) <= radius) {
            other.hp -= applyArmor(boom, other.armor, false);
          }
        }
        this.fx.push({ type: "garlic", x: enemy.x, y: enemy.y, speciesId: source.speciesId, star: source.star, uid: source.uid });
      }
    }
    if (enemy.hp <= 0) this.kill(enemy);
  }

  private kill(enemy: EnemyRt): void {
    if (!this.enemies.includes(enemy)) return;
    this.kills++;
    this.gold += enemy.gold;
    this.enemies = this.enemies.filter((item) => item.uid !== enemy.uid);
    this.dots = this.dots.filter((dot) => dot.enemyUid !== enemy.uid);
    this.fx.push({ type: "death", x: enemy.x, y: enemy.y, text: enemy.boss ? "收摊胜利" : `+${enemy.gold}` });
    if (enemy.boss) {
      this.fishbone += 8;
      this.finish("win");
    }
  }

  private tickShots(dt: number): void {
    for (const shot of this.shots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      for (const enemy of this.enemies) {
        if (shot.hit.has(enemy.uid)) continue;
        if (Math.hypot(enemy.x - shot.x, enemy.y - shot.y) > shot.radius + enemy.radius) continue;
        shot.hit.add(enemy.uid);
        const owner = this.seafood.find((unit) => unit.uid === shot.ownerUid) ?? null;
        this.hurt(enemy, shot.damage, shot.recipeId, owner, 0, false);
        if (shot.hit.size >= shot.maxHits) break;
      }
    }
    this.shots = this.shots.filter((shot) => shot.hit.size < shot.maxHits && shot.y < 1400 && shot.y > -40 && shot.x > -100 && shot.x < 850);
  }

  private tickDots(dt: number): void {
    for (const dot of this.dots) {
      dot.remain -= dt;
      dot.acc += dt;
      if (dot.acc < dot.interval) continue;
      dot.acc = 0;
      const enemy = this.enemies.find((item) => item.uid === dot.enemyUid);
      if (!enemy) continue;
      this.hurt(enemy, dot.raw, null, null, 0, true);
    }
    this.dots = this.dots.filter((dot) => dot.remain > 0);
  }

  private tickLantern(): void {
    const leakY = this.db.data.balance.layout.leakLineY;
    const alive: EnemyRt[] = [];
    for (const enemy of this.enemies) {
      if (!enemy.boss && enemy.y - enemy.radius <= leakY) {
        this.damagePot(enemy.leakDamage, enemy.x, true);
        continue;
      }
      alive.push(enemy);
    }
    this.enemies = alive;
  }

  private damagePot(amount: number, x: number, countLeak: boolean): void {
    if (countLeak) this.leaks++;
    this.lanternLost += amount;
    this.leakCombo = this.leakComboWindow > 0 ? this.leakCombo + 1 : 1;
    this.leakComboWindow = 1.5;
    this.lantern = Math.max(0, this.lantern - amount);
    this.fx.push({
      type: "leak",
      x,
      y: this.db.data.balance.layout.leakLineY,
      text: `-${amount}`,
      amount,
      remaining: this.lantern,
      combo: this.leakCombo,
    });
    if (this.lantern <= 0) this.finish("lose");
  }

  private tickWaveEnd(): void {
    if (this.phase !== "combat") return;
    const wave = this.waves[this.waveIndex];
    if (!wave) return;
    if (wave.event.type === "boss") return;
    if (this.spawnQueue.length > 0) return;
    const planned = wave.groups.reduce((sum, group) => sum + group.count, 0);
    if (this.spawned < planned || this.enemies.length > 0) return;
    this.fishbone += 2;
    this.waveIndex++;
    if (this.waveIndex >= this.waves.length) { this.finish("win"); return; }
    const event = wave.event.type;
    if (event === "draft") {
      this.phase = "draft";
      this.fx.push({ type: "draft" });
      return;
    }
    if (event === "recipeOffer") {
      this.phase = "recipe";
      this.fx.push({ type: "recipe" });
      return;
    }
    this.beginWave();
  }

  private finish(result: "win" | "lose"): void {
    if (this.phase === "result") return;
    this.phase = "result";
    this.result = result;
    this.fx.push({ type: "result", text: result === "win" ? "锅还烧着，收摊！" : "锅灭了" });
  }

  private spawnDeployed(item: TrayItem, slot: SlotDef): Deployed {
    const level = this.levelOf(item.speciesId, item.star);
    const unit: Deployed = {
      uid: this.nextUid(),
      speciesId: item.speciesId,
      category: item.category,
      star: item.star,
      slotId: slot.id,
      x: slot.x,
      y: slot.y,
      recipeId: this.recipeId,
      cooldown: 0.2,
      attackCount: 0,
      hitCounts: new Map(),
      unanchored: false,
      reanchorIn: 0,
      displayScale: level.displayScale,
      mergeFlash: 0,
    };
    this.seafood.push(unit);
    return unit;
  }

  private writeUnit(unit: Deployed, item: TrayItem): void {
    const level = this.levelOf(item.speciesId, item.star);
    unit.speciesId = item.speciesId;
    unit.category = item.category;
    unit.star = item.star;
    unit.recipeId = this.recipeId;
    unit.displayScale = level.displayScale;
    unit.attackCount = 0;
    unit.hitCounts.clear();
  }

  private levelOf(speciesId: string, star: number) {
    const species = this.db.requireSeafood(speciesId);
    const level = species.levels.find((item) => item.star === star);
    if (!level) throw new Error(`${speciesId} 没有 ${star} 星`);
    return level;
  }

  private nextUid(): number {
    this.uid += 1;
    return this.uid;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function nearest<T extends { x: number; y: number }>(items: T[], x: number, y: number): T | null {
  let best: T | null = null;
  let dist = Infinity;
  for (const item of items) {
    const d = Math.hypot(item.x - x, item.y - y);
    if (d < dist) {
      dist = d;
      best = item;
    }
  }
  return best;
}
