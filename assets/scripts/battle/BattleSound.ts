import { AudioClip, AudioSource, Node, resources } from "cc";
import type { BattleFx } from "../core/battle-world";
export class BattleSound {
  muted = false;
  private source: AudioSource;
  private clips = new Map<string, AudioClip>();
  private lastHit = 0;
  constructor(node: Node) {
    this.source = node.addComponent(AudioSource);
    for (const id of ["pluck", "scoop", "merge", "hit", "wave", "lose"]) {
      resources.load(`audio/${id}`, AudioClip, (err, clip) => { if (!err) this.clips.set(id, clip); });
    }
  }
  play(id: string): void {
    const clip = this.clips.get(id);
    if (!this.muted && clip) this.source.playOneShot(clip, 0.6);
  }
  effects(effects: BattleFx[]): void {
    const types = new Set(effects.map((f) => f.type));
    if (types.has("result")) this.play(effects.find((f) => f.type === "result")?.text === "锅还烧着，收摊！" ? "merge" : "lose");
    else if (types.has("leak")) this.play("lose");
    else if (types.has("merge")) this.play("merge");
    else if (types.has("splash")) this.play("scoop");
    else if (types.has("wave")) this.play("wave");
    else if (types.has("hit") && Date.now() - this.lastHit > 150) { this.lastHit = Date.now(); this.play("hit"); }
  }
}
