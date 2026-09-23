import { ImageAsset, Rect, resources, Size, sp, SpriteFrame, Texture2D, Vec2 } from "cc";

export interface BattleArt {
  board: SpriteFrame;
  crew: Record<string, SpriteFrame>;
  bullets: sp.SkeletonData;
  /** 2×3 sheets: seafood attack, rat walk, gull flap. Index 0 is the idle pose. */
  sheets: Record<string, SpriteFrame[]>;
  net: SpriteFrame[];
  plate: SpriteFrame;
  tray: SpriteFrame;
  lantern: SpriteFrame;
  seasoning: SpriteFrame;
  merge: SpriteFrame[];
  /** Star 1 uses a 4-frame idle loop; stars 2-5 use distinct evolved silhouettes. */
  starIdle: Record<string, SpriteFrame[][]>;
  /** Stars 2-5 attack rows. Fish intentionally uses its evolved still with procedural recoil. */
  starAttack: Record<string, SpriteFrame[][]>;
}

const SHEETS: Record<string, string> = {
  shrimp: "art/shrimp-attack",
  crab: "art/crab-attack",
  scallop: "art/scallop-attack",
  fish: "art/fish-attack",
  rat: "art/rat-walk",
  gull: "art/gull-fly",
};

function load<T>(path: string, type: any): Promise<T> {
  return new Promise((resolve, reject) => resources.load(path, type, (err, asset) => err ? reject(err) : resolve(asset as T)));
}

function sliceSheet(atlas: ImageAsset, cols = 3, rows = 2): SpriteFrame[] {
  const texture = new Texture2D();
  texture.image = atlas;
  const w = atlas.width / cols, h = atlas.height / rows;
  return Array.from({ length: cols * rows }, (_, index) => {
    const frame = new SpriteFrame();
    frame.reset({
      texture,
      rect: new Rect((index % cols) * w, Math.floor(index / cols) * h, w, h),
      originalSize: new Size(w, h),
      offset: new Vec2(),
    });
    return frame;
  });
}

export async function loadBattleArt(): Promise<BattleArt> {
  const ids = Object.keys(SHEETS);
  const seafoodIds = ["shrimp", "crab", "scallop", "fish"];
  const idlePaths = seafoodIds.map((id) => `art/star-up/${id}-idle-star1/sheet-transparent`);
  const evolvedAttackIds = ["shrimp", "crab", "scallop"];
  const evolvedIdlePaths = evolvedAttackIds.map((id) => `art/star-up/${id}-idle-stars2-5/sheet-transparent`);
  const evolvedAttackPaths = evolvedAttackIds.map((id) => `art/star-up/${id}-attack-stars2-5/sheet-transparent`);
  const fishPaths = [2, 3, 4, 5].map((star) => `art/star-up/fish-star${star}/sheet-transparent`);
  const [board, atlas, bullets, netAtlas, plate, tray, lantern, seasoning, mergeAtlas, ...allAtlases] = await Promise.all([
    load<SpriteFrame>("art/night-board-v2/spriteFrame", SpriteFrame),
    load<ImageAsset>("art/crew-v2", ImageAsset),
    load<sp.SkeletonData>("vfx/fly1", sp.SkeletonData),
    load<ImageAsset>("art/net-scoop", ImageAsset),
    load<ImageAsset>("art/plate", ImageAsset),
    load<ImageAsset>("art/tray", ImageAsset),
    load<ImageAsset>("art/lantern", ImageAsset),
    load<ImageAsset>("art/seasoning", ImageAsset),
    load<ImageAsset>("art/merge-glow", ImageAsset),
    ...ids.map((id) => load<ImageAsset>(SHEETS[id], ImageAsset)),
    ...idlePaths.map((path) => load<ImageAsset>(path, ImageAsset)),
    ...evolvedIdlePaths.map((path) => load<ImageAsset>(path, ImageAsset)),
    ...evolvedAttackPaths.map((path) => load<ImageAsset>(path, ImageAsset)),
    ...fishPaths.map((path) => load<ImageAsset>(path, ImageAsset)),
  ]);
  const sheetAtlases = allAtlases.slice(0, ids.length);
  const evolvedIdleStart = ids.length + seafoodIds.length;
  const idleAtlases = allAtlases.slice(ids.length, evolvedIdleStart);
  const evolvedAttackStart = evolvedIdleStart + evolvedAttackIds.length;
  const fishStart = evolvedAttackStart + evolvedAttackIds.length;
  const evolvedIdleAtlases = allAtlases.slice(evolvedIdleStart, evolvedAttackStart);
  const evolvedAttackAtlases = allAtlases.slice(evolvedAttackStart, fishStart);
  const fishAtlases = allAtlases.slice(fishStart);
  const texture = new Texture2D();
  texture.image = atlas;
  const crew: Record<string, SpriteFrame> = {};
  ["shrimp", "crab", "scallop", "fish", "rat", "gull"].forEach((id, index) => {
    const frame = new SpriteFrame();
    const w = atlas.width / 3, h = atlas.height / 2;
    frame.reset({ texture, rect: new Rect(index % 3 * w, Math.floor(index / 3) * h, w, h), originalSize: new Size(w, h), offset: new Vec2() });
    crew[id] = frame;
  });
  const sheets: Record<string, SpriteFrame[]> = {};
  ids.forEach((id, index) => {
    sheets[id] = sliceSheet(sheetAtlases[index]);
    crew[id] = sheets[id][0];
  });
  const starIdle: Record<string, SpriteFrame[][]> = {};
  seafoodIds.forEach((id, index) => { starIdle[id] = [sliceSheet(idleAtlases[index], 2, 2)]; });
  const starAttack: Record<string, SpriteFrame[][]> = {};
  evolvedAttackIds.forEach((id, index) => {
    const frames = sliceSheet(evolvedAttackAtlases[index], 6, 4);
    starAttack[id] = Array.from({ length: 4 }, (_, row) => frames.slice(row * 6, row * 6 + 6));
    const idleForms = sliceSheet(evolvedIdleAtlases[index], 2, 2);
    for (let form = 0; form < 4; form++) starIdle[id].push([idleForms[form]]);
  });
  starAttack.fish = [];
  fishAtlases.forEach((image) => starIdle.fish.push(sliceSheet(image, 1, 1)));
  return {
    board, crew, bullets, sheets,
    net: sliceSheet(netAtlas),
    plate: sliceSheet(plate, 1, 1)[0],
    tray: sliceSheet(tray, 1, 1)[0],
    lantern: sliceSheet(lantern, 1, 1)[0],
    seasoning: sliceSheet(seasoning, 1, 1)[0],
    merge: sliceSheet(mergeAtlas, 2, 2),
    starIdle,
    starAttack,
  };
}
