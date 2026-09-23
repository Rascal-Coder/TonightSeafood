import {
  _decorator, Component, EventKeyboard, EventMouse, EventTouch, game, Game, input, Input,
  KeyCode, Label, Node, SpriteFrame, UITransform, Vec3,
} from "cc";
import { BattleWorld } from "../core/battle-world";
import type { GameData } from "../core/config-db";
import { loadResourcesConfig } from "./load-resources-config";
import { loadBattleArt } from "./BattleArt";
import { BattleView, Drag, Screen } from "./BattleView";
import { child } from "./BattlePainter";
import { BattleSound } from "./BattleSound";

const { ccclass, property } = _decorator;
@ccclass("BattleDirector")
export class BattleDirector extends Component {
  @property(SpriteFrame) shrimpFrame: SpriteFrame | null = null;
  @property(SpriteFrame) crabFrame: SpriteFrame | null = null;
  @property(SpriteFrame) scallopFrame: SpriteFrame | null = null;
  @property(SpriteFrame) fishFrame: SpriteFrame | null = null;
  @property(SpriteFrame) ratFrame: SpriteFrame | null = null;
  @property(SpriteFrame) gullFrame: SpriteFrame | null = null;
  @property(SpriteFrame) netFrame: SpriteFrame | null = null;
  private world: BattleWorld | null = null;
  private data: GameData | null = null;
  private presentation: BattleView | null = null;
  private root: Node | null = null;
  private screen: Screen = "home";
  private drag: Drag | null = null;
  private held = false;
  private pressed: string | null = null;
  private acc = 0;
  private touchId: number | null = null;
  private muted = false;
  private sound: BattleSound | null = null;

