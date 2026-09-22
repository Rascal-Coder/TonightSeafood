import { ImageAsset, Rect, resources, Size, sp, SpriteFrame, Texture2D, Vec2 } from "cc";

export interface BattleArt {
  board: SpriteFrame;
  crew: Record<string, SpriteFrame>;
  bullets: sp.SkeletonData;
}

function load<T>(path: string, type: any): Promise<T> {
  return new Promise((resolve, reject) => resources.load(path, type, (err, asset) => err ? reject(err) : resolve(asset as T)));
}

export async function loadBattleArt(): Promise<BattleArt> {
  const [board, atlas, bullets] = await Promise.all([
    load<SpriteFrame>("art/night-board-v2/spriteFrame", SpriteFrame),
    load<ImageAsset>("art/crew-v2", ImageAsset),
    load<sp.SkeletonData>("vfx/fly1", sp.SkeletonData),
  ]);
  const texture = new Texture2D();
  texture.image = atlas;
  const crew: Record<string, SpriteFrame> = {};
  ["shrimp", "crab", "scallop", "fish", "rat", "gull"].forEach((id, index) => {
    const frame = new SpriteFrame();
    const w = atlas.width / 3, h = atlas.height / 2;
    frame.reset({ texture, rect: new Rect(index % 3 * w, Math.floor(index / 3) * h, w, h), originalSize: new Size(w, h), offset: new Vec2() });
    crew[id] = frame;
  });
  return { board, crew, bullets };
}
