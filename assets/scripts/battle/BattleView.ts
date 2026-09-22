import { Node } from "cc";
import type { BattleFx, BattleWorld } from "../core/battle-world";
import type { BattleArt } from "./BattleArt";
import { BattlePainter } from "./BattlePainter";
import { SpineProjectiles } from "./SpineProjectiles";

export type Screen = "home" | "play" | "pause";
export interface Drag { kind: "tray" | "unit"; uid: number; speciesId: string; star: number; x: number; y: number }
interface Hit { id: string; x: number; y: number; w: number; h: number }
interface Puff extends BattleFx { age: number }
const names: Record<string, string> = { shrimp: "快射虾", crab: "重钳蟹", scallop: "散射贝", fish: "穿透鱼" };

export class BattleView {
  private stage: BattlePainter;
  private hud: BattlePainter;
  private overlay: BattlePainter;
  private spine: SpineProjectiles;
  private hits: Hit[] = [];
  private puffs: Puff[] = [];
  private toast = "";
  private toastLeft = 0;
  private clock = 0;
  trayPage = 0;
  constructor(root: Node, private art: BattleArt) {
    const bg = new BattlePainter(root, "Board", 1, 0);
    bg.begin(); bg.sprite(art.board, 375, 667, 750, 1334); bg.end();
    this.stage = new BattlePainter(root, "Creatures", 150, 100);
    this.spine = new SpineProjectiles(root, art.bullets);
    this.hud = new BattlePainter(root, "Interface", 20, 50);
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
    this.clock += dt; this.hits = [];
    if (screen === "play") {
      this.puffs.forEach((f) => f.age += dt);
      this.puffs = this.puffs.filter((f) => f.age < 0.65);
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
  private drawWorld(w: BattleWorld, drag: Drag | null): void {
    const p = this.stage; p.begin();
    // Quiet brass details establish the playable board without competing with creatures.
    for (let x = 78; x < 690; x += 25) p.line(x, 430, x + 12, 430, "#f8d885", 4);
    p.text("守 住 灯 火", 375, 457, 20, "#654231");
    p.text(w.preparingSeconds ? `先捞取并上阵 · ${w.preparingSeconds} 秒后迎客` : "来 客 方 向  ↓", 375, 1080, 23, "#fbe8c5");
    for (const slot of w.openSlots()) {
      const near = drag && Math.hypot(drag.x - slot.x, drag.y - slot.y) < 70;
      p.oval(slot.x, slot.y - 13, 59, 27, "#6d452950", "#8b5c36", 2);
      p.oval(slot.x, slot.y - 5, 55, 28, near ? "#ade1be" : "#eacb88", near ? "#338772" : "#916339", 4);
      p.oval(slot.x, slot.y - 5, 43, 20, near ? "#cef4d3" : "#f3dba6", "#b58c50", 1);
      if (!w.seafood.some((s) => s.slotId === slot.id)) p.text("＋", slot.x, slot.y - 4, 30, "#a98752", 60);
    }
    for (const unit of w.seafood) {
      if (drag?.kind === "unit" && drag.uid === unit.uid) continue;
      const kick = unit.cooldown > 0 && unit.cooldown < 0.13 ? 0.95 : 1;
      const size = 110 * unit.displayScale * (unit.mergeFlash ? 1.18 : kick);
      p.sprite(this.art.crew[unit.speciesId], unit.x, unit.y + 26 + Math.sin(this.clock * 2 + unit.uid) * 2, size, size, unit.mergeFlash ? 8 : 0);
      p.box(unit.x, unit.y - 40, 75, 25, unit.recipeId === "C002" ? "#b94a36" : "#465c4f", "#49362a", 9, 2);
      p.text("★".repeat(unit.star), unit.x, unit.y - 40, 19, "#ffe49b", 72, 25);
    }
    for (const enemy of w.enemies) {
      p.oval(enemy.x, enemy.y - 25, enemy.boss ? 55 : 29, 10, "#49322d45", "#49322d45", 0);
      if (enemy.boss) {
        p.box(enemy.x, enemy.y - 5, 105, 96, "#738681", "#374743", 14, 5);
        for (let x = -30; x <= 30; x += 20) p.line(enemy.x + x, enemy.y - 40, enemy.x + x, enemy.y + 25, "#9aa599", 4);
      }
      const flash = this.puffs.some((f) => f.type === "hit" && f.uid === enemy.uid && f.age < 0.08);
      const size = enemy.boss ? 146 : enemy.air ? 99 : 89;
      p.sprite(this.art.crew[enemy.air ? "gull" : "rat"], enemy.x, enemy.y + (enemy.boss ? 32 : 0), size, size,
        Math.sin(this.clock * (enemy.air ? 9 : 12) + enemy.uid) * (enemy.rolling ? 30 : 6), flash ? "#ffd59c" : "#ffffff");
      if (enemy.hp < enemy.maxHp || enemy.boss) {
        p.box(enemy.x, enemy.y + (enemy.boss ? 104 : 50), 70, 9, "#49332d", "#49332d", 4, 0);
        p.box(enemy.x - 34 * (1 - Math.max(0, enemy.hp / enemy.maxHp)), enemy.y + (enemy.boss ? 104 : 50), Math.max(1, 68 * enemy.hp / enemy.maxHp), 7, "#cf634d", "#cf634d", 3, 0);
      }
    }
    for (const critter of w.pond) {
      p.oval(critter.x, critter.y - 16, 32, 8, "#70ddd54d", "#70ddd54d", 0);
      p.sprite(this.art.crew[critter.speciesId], critter.x, critter.y + Math.sin(this.clock * 3 + critter.uid) * 4, 82, 82, Math.sin(this.clock + critter.uid) * 6);
    }
    if (w.draggingNet) {
      const x = w.netX, y = w.netY, r = w.netRadius;
      p.oval(x, y, r, r, "#e9f8cd20", "#f9e7b2", 5);
      for (let i = -2; i <= 2; i++) {
        const offset = i * r / 3, span = Math.sqrt(r * r - offset * offset);
        p.line(x - span, y + offset, x + span, y + offset, "#e8f4ca65", 2);
        p.line(x + offset, y - span, x + offset, y + span, "#e8f4ca65", 2);
      }
      p.line(x + r * 0.7, y - r * 0.7, x + r * 1.05, y - r * 1.25, "#a97644", 12);
    }
    for (const f of this.puffs) {
      const x = f.x ?? 375, y = f.y ?? 650, t = f.age;
      if (f.type === "hit" || f.type === "death" || f.type === "merge") {
        p.text(f.text ?? "", x, y + 45 + t * 60, f.type === "merge" ? 30 : 24, f.type === "hit" ? "#fff4cf" : "#ffe073", 160);
      }
      if (["splash", "merge", "claw", "garlic", "chili"].includes(f.type)) {
        for (let i = 0; i < 7; i++) {
          const a = i * Math.PI * 2 / 7, r = 15 + t * 95;
          p.oval(x + Math.cos(a) * r, y + Math.sin(a) * r, Math.max(1, 6 - t * 8), Math.max(1, 6 - t * 8), f.type === "splash" ? "#b4f3e4" : "#ffe799", "#ffe799", 0);
        }
      }
      if (f.type === "fan") {
        p.line(x, y + 10, x - 90 * (1 + t), y + 130 * (1 + t), "#fff2c570", 14 * (1 - t));
        p.line(x, y + 10, x + 90 * (1 + t), y + 130 * (1 + t), "#fff2c570", 14 * (1 - t));
      }
      if (f.type === "wave") p.box(375, 450 + t * 950, 690, 45, "#79dcd78a", "#c7fbe7", 20, 4);
      if (f.type === "leak") p.box(375, 430, 680, 20, "#e75a4690", "#e75a4690", 10, 0);
    }
    if (drag) {
      p.sprite(this.art.crew[drag.speciesId], drag.x, drag.y + 24, 126);
      p.text("★".repeat(drag.star), drag.x, drag.y - 39, 24, "#fff4bb", 140);
    }
    p.end();
  }
  private drawHud(w: BattleWorld, screen: Screen, muted: boolean): void {
    const p = this.hud; p.begin();
    p.box(375, 1215, 570, 102, "#203e3b", "#b4935a", 19, 3);
    p.text("今 晚 吃 海 鲜", 375, 1290, 25, "#ffe5ae");
    p.text("灯火", 149, 1240, 21, "#edcc96", 100);
    p.text(`${w.lantern} / ${w.db.data.balance.lantern.max}`, 161, 1203, 30, w.lantern <= 5 ? "#ff9475" : "#fff0cb", 130);
    p.text(w.waveLabel === "Boss" ? "鼠王来袭" : `第 ${w.waveNumber} 波`, 362, 1239, 30, "#fff0cb", 230);
    p.text(`${Math.floor(w.elapsed / 60).toString().padStart(2, "0")}:${Math.floor(w.elapsed % 60).toString().padStart(2, "0")}  /  夜市守摊`, 362, 1203, 20, "#b9c5ac", 240);
    p.text("金币", 575, 1240, 21, "#edcc96", 90);
    p.text(String(w.gold), 575, 1203, 31, "#ffde87", 100);
    p.box(375, 1143, 558, 12, "#203e3b", "#203e3b", 6, 0);
    const progress = Math.max(0.01, w.waveProgress);
    p.box(96 + progress * 558 / 2, 1143, 558 * progress, 10, "#e0bc75", "#e0bc75", 5, 0);
    if (screen === "play" && w.phase === "combat") this.button(p, "pause", "Ⅱ", 693, 1215, 64, "#476858", 64);
    if (screen === "play" && w.phase === "combat") this.button(p, "sound", muted ? "静" : "音",  50, 1215, 64, "#476858", 64);
    p.box(375, 370, 660, 90, "#3a4236", "#aa8550", 14, 3);
    this.trayPage = Math.min(this.trayPage, Math.max(0, Math.ceil(w.tray.length / 5) - 1));
    for (let i = 0; i < 5; i++) {
      const x = 135 + i * 96;
      p.box(x, 370, 83, 73, "#e4cd9c", "#9c7f51", 12, 2);
      const item = w.tray[this.trayPage * 5 + i];
      if (item) { p.sprite(this.art.crew[item.speciesId], x, 378, 72); p.text("★".repeat(item.star), x, 342, 16, "#73512c", 78, 24); }
      else p.text("·", x, 369, 25, "#ad956c", 50);
    }
    p.text("待上阵", 651, 392, 18, "#e8d4a5", 80);
    if (w.tray.length > 5) this.button(p, "tray-next", `${this.trayPage + 1}/${Math.ceil(w.tray.length / 5)} ›`, 650, 356, 73, "#577662", 42);
    else p.text(String(w.tray.length), 651, 357, 25, "#fff0cb", 60);
    const tip = w.tray.length ? "拖动托盘海鲜到圆盘 · 同种同星叠放升星" : w.seafood.length ? "继续捞取 · 拖动场上海鲜可换位 / 合成" : "在水池中拖动捞网，松手捞起海鲜";
    p.box(375, 299, 645, 39, "#173f3bdc", "#578475", 12, 1);
    p.text(tip, 375, 299, 23, "#f2edc5", 625, 38);
    p.text("鲜 活 池", 130, 46, 23, "#deefd7", 150);
    p.text(`一网 ${w.netCapacity} 只 · 同类一起捞可升星`, 340, 47, 20, "#cae9d6", 280);
    if (screen === "play" && w.phase === "combat") this.button(p, "skill", w.skillCd > 0 ? `海浪 ${Math.ceil(w.skillCd)}s` : "海浪 · 空格", 603,  60, 195, w.skillCd > 0 ? "#526a61" : "#397e79",  60);
    const recipe = w.recipeId ? w.db.requireRecipe(w.recipeId).name : "原味开摊";
    p.box(150, 1015, 176, 40, "#65452dc9", "#8b623d", 10, 1);
    p.text(recipe, 150, 1015, 23, "#ffe0a4", 170, 36);
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
      p.text("捞一网鲜活，守一夜灯火。", 375, 872, 27, "#876349");
      ["shrimp", "crab", "scallop", "fish"].forEach((id, i) => {
        const x = 172 + i * 135;
        p.oval(x, 735, 55, 21, "#dbc48d", "#c2a16a", 2);
        p.sprite(this.art.crew[id], x, 775 + Math.sin(this.clock * 2 + i) * 5, 132);
        p.text(names[id], x, 698, 21, "#68513b", 124);
      });
      p.text("① 拖网捞取     ② 拖到圆盘     ③ 合成守摊", 375, 618, 23, "#68513b", 560);
      p.text("5 波来客 + 鼠王挑战  ·  约 3–5 分钟", 375, 573, 23, "#876d51", 550);
      this.button(p, "start", "开 摊 迎 客", 375, 464, 410, "#cd6244",  80);
      p.text("鼠标 / 触屏拖动   ·   空格放海浪   ·   Esc 暂停", 375, 373, 21, "#8a7559", 565);
    } else if (phase === "pause") {
      p.text("歇 一 会 儿", 375, 1056,  30, "#f9e3b3");
      p.sprite(this.art.crew.crab, 375, 875, 180);
      p.text("炉火替你守着，准备好再继续。", 375, 739, 28, "#68513b", 550);
      this.button(p, "resume", "继续守摊", 375, 627, 410, "#3c7a68",  70);
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
      p.text(win ? "今 夜 圆 满 收 摊" : "今 夜 暂 且 收 灯", 375, 1056, 30, "#f9e3b3");
      p.text(win ? "灯还亮着！" : "再守一夜吧", 375, 948, 57, "#315b4b");
      p.sprite(this.art.crew[win ? "shrimp" : "rat"], 375, 821, 160);
      p.text(`守到 ${w.waveLabel === "Boss" ? "鼠王" : `第 ${w.waveNumber} 波`}    击退 ${w.kills} 位来客`, 375, 693, 29, "#76583e", 540);
      p.text(`金币 ${w.gold}     鱼骨 ${w.fishbone}     用时 ${Math.floor(w.elapsed)} 秒`, 375, 634, 26, "#76583e", 540);
      this.button(p, "restart", "再 来 一 局", 375, 510, 410, "#cd6244", 76);
      this.button(p, "home", "回到摊位", 375, 407, 410, "#587461",  60);
    }
    p.end();
  }
}