  async start(): Promise<void> {
    const oldBg = this.node.getChildByName("Background"); if (oldBg) oldBg.active = false;
    const stall = this.node.getChildByName("StallLayers"); if (stall) stall.active = false;
    this.root = child("NightMarket", this.node);
    this.root.getComponent(UITransform)!.setAnchorPoint(0, 0);
    this.root.getComponent(UITransform)!.setContentSize(750, 1334);
    const loading = child("Loading", this.root).addComponent(Label);
    loading.string = "炉火预热中…"; loading.fontSize = 30; loading.node.setPosition(375, 667);
    this.resize();
    try {
      const [data, art] = await Promise.all([loadResourcesConfig(), loadBattleArt()]);
      if (!this.isValid) return;
      this.data = data; this.world = new BattleWorld(data);
      this.presentation = new BattleView(this.root, art);
      this.sound = new BattleSound(this.root);
      loading.node.destroy();
      input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
      input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
      input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
      input.on(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
      input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
      input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
      input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
      input.on(Input.EventType.KEY_DOWN, this.onKey, this);
      game.on(Game.EVENT_HIDE, this.onHide, this);
    } catch (error) {
      loading.string = "素材加载失败，请刷新重试\n" + String(error);
      console.error("NightMarket boot failed", error);
    }
  }
  update(dt: number): void {
    this.resize();
    if (!this.world || !this.presentation) return;
    if (this.screen === "play" && this.world.phase === "combat") {
      this.acc += Math.min(dt, 0.15);
      const step = this.world.db.data.balance.tick.logicDt;
      while (this.acc >= step && this.world.phase === "combat") { this.acc -= step; this.world.step(step); }
      if (this.world.phase !== "combat") this.cancel();
    }
    this.sound?.effects(this.world.fx);
    this.presentation.render(this.world, this.screen, this.drag, Math.min(dt, 0.1), this.muted);
  }
  private resize(): void {
    if (!this.root) return;
    const size = this.node.getComponent(UITransform)!.contentSize;
    const scale = Math.min(size.width / 750, size.height / 1334);
    this.root.setScale(scale, scale, 1);
    this.root.setPosition(-375 * scale, -667 * scale);
  }
  private point(x: number, y: number): Vec3 {
    return this.root!.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(x, y));
  }
  private onTouchStart(e: EventTouch): void {
    if (this.touchId !== null) return;
    this.touchId = e.getID(); const p = e.getUILocation(); this.down(p.x, p.y);
  }
  private onTouchMove(e: EventTouch): void { if (e.getID() === this.touchId) { const p = e.getUILocation(); this.move(p.x, p.y); } }
  private onTouchEnd(e: EventTouch): void { if (e.getID() === this.touchId) { const p = e.getUILocation(); this.up(p.x, p.y); this.touchId = null; } }
  private onTouchCancel(e: EventTouch): void { if (e.getID() === this.touchId) this.cancel(); }
  private onMouseDown(e: EventMouse): void { if (e.getButton() === 0) { const p = e.getUILocation(); this.down(p.x, p.y); } }
  private onMouseMove(e: EventMouse): void { const p = e.getUILocation(); this.move(p.x, p.y); }
  private onMouseUp(e: EventMouse): void { if (e.getButton() === 0) { const p = e.getUILocation(); this.up(p.x, p.y); } }
  private down(x: number, y: number): void {
    if (!this.world || !this.presentation || this.held) return;
    const p = this.point(x, y); this.held = true;
    this.pressed = this.presentation.actionAt(p.x, p.y);
    if (this.pressed || this.screen !== "play" || this.world.phase !== "combat") return;
    const trayUid = this.presentation.trayAt(this.world, p.x, p.y);
    const item = this.world.tray.find((t) => t.uid === trayUid);
    if (item) { this.drag = { kind: "tray", ...item, x: p.x, y: p.y }; return; }
    const unit = this.world.seafood.find((u) => Math.hypot(u.x - p.x, u.y + 20 - p.y) < 60);
    if (unit && this.world.beginUnitDrag(unit.uid)) {
      this.drag = { kind: "unit", uid: unit.uid, speciesId: unit.speciesId, star: unit.star, x: p.x, y: p.y };
      this.world.dragUnit(unit.uid, p.x, p.y);
      return;
    }
    if (p.y > 80 && p.y < 278 && p.x > 35 && p.x < 715) this.world.pointerDown(p.x, p.y);
  }
  private move(x: number, y: number): void {
    if (!this.held || !this.world) return;
    const p = this.point(x, y);
    if (this.drag) {
      this.drag.x = p.x; this.drag.y = p.y;
      if (this.drag.kind === "unit" && this.world.dragUnit(this.drag.uid, p.x, p.y)) {
        const unit = this.world.seafood.find((item) => item.uid === this.drag!.uid);
        if (unit) { this.drag.x = unit.x; this.drag.y = unit.y; }
      }
    }
    else this.world.pointerMove(p.x, p.y);
  }
  private up(x: number, y: number): void {
    if (!this.held || !this.world || !this.presentation) return;
    const p = this.point(x, y); this.held = false;
    if (this.pressed) {
      const id = this.pressed; this.pressed = null;
      if (this.presentation.actionAt(p.x, p.y) === id) this.act(id);
    } else if (this.drag) {
      const d = this.drag;
      const trayTarget = this.presentation.trayAt(this.world, p.x, p.y);
      const ok = d.kind === "tray"
        ? (trayTarget !== null ? this.world.mergeTray(d.uid, trayTarget) : this.world.dropTray(d.uid, p.x, p.y))
        : this.world.endUnitDrag(d.uid, p.x, p.y);
      if (ok) this.sound?.play("pluck");
      this.presentation.notify(ok
        ? d.kind === "unit" ? "换路成功 · 拖动中也会继续攻击" : "上菜！同种同星叠放可以升星"
        : d.kind === "unit" ? "离开料理位会弹回原位" : "拖到圆盘上，再松手");
      this.drag = null;
    } else this.world.pointerUp(p.x, p.y);
  }
  private act(id: string): void {
    if (!this.world || !this.presentation || !this.data) return;
    this.cancel(); this.acc = 0;
    this.sound?.play("pluck");
    if (id === "start" || id === "restart" || id === "home") {
      this.world = new BattleWorld(this.data); this.presentation.reset();
      this.screen = id === "home" ? "home" : "play";
    } else if (id === "pause") this.screen = "pause";
    else if (id === "resume") this.screen = "play";
    else if (id === "sound") { this.muted = !this.muted; if (this.sound) this.sound.muted = this.muted; }
    else if (id === "skill") { if (!this.world.castSkill()) this.presentation.notify("海浪还在蓄力"); }
    else if (id === "tray-next") this.presentation.trayPage = (this.presentation.trayPage + 1) % Math.ceil(this.world.tray.length / 5);
    else if (id.startsWith("draft:")) this.world.chooseUpgrade(id.slice(6));
    else if (id.startsWith("recipe:")) this.world.chooseRecipe(id.slice(7));
  }
  private onKey(e: EventKeyboard): void {
    if (e.keyCode === KeyCode.ESCAPE && this.world?.phase === "combat") {
      if (this.screen === "play") this.act("pause"); else if (this.screen === "pause") this.act("resume");
    }
    if (e.keyCode === KeyCode.SPACE && this.screen === "play") this.act("skill");
  }
  private onHide(): void { if (this.screen === "play" && this.world?.phase === "combat") this.act("pause"); }
  private cancel(): void {
    this.held = false; this.pressed = null; this.drag = null; this.touchId = null;
    this.world?.cancelPointer();
    this.world?.cancelUnitDrag();
  }
  onDestroy(): void {
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    input.off(Input.EventType.KEY_DOWN, this.onKey, this);
    game.off(Game.EVENT_HIDE, this.onHide, this);
  }
}
