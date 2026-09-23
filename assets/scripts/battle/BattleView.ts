import { Node, type SpriteFrame } from "cc";
import type { BattleFx, BattleWorld, Deployed, EnemyRt } from "../core/battle-world";
import type { BattleArt } from "./BattleArt";
import { BattlePainter } from "./BattlePainter";
import { SpineProjectiles } from "./SpineProjectiles";
import { frameTween } from "./PresentationMotion";

export type Screen = "home" | "play" | "pause";
export interface Drag { kind: "tray" | "unit"; uid: number; speciesId: string; star: number; x: number; y: number }
interface Hit { id: string; x: number; y: number; w: number; h: number }
interface Puff extends BattleFx { age: number }
const names: Record<string, string> = { shrimp: "快射虾", crab: "重钳蟹", scallop: "散射贝", fish: "穿透鱼" };

export class BattleView {
  private stage: BattlePainter;
  private ground: BattlePainter;
  private backAtmosphere: BattlePainter;
  private water: BattlePainter;
  private net: BattlePainter;
  private effects: BattlePainter;
  private frontAtmosphere: BattlePainter;
  private heldItem: BattlePainter;
  private hud: BattlePainter;
  private overlay: BattlePainter;
  private spine: SpineProjectiles;
  private hits: Hit[] = [];
  private puffs: Puff[] = [];
  private toast = "";
  private toastLeft = 0;
  private clock = 0;
  private netHint = "";
  trayPage = 0;
  constructor(root: Node, private art: BattleArt) {
    const bg = new BattlePainter(root, "Board", 1, 0);
    bg.begin(); bg.sprite(art.board, 375, 667, 750, 1334); bg.end();
    this.backAtmosphere = new BattlePainter(root, "BackAtmosphere", 0, 0);
    this.ground = new BattlePainter(root, "GroundAndSlots", 12, 12);
    this.stage = new BattlePainter(root, "DepthSortedActors", 150, 60);
    this.spine = new SpineProjectiles(root, art.bullets);
    this.frontAtmosphere = new BattlePainter(root, "ForegroundOccluders", 0, 0);
    this.water = new BattlePainter(root, "PondCreatures", 20, 0);
    this.net = new BattlePainter(root, "NetAndCatchPreview", 4, 10);
    this.effects = new BattlePainter(root, "ImpactAndCatchEffects", 24, 65);
    this.hud = new BattlePainter(root, "Interface", 28, 50);
    this.heldItem = new BattlePainter(root, "DraggedItem", 1, 1);
    this.overlay = new BattlePainter(root, "Overlay", 12, 35);
  }
  actionAt(x: number, y: number): string | null {
    return [...this.hits].reverse().find((h) => Math.abs(x - h.x) <= h.w / 2 && Math.abs(y - h.y) <= h.h / 2)?.id ?? null;
  }
  trayAt(world: BattleWorld, x: number, y: number): number | null {
    if (Math.abs(y - 370) > 42) return null;
    const i = Math.round((x - 135) / 96);
    return i >= 0 && i < 5 && Math.abs(x - (135 + i * 96)) <= 43 ? world.tray[this.trayPage * 5 + i]?.uid ?? null : null;
  }
  notify(message: string): void { this.toast = message; this.toastLeft = 2.5; }
  reset(): void { this.puffs = []; this.trayPage = 0; this.toastLeft = 0; this.spine.sync([], false); }
  render(w: BattleWorld, screen: Screen, drag: Drag | null, dt: number, muted: boolean): void {
    if (screen === "play" && w.phase === "combat" || screen === "home") this.clock += dt;
    this.hits = [];
    if (screen === "play") {
      this.puffs.forEach((f) => f.age += dt);
      this.puffs = this.puffs.filter((f) => f.age < (f.type === "leak" ? 1.15 : f.type === "merge" ? 0.75 : 0.65));
      for (const fx of w.drainFx()) {
        if (fx.type === "toast") this.notify(fx.text ?? "");
        else this.puffs.push({ ...fx, age: 0 });
      }
      this.puffs = this.puffs.slice(-60);
      this.toastLeft = Math.max(0, this.toastLeft - dt);
    }
    this.drawWorld(w, drag);
    this.spine.sync(screen === "home" ? [] : w.shots, screen !== "play" || w.phase !== "combat");
    this.drawHud(w, screen, muted);
    this.drawOverlay(w, screen);
  }
  private button(p: BattlePainter, id: string, text: string, x: number, y: number, width: number, color = "#d86545", height = 66): void {
    p.box(x, y - 5, width, height, "#362e29", "#362e29", 15);
    p.box(x, y, width, height, color, "#392d27", 15);
    p.text(text, x, y + 1, 27, "#fff3d7", width - 12);
    this.hits.push({ id, x, y, w: width, h: height });
  }
  private latestLoose(type: string): Puff | undefined {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      if (this.puffs[i].type === type && this.puffs[i].age < 0.65) return this.puffs[i];
    }
    return undefined;
  }
  private starLook(w: BattleWorld, star = 1): { tint: string; scale: number } {
    const feel = w.db.data.balance.feedback;
    const index = Math.max(0, Math.min(4, star - 1));
    const colors = feel.starColors ?? ["#f5ddb0", "#8fdfbd", "#77ccff", "#ce9bff", "#ffd26c"];
    const scales = feel.starFxScale ?? [1, 1.12, 1.3, 1.5, 1.75];
    return { tint: colors[index] ?? "#fff1c3", scale: scales[index] ?? 1 };
  }
  private latestFx(type: string, uid: number, duration: number): Puff | undefined {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const f = this.puffs[i];
      if (f.type === type && f.uid === uid && f.age < duration) return f;
    }
    return undefined;
  }
  private idleFrames(speciesId: string, star = 1): SpriteFrame[] {
    const forms = this.art.starIdle[speciesId];
    const frames = forms?.[Math.max(0, Math.min(forms.length - 1, star - 1))];
    return frames?.length ? frames : [this.art.crew[speciesId]];
  }
  private idleFrame(speciesId: string, star = 1, uid = 0): SpriteFrame {
    const frames = this.idleFrames(speciesId, star);
    return frames[frameTween(this.clock, uid, frames.length, 0.3).from];
  }
  private idleSprite(
    p: BattlePainter,
    w: BattleWorld,
    speciesId: string,
    star: number,
    uid: number,
    x: number,
    y: number,
    width: number,
    height = width,
    angle = 0,
    tint = "#ffffff",
  ): void {
    const frames = this.idleFrames(speciesId, star);
    const tween = frameTween(this.clock, uid, frames.length, w.db.data.balance.feedback.idleFrameSeconds);
    const bridge = tween.bridge;
    const tw = width * (1 + bridge * 0.025);
    const th = height * (1 - bridge * 0.018);
    const ty = y + bridge * 1.5;
    if (tween.mix < 0.995) p.sprite(frames[tween.from], x, ty, tw, th, angle - bridge * 1.2, tint, 1 - tween.mix);
    if (tween.mix > 0.005) p.sprite(frames[tween.to], x, ty, tw, th, angle + bridge * 1.2, tint, tween.mix);
  }
  private drawSceneDepth(w: BattleWorld, drag: Drag | null): void {
    const focusX = drag?.x ?? w.netX;
    const parallax = Math.max(-1, Math.min(1, (focusX - 375) / 340));
    let p = this.backAtmosphere; p.begin();
    // Three independent pools make the formal-night lanes readable without painting them into the board.
    [205, 375, 545].forEach((x, index) => {
      const pulse = 0.92 + Math.sin(this.clock * 0.8 + index * 1.7) * 0.08;
      p.oval(x, 745, 112 * pulse, 315, "#f6bd6630", "#f6bd6600", 0);
      p.oval(x, 740, 78 * pulse, 290, "#fff0b31a", "#fff0b300", 0);
    });
    for (let i = 0; i < 7; i++) {
      const phase = (this.clock * (9 + i) + i * 41) % 230;
      const x = 82 + ((i * 97 + phase * 0.7) % 585);
      const y = 92 + ((i * 53 + phase) % 165);
      p.oval(x, y, 10 + (i % 3) * 4, 4 + (i % 2) * 2, "#baf8ed18", "#d9fff04a", 1);
    }
    p.end();
    this.backAtmosphere.node.setPosition(-parallax * 3, 0);

    p = this.frontAtmosphere; p.begin();
    const heat = 0.78 + Math.sin(this.clock * 1.6) * 0.16;
    for (let i = 0; i < 4; i++) {
      const rise = (this.clock * (22 + i * 4) + i * 37) % 115;
      const sway = Math.sin(this.clock * 1.8 + i * 1.9) * (10 + i * 2);
      p.oval(345 + i * 20 + sway, 438 + rise, 9 + rise * 0.08, 16 + rise * 0.13, "#fff2cf10", "#fff3d02b", 1);
    }
    p.line(54, 424, 696, 424, "#ffd98b88", 3 * heat);
    p.line(70, 411, 680, 411, "#271b1855", 8);
    p.end();
    this.frontAtmosphere.node.setPosition(parallax * 5, 0);
  }
  private drawWorld(w: BattleWorld, drag: Drag | null): void {
    this.drawSceneDepth(w, drag);
    let p = this.ground; p.begin();
    // The pot fire is the diegetic objective; the top bar only mirrors this state.
    for (let x = 58; x < 706; x += 34) {
      p.line(x, 430, x + 18, 430, "#f3c66c", 5);
      p.line(x + 18, 430, x + 26, 438, "#f3c66c", 3);
    }
    p.text("守 住 这 口 锅", 375, 467, 22, "#ffe0a1", 250, 34);
    const potHit = this.latestLoose("leak");
    const fireRatio = Math.max(0, w.lantern / w.db.data.balance.lantern.max);
    if (fireRatio > 0) {
      const hit = potHit ? Math.max(0, 1 - potHit.age / 0.42) : 0;
      const flicker = 1 + Math.sin(this.clock * 9) * 0.025 * fireRatio;
      const width = (64 + 30 * fireRatio) * (1 + hit * 0.12) * flicker;
      const height = (45 + 90 * fireRatio) * (1 - hit * 0.28) * flicker;
      const tint = fireRatio <= 0.25 ? "#b76f62" : fireRatio <= 0.5 ? "#e7a36f" : "#ffffff";
      p.sprite(this.art.lantern, 375 + (potHit ? Math.sin(potHit.age * 48) * 7 * hit : 0), 425, width, height, potHit ? Math.sin(potHit.age * 52) * 5 * hit : 0, tint);
    }
    p.text(w.preparingSeconds ? `先捞取并上阵 · ${w.preparingSeconds} 秒后迎客` : "老 鼠 往 锅 边 来  ↓", 375, 1080, 23, "#fbe8c5");
    for (const slot of w.openSlots()) {
      const near = drag && Math.hypot(drag.x - slot.x, drag.y - slot.y) <= w.db.data.balance.slots.snapRadius;
      p.sprite(this.art.plate, slot.x, slot.y - 8, 132, 90);
      if (near) p.oval(slot.x, slot.y - 4, 58, 26, "#ade1be55", "#338772", 3);
      if (!w.seafood.some((s) => s.slotId === slot.id)) p.text("＋", slot.x, slot.y - 4, 30, "#a98752", 60);
    }
    p.end();
    p = this.stage; p.begin();
    // Larger y is farther away. Air units are the final actor pass.
    const actors: (Deployed | EnemyRt)[] = [...w.seafood, ...w.enemies];
    actors.sort((a, b) => Number("air" in a && a.air) - Number("air" in b && b.air) || b.y - a.y || a.uid - b.uid);
    for (const actor of actors) {
      if ("speciesId" in actor) { this.drawDefender(w, actor, drag); continue; }
      const enemy = actor;
      const dangerDistance = enemy.y - enemy.radius - w.db.data.balance.layout.leakLineY;
      if (!enemy.boss && dangerDistance < 145) {
        const urgency = Math.max(0, 1 - dangerDistance / 145);
        p.oval(enemy.x, enemy.y - 2, 42 + urgency * 10, 42 + urgency * 10, "#d8492d16", "#f06a4b", 2 + urgency * 2);
        p.text(dangerDistance <= 45 ? "即将越线!" : "危险", enemy.x, enemy.y + 70, dangerDistance <= 45 ? 22 : 18, "#ffb083", 120, 30);
      }
      p.oval(enemy.x, enemy.y - 25, enemy.boss ? 55 : 29, 10, "#49322d45", "#49322d45", 0);
      if (enemy.boss) {
        p.box(enemy.x, enemy.y - 5, 105, 96, "#738681", "#374743", 14, 5);
        for (let x = -30; x <= 30; x += 20) p.line(enemy.x + x, enemy.y - 40, enemy.x + x, enemy.y + 25, "#9aa599", 4);
      }
      const feel = w.db.data.balance.feedback;
      const hit = this.latestFx("hit", enemy.uid, feel.hitSeconds);
      const impulse = hit ? Math.pow(1 - hit.age / feel.hitSeconds, 2) : 0;
      const distance = hit ? Math.hypot(hit.directionX ?? 0, hit.directionY ?? 1) || 1 : 1;
      const recoil = impulse * (hit?.heavy ? feel.heavyRecoilPixels : feel.recoilPixels);
      const size = enemy.boss ? 168 : enemy.air ? 132 : 100;
      const enemyId = enemy.air ? "gull" : "rat";
      const walk = this.art.sheets[enemyId];
      const step = walk[Math.floor(this.clock * (enemy.air ? 10 : 8) + enemy.uid) % walk.length];
      p.sprite(step, enemy.x + (hit?.directionX ?? 0) / distance * recoil,
        enemy.y + (enemy.boss ? 32 : 0) + (hit?.directionY ?? 1) / distance * recoil,
        size * (1 + impulse * 0.13), size * (1 - impulse * 0.12),
        Math.sin(this.clock * (enemy.air ? 9 : 12) + enemy.uid) * (enemy.rolling ? 18 : 3), impulse > 0.4 ? "#ffe6c2" : "#ffffff");
      if (enemy.hp < enemy.maxHp || enemy.boss) {
        p.box(enemy.x, enemy.y + (enemy.boss ? 104 : 50), 70, 9, "#49332d", "#49332d", 4, 0);
        p.box(enemy.x - 34 * (1 - Math.max(0, enemy.hp / enemy.maxHp)), enemy.y + (enemy.boss ? 104 : 50), Math.max(1, 68 * enemy.hp / enemy.maxHp), 7, "#cf634d", "#cf634d", 3, 0);
      }
    }
    p.end();
    p = this.water; p.begin();
    const aim = w.draggingNet ? w.aimNet() : { caught: [], grazed: [] };
    const caught = aim.caught;
    const grazed = aim.grazed;
    for (const critter of w.pond) {
      const selected = caught.some((c) => c.uid === critter.uid);
      const brushed = grazed.some((c) => c.uid === critter.uid);
      p.oval(critter.x, critter.y - 16, 32, 8, "#70ddd54d", "#70ddd54d", 0);
      if (selected) p.oval(critter.x, critter.y, 39, 30, "#ffe49b20", w.netCooldown > 0 ? "#acbbb1" : "#ffe49b", 3);
      else if (brushed) p.oval(critter.x, critter.y, 39, 30, "#9fd0c418", "#7eb8ae", 2);
      this.idleSprite(p, w, critter.speciesId, 1, critter.uid, critter.x,
        critter.y + Math.sin(this.clock * 3 + critter.uid) * 4, 82, 82, Math.sin(this.clock + critter.uid) * 6);
    }
    p.end();
    p = this.net; p.begin();
    this.netHint = "";
    const scoop = this.latestLoose("splash") ?? this.latestLoose("wobble");
    if (w.draggingNet || scoop) {
      const x = w.netX, y = w.netY, r = w.netRadius;
      const ready = w.netCooldown <= 0;
      const mouth = ready ? (caught.length ? "#ffe49b" : grazed.length ? "#9fd0c4" : "#f9e7b2") : "#9fb5ac";
      p.oval(x, y, r, r * 0.92, "#e9f8cd12", mouth, 3);
      const catchSeconds = w.db.data.balance.feedback.catchSeconds || 0.38;
      const frame = scoop
        ? this.art.net[Math.min(this.art.net.length - 1, Math.floor(scoop.age / catchSeconds * this.art.net.length))]
        : this.art.net[0];
      p.sprite(frame, x, y, r * 2.85, r * 2.85);
      if (w.draggingNet) {
        const pair = caught.length > 1 && new Set(caught.map((c) => c.speciesId)).size < caught.length;
        this.netHint = !ready
          ? `捞网回收中 ${w.netCooldown.toFixed(1)}s`
          : pair
            ? `${caught.length}/${w.netCapacity} 只 · 同类入网，松手升星！`
            : caught.length && grazed.length
              ? `${caught.length} 只罩住 · ${grazed.length} 只只擦到网边`
              : caught.length
                ? `${caught.length}/${w.netCapacity} 只 · 松手捞起`
                : grazed.length
                  ? "网边轻碰，再把身体罩进网口"
                  : "把海鲜圈进网里";
      }
    }
    p.end();
    p = this.effects; p.begin();
    for (const f of this.puffs) {
      const x = f.x ?? 375, y = f.y ?? 650, t = f.age;
      if (f.type === "hit" || f.type === "death" || f.type === "merge") {
        const alpha = Math.round(255 * Math.max(0, 1 - t / 0.65)).toString(16).padStart(2, "0");
        p.text(f.text ?? "", x, y + 45 + Math.sqrt(t) * 55, f.type === "merge" || f.heavy ? 30 : 24, `${f.type === "hit" ? "#fff4cf" : "#ffe073"}${alpha}`, 160);
      }
      if (f.type === "hit" && t < 0.14) {
        const look = this.starLook(w, f.star);
        const k = 1 - t / 0.14;
        const reach = (8 + t * 160) * look.scale;
        for (let i = 0; i < 5; i++) {
          const a = i * Math.PI * 2 / 5;
          p.line(x + Math.cos(a) * reach, y + Math.sin(a) * reach, x + Math.cos(a) * (reach + 12 * k), y + Math.sin(a) * (reach + 12 * k), f.heavy ? "#ffcd78" : look.tint, 4 * k);
        }
      }
      if (f.type === "merge") {
        const look = this.starLook(w, f.star);
        const duration = w.db.data.balance.feedback.mergeSeconds || 0.75;
        const k = Math.max(0, 1 - t / duration);
        const frame = this.art.merge[Math.min(this.art.merge.length - 1, Math.floor(t / duration * this.art.merge.length))];
        for (let i = 0; i < 10; i++) {
          const a = i * Math.PI * 2 / 10;
          const inner = 48 + t * 95, outer = inner + 30 * k * look.scale;
          p.line(x + Math.cos(a) * inner, y + 20 + Math.sin(a) * inner, x + Math.cos(a) * outer, y + 20 + Math.sin(a) * outer, look.tint, Math.max(1, 6 * k));
        }
        p.oval(x, y + 20, 52 + t * 110, 36 + t * 75, "#ffffff00", look.tint, Math.max(1, 7 * k));
        p.sprite(frame, x, y + 20, 178 * look.scale, 178 * look.scale, t * 24, look.tint);
        p.sprite(this.idleFrame(f.speciesId ?? "shrimp", f.star ?? 1), x, y + 28, 112 * look.scale * (1 + k * 0.22), 112 * look.scale * (1 - k * 0.12), -6 * k);
        p.text(`${f.star ?? 1} 星进化`, x, y + 112 + t * 25, 27 + 8 * k, look.tint, 190, 42);
      }
      if (f.type === "attack") {
        const look = this.starLook(w, f.star);
        p.oval(x, y + 20, 28 * look.scale, 16 * look.scale, "#ffffff00", look.tint, 3);
      }
      if (f.type === "splash") p.text(f.text ?? "", Math.max(100, Math.min(650, x)), Math.min(255, y + 25 + t * 40), 24, "#fff1c3", 190);
      if (f.type === "splash" || f.type === "wobble") p.oval(x, y, w.netRadius * (1 + t * 0.5), w.netRadius * (1 + t * 0.5), "#ffffff00", f.type === "splash" ? "#b4f3e470" : "#eab39970", Math.max(1, 4 - t * 6));
      if (["splash", "merge", "claw", "garlic", "chili"].includes(f.type)) {
        for (let i = 0; i < 7; i++) {
          const a = i * Math.PI * 2 / 7, r = 15 + t * 95;
          p.oval(x + Math.cos(a) * r, y + Math.sin(a) * r, Math.max(1, 6 - t * 8), Math.max(1, 6 - t * 8), f.type === "splash" ? "#b4f3e4" : "#ffe799", "#ffe799", 0);
        }
      }
      if (f.type === "fan") {
        const look = this.starLook(w, f.star);
        p.line(x, y + 10, x - 90 * look.scale * (1 + t), y + 130 * look.scale * (1 + t), look.tint + "70", 14 * (1 - t));
        p.line(x, y + 10, x + 90 * look.scale * (1 + t), y + 130 * look.scale * (1 + t), look.tint + "70", 14 * (1 - t));
      }
      if (f.type === "claw" || f.type === "garlic") {
        const look = this.starLook(w, f.star);
        p.oval(x, y, (f.type === "garlic" ? 54 : 36) * look.scale * (1 + t), (f.type === "garlic" ? 54 : 36) * look.scale * (1 + t), "#ffffff00", look.tint, 4 * (1 - t));
      }
      if (f.type === "wave") p.box(375, 450 + t * 950, 690, 45, "#79dcd78a", "#c7fbe7", 20, 4);
      if (f.type === "push" && t < 0.34) {
        const k = Math.max(0, 1 - t / 0.34);
        p.text("撞开!", x, y + 52 + t * 35, 20 + 7 * k, "#ffdd8d", 100, 35);
        for (let i = -1; i <= 1; i++) p.line(x + i * 13, y + 8, x + i * 20, y + 30 + 24 * k, "#ffe59b", 2 + 2 * k);
      }
      if (f.type === "leak") {
        const life = Math.max(0, 1 - t / 1.15);
        p.box(375, 430, 700, 22 + 15 * life, "#e74432b8", "#ffd091", 10, 3);
        p.text(f.text ?? "-1", x, 468 + Math.sqrt(t) * 70, 38 + life * 8, "#ff765c", 120, 55);
        if ((f.combo ?? 1) > 1) p.text(`连续偷吃 ×${f.combo}`, 375, 690, 25, "#ffd09c", 260, 36);
        const edge = 24 * life;
        p.box(12, 667, edge, 1200, "#cf302a55", "#cf302a55", 0, 0);
        p.box(738, 667, edge, 1200, "#cf302a55", "#cf302a55", 0, 0);
      }
    }
    p.end();
    const feel = w.db.data.balance.feedback;
    const shake = this.puffs.reduce((v, f) => f.type === "claw" || f.type === "leak" ? Math.max(v, Math.max(0, 1 - f.age / feel.shakeSeconds)) : v, 0);
    const offset = Math.sin(this.clock * 90) * shake * shake * feel.shakePixels;
    this.stage.node.setPosition(offset, 0); this.effects.node.setPosition(offset, 0);
    p = this.heldItem; p.begin();
    if (drag) {
      const unit = drag.kind === "unit" ? w.seafood.find((item) => item.uid === drag.uid) : undefined;
      const attack = unit ? this.latestFx("attack", unit.uid, w.db.data.balance.feedback.attackSeconds) : undefined;
      if (unit && attack) {
        const evolved = unit.star > 1 ? this.art.starAttack[unit.speciesId]?.[unit.star - 2] : undefined;
        const poses = evolved?.length
          ? evolved
          : unit.speciesId === "fish" && unit.star > 1
            ? [this.idleFrame(unit.speciesId, unit.star, unit.uid)]
            : this.art.sheets[unit.speciesId];
        const frame = poses[Math.min(poses.length - 1,
          Math.floor(attack.age / w.db.data.balance.feedback.attackSeconds * poses.length))];
        const kick = Math.pow(1 - attack.age / w.db.data.balance.feedback.attackSeconds, 2);
        p.sprite(frame, drag.x, drag.y + 24 - kick * 7, 126 * (1 - kick * 0.1), 126 * (1 + kick * 0.12));
      } else this.idleSprite(p, w, drag.speciesId, drag.star, drag.uid, drag.x, drag.y + 24, 126);
      p.text("★".repeat(drag.star), drag.x, drag.y - 39, 24, "#fff4bb", 140);
    }
    p.end();
  }
  private drawDefender(w: BattleWorld, unit: Deployed, drag: Drag | null): void {
    if (drag?.kind === "unit" && drag.uid === unit.uid) return;
    const p = this.stage, feel = w.db.data.balance.feedback;
    const attack = this.latestFx("attack", unit.uid, feel.attackSeconds);
    const kick = attack ? Math.pow(1 - attack.age / feel.attackSeconds, 2) : 0;
    const ready = !attack && unit.cooldown > 0 && unit.cooldown < feel.anticipationSeconds && w.enemies.some((e) => Math.hypot(e.x - unit.x, e.y - unit.y) < w.db.requireSeafood(unit.speciesId).levels[unit.star - 1].range);
    const size = 110 * unit.displayScale * (unit.mergeFlash ? 1.18 : 1);
    const evolvedAttack = unit.star > 1 ? this.art.starAttack[unit.speciesId]?.[unit.star - 2] : undefined;
    const baseAttack = this.art.sheets[unit.speciesId];
    const attackPoses = evolvedAttack?.length
      ? evolvedAttack
      : unit.speciesId === "fish" && unit.star > 1
        ? [this.idleFrame(unit.speciesId, unit.star, unit.uid)]
        : baseAttack;
    const frame = attack
      ? attackPoses[Math.min(attackPoses.length - 1, Math.floor(attack.age / feel.attackSeconds * attackPoses.length))]
      : this.idleFrame(unit.speciesId, unit.star, unit.uid);
    const squash = ready ? -0.06 : kick * 0.12;
    const x = unit.x, y = unit.y + 26 - kick * 7 + Math.sin(this.clock * 2 + unit.uid) * 2;
    if (attack) p.sprite(frame, x, y, size * (1 - squash), size * (1 + squash), unit.mergeFlash ? 8 : 0);
    else this.idleSprite(p, w, unit.speciesId, unit.star, unit.uid, x, y,
      size * (1 - squash), size * (1 + squash), unit.mergeFlash ? 8 : 0);
    p.box(unit.x, unit.y - 40, 75, 25, unit.recipeId === "C002" ? "#b94a36" : "#465c4f", "#49362a", 9, 2);
    p.text("★".repeat(unit.star), unit.x, unit.y - 40, 19, "#ffe49b", 72, 25);
  }
  private drawHud(w: BattleWorld, screen: Screen, muted: boolean): void {
    const p = this.hud; p.begin();
    const leak = this.latestLoose("leak");
    const lanternPulse = leak ? 1 + Math.max(0, 1 - leak.age / 0.5) * 0.18 : w.lantern <= 5 ? 1 + Math.sin(this.clock * 8) * 0.06 : 1;
    p.box(375, 1215, 570, 102, "#203e3b", "#b4935a", 19, 3);
    p.sprite(this.art.lantern, 92, 1236, 62 * lanternPulse, 88 * lanternPulse, leak ? Math.sin(leak.age * 45) * 7 : 0, leak ? "#ff9b82" : "#ffffff");
    p.text("今 晚 吃 海 鲜", 375, 1290, 25, "#ffe5ae");
    p.text("锅火", 168, 1240, 21, "#edcc96", 100);
    p.text(`${w.lantern} / ${w.db.data.balance.lantern.max}`, 178, 1203, leak ? 35 : 30, w.lantern <= 5 || leak ? "#ff8066" : "#fff0cb", 130);
    p.text(w.waveLabel === "Boss" ? "鼠王来袭" : `第 ${w.waveNumber} 波`, 362, 1239, 30, "#fff0cb", 230);
    p.text(`${Math.floor(w.elapsed / 60).toString().padStart(2, "0")}:${Math.floor(w.elapsed % 60).toString().padStart(2, "0")}  /  夜市守锅`, 362, 1203, 20, "#b9c5ac", 240);
    p.text("金币", 575, 1240, 21, "#edcc96", 90);
    p.text(String(w.gold), 575, 1203, 31, "#ffde87", 100);
    p.box(375, 1143, 558, 12, "#203e3b", "#203e3b", 6, 0);
    const progress = Math.max(0.01, w.waveProgress);
    p.box(96 + progress * 558 / 2, 1143, 558 * progress, 10, "#e0bc75", "#e0bc75", 5, 0);
    const nearestThreat = w.enemies.filter((e) => !e.boss).reduce((best, e) => Math.min(best, e.y - e.radius - w.db.data.balance.layout.leakLineY), Infinity);
    const danger = nearestThreat < 145;
    p.box(375, 1105, 558, 44, danger ? "#6f332dde" : "#234b45dc", danger ? "#e27b5e" : "#668d78", 12, 2);
    p.text(danger
      ? `紧急：鼠鼠距锅边 ${Math.max(0, Math.ceil(nearestThreat))} · 别让它偷吃`
      : "守完今晚的客，锅还烧着就能收摊。",
      375, 1105, danger ? 21 : 20, danger ? "#ffd09c" : "#e9dfb8", 535, 38);
    if (screen === "play" && w.phase === "combat") this.button(p, "pause", "Ⅱ", 693, 1215, 64, "#476858", 64);
    if (screen === "play" && w.phase === "combat") this.button(p, "sound", muted ? "静" : "音",  50, 1215, 64, "#476858", 64);
    p.box(375, 370, 660, 90, "#3a4236", "#aa8550", 14, 3);
    this.trayPage = Math.min(this.trayPage, Math.max(0, Math.ceil(w.tray.length / 5) - 1));
    for (let i = 0; i < 5; i++) {
      const x = 135 + i * 96;
      p.sprite(this.art.tray, x, 368, 96, 78);
      const item = w.tray[this.trayPage * 5 + i];
      if (item) { this.idleSprite(p, w, item.speciesId, item.star, item.uid, x, 378, 72); p.text("★".repeat(item.star), x, 342, 16, "#73512c", 78, 24); }
      else p.text("·", x, 369, 25, "#ad956c", 50);
    }
    p.text("待上阵", 651, 392, 18, "#e8d4a5", 80);
    if (w.tray.length > 5) this.button(p, "tray-next", `${this.trayPage + 1}/${Math.ceil(w.tray.length / 5)} ›`, 650, 356, 73, "#577662", 42);
    else p.text(String(w.tray.length), 651, 357, 25, "#fff0cb", 60);
    const tip = w.tray.length ? "拖动托盘海鲜到圆盘 · 同种同星叠放升星" : w.seafood.length ? "继续捞取 · 拖动场上海鲜可换位 / 合成" : "在水池中拖动捞网，松手捞起海鲜";
    p.box(375, 299, 645, 39, "#173f3bdc", "#578475", 12, 1);
    p.text(this.netHint || tip, 375, 299, 23, this.netHint ? "#ffe49b" : "#f2edc5", 625, 38);
    p.text("鲜 活 池", 130, 46, 23, "#deefd7", 150);
    p.text(`一网 ${w.netCapacity} 只 · 同类一起捞可升星`, 340, 47, 20, "#cae9d6", 280);
    if (screen === "play" && w.phase === "combat") this.button(p, "skill", w.skillCd > 0 ? `海浪 ${Math.ceil(w.skillCd)}s` : "海浪 · 空格", 603,  60, 195, w.skillCd > 0 ? "#526a61" : "#397e79",  60);
    const recipe = w.recipeId ? w.db.requireRecipe(w.recipeId).name : "原味开摊";
    p.box(150, 1015, 176, 40, "#65452dc9", "#8b623d", 10, 1);
    p.text(recipe, 150, 1015, 23, "#ffe0a4", 170, 36);
    if (w.seasoningCharge > 0) p.sprite(this.art.seasoning, 268, 1018, 58, 58);
    const boss = w.enemies.find((e) => e.boss);
    if (boss) {
      p.box(477, 1040, 380, 52, "#653b34", "#d8b17a", 12, 2);
      p.text(`鼠王  ${Math.max(0, Math.ceil(boss.hp))} / ${Math.ceil(boss.maxHp)}`, 477, 1040, 23, "#ffe6b5", 365);
    }
    if (this.toastLeft > 0) { p.box(375, 965, 480, 51, "#274c42ee", "#e0c48b", 13, 2); p.text(this.toast, 375, 965, 25, "#fff0c7", 465); }
    p.end();
  }
  private drawOverlay(w: BattleWorld, screen: Screen): void {
    const p = this.overlay; p.begin();
    const phase = screen === "play" ? w.phase : screen;
    if (phase === "combat") { p.end(); return; }
    this.hits = [];
    p.box(375, 667, 750, 1334, "#102e30be", "#102e30be", 0, 0);
    p.box(375, 710, 628, 806, "#342f27", "#342f27", 28, 0);
    p.box(375, 720, 620, 806, "#f5e5bb", "#76563c", 28, 5);
    p.box(375, 1055, 574, 85, "#254c45", "#254c45", 20, 0);
    if (phase === "home") {
      p.text("海 风 夜 市  /  今 日 出 摊", 375, 1056, 24, "#f9e3b3");
      p.text("今晚吃海鲜", 375, 949,  70, "#294c43", 550, 110);
      p.text("老鼠闻着味来偷吃。", 375, 884, 28, "#765840");
      p.text("捞海鲜上摊，守住这口锅，守到收摊。", 375, 844, 25, "#876349", 560);
      ["shrimp", "crab", "scallop", "fish"].forEach((id, i) => {
        const x = 172 + i * 135;
        p.oval(x, 735, 55, 21, "#dbc48d", "#c2a16a", 2);
        this.idleSprite(p, w, id, 1, i, x, 775 + Math.sin(this.clock * 2 + i) * 5, 132);
        p.text(names[id], x, 698, 21, "#68513b", 124);
      });
      p.text("① 拖网捞取     ② 拖到圆盘     ③ 合成守锅", 375, 618, 23, "#68513b", 560);
      p.text("守完今晚的客，锅还烧着就能收摊。", 375, 573, 23, "#876d51", 550);
      this.button(p, "start", "开 摊 迎 客", 375, 464, 410, "#cd6244",  80);
      p.text("鼠标 / 触屏拖动   ·   空格放海浪   ·   Esc 暂停", 375, 373, 21, "#8a7559", 565);
    } else if (phase === "pause") {
      p.text("歇 一 会 儿", 375, 1056,  30, "#f9e3b3");
      p.sprite(this.art.crew.crab, 375, 875, 180);
      p.text("锅还烧着，准备好再继续。", 375, 739, 28, "#68513b", 550);
      this.button(p, "resume", "继续守锅", 375, 627, 410, "#3c7a68",  70);
      this.button(p, "restart", "重新开摊", 375, 519, 410, "#ad7850",  70);
      this.button(p, "home", "回到摊位", 375, 411, 410, "#637363",  60);
    } else if (phase === "draft" || phase === "recipe") {
      const draft = phase === "draft";
      p.text(draft ? "夜 市 加 料" : "选 择 招 牌 口 味", 375, 1056, 30, "#f9e3b3");
      p.text(draft ? "挑一份强化，今晚更拿手" : "新上阵 / 换位的海鲜获得料理效果", 375, 966, 26, "#765840", 560);
      const ids = draft ? w.db.data.demo.draftIds : w.db.data.demo.recipesOffered;
      ids.forEach((id, i) => {
        const y = 850 - i * 174;
        p.box(375, y, 540, 147, i === 1 ? "#e0e8cd" : "#efcea0", "#a58a5c", 18, 3);
        p.sprite(this.art.crew[draft ? ["shrimp", "scallop", "crab"][i] : i ? "shrimp" : "fish"], 172, y, 100);
        const item = draft ? w.db.requireUpgrade(id) : w.db.requireRecipe(id);
        p.text(item.name, 392, y + 36, 31, "#355646", 330);
        p.text(draft ? w.db.requireUpgrade(id).desc : i ? "攻速提升，连续攻击触发辣油连弹" : "命中附带持续香伤，叠加触发爆香", 407, y - 10, 22, "#755d42", 360, 62);
        p.text("点击选择  ›", 505, y -  50, 18, "#93633c", 190);
        this.hits.push({ id: `${phase}:${id}`, x: 375, y, w: 540, h: 147 });
      });
      p.text("选择期间战斗暂停", 375, 373, 22, "#8a7559");
    } else if (phase === "result") {
      const win = w.result === "win";
      p.text(win ? "今 夜 圆 满 收 摊" : "锅 灭 了", 375, 1056, 30, "#f9e3b3");
      p.text(win ? "锅还烧着，收摊！" : "今晚做不成", 375, 948, 53, "#315b4b");
      p.sprite(this.art.crew[win ? "shrimp" : "rat"], 375, 821, 160);
      p.text(`守到 ${w.waveLabel === "Boss" ? "鼠王" : `第 ${w.waveNumber} 波`}    击退 ${w.kills} 位来客`, 375, 693, 29, "#76583e", 540);
      p.text(`金币 ${w.gold}     鱼骨 ${w.fishbone}     用时 ${Math.floor(w.elapsed)} 秒`, 375, 650, 26, "#76583e", 540);
      p.text(win ? "锅火守住，鼠王退场" : `漏掉 ${w.leaks} 只 · 锅火损失 ${w.lanternLost} 点`, 375, 604, 23, win ? "#52745e" : "#a34f42", 540);
      this.button(p, "restart", "再 来 一 局", 375, 510, 410, "#cd6244", 76);
      this.button(p, "home", "回到摊位", 375, 407, 410, "#587461",  60);
    }
    p.end();
  }
}
