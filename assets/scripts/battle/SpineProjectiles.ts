import { Node, sp } from "cc";
import type { Shot } from "../core/battle-world";
import { child } from "./BattlePainter";

/** Original S818TX31 Spine 3.8 animations, no conversion to still images. */
export class SpineProjectiles {
  private pool: sp.Skeleton[] = [];
  private live = new Map<number, sp.Skeleton>();
  constructor(parent: Node, data: sp.SkeletonData) {
    const layer = child("OriginalSpineProjectiles", parent);
    const animations = data.getRuntimeData()?.animations.map((a) => a.name) ?? [];
    for (const name of ["fly_3", "fly_10"]) {
      if (!animations.includes(name)) throw new Error(`攻击动画缺失：${name}`);
    }
    for (let i = 0; i < 64; i++) {
      const skeleton = child("Bullet", layer).addComponent(sp.Skeleton);
      skeleton.skeletonData = data;
      skeleton.premultipliedAlpha = true;
      skeleton.node.active = false;
      this.pool.push(skeleton);
    }
    console.info("原版 Spine 3.8 特效就绪", animations.length, "animations");
  }
  sync(shots: Shot[], paused: boolean): void {
    const ids = new Set(shots.map((s) => s.uid));
    for (const [id, skeleton] of this.live) {
      if (ids.has(id)) continue;
      skeleton.node.active = false; skeleton.clearTracks();
      this.pool.push(skeleton); this.live.delete(id);
    }
    for (const shot of shots) {
      let skeleton = this.live.get(shot.uid);
      if (!skeleton) {
        skeleton = this.pool.pop(); if (!skeleton) continue;
        skeleton.node.active = true;
        skeleton.setAnimation(0, shot.kind === "blade" ? "fly_10" : "fly_3", true);
        this.live.set(shot.uid, skeleton);
      }
      skeleton.paused = paused;
      skeleton.node.setPosition(shot.x, shot.y);
      skeleton.node.angle = Math.atan2(shot.vy, shot.vx) * 180 / Math.PI;
      skeleton.node.setScale(shot.kind === "blade" ? 0.65 : 0.4, shot.kind === "blade" ? 0.65 : 0.4, 1);
    }
  }
}
