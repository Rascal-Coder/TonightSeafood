import assert from "node:assert/strict";
import test from "node:test";
import { applyArmor } from "../assets/scripts/core/armor";
import { canFieldMerge, nextStar } from "../assets/scripts/core/merge";
import { resolveScoop, type PondCritter } from "../assets/scripts/core/scoop";
import { SpatialHash } from "../assets/scripts/core/spatial";

function critter(partial: Partial<PondCritter> & Pick<PondCritter, "speciesId" | "category">): PondCritter {
  return {
    uid: partial.uid ?? 1,
    speciesId: partial.speciesId,
    category: partial.category,
    star: partial.star ?? 1,
    x: partial.x ?? 0,
    y: partial.y ?? 0,
  };
}

test("两只 1 星虾合成 2 星", () => {
  const result = resolveScoop(
    [
      critter({ uid: 1, speciesId: "shrimp", category: "crust" }),
      critter({ uid: 2, speciesId: "shrimp", category: "crust" }),
    ],
    0,
  );
  assert.equal(result.units.length, 1);
  assert.equal(result.units[0].speciesId, "shrimp");
  assert.equal(result.units[0].star, 2);
  assert.equal(result.platter, false);
});

test("三只 1 星虾合成 3 星", () => {
  const result = resolveScoop(
    [1, 2, 3].map((uid) => critter({ uid, speciesId: "shrimp", category: "crust" })),
    0,
  );
  assert.equal(result.units.length, 1);
  assert.equal(result.units[0].star, 3);
});

test("正好两只且双响再加一星", () => {
  const result = resolveScoop(
    [
      critter({ uid: 1, speciesId: "crab", category: "crust", star: 1 }),
      critter({ uid: 2, speciesId: "crab", category: "crust", star: 1 }),
    ],
    1,
  );
  assert.equal(result.units[0].star, 3);
});

test("虾蟹扇贝给出拼盘，但只有两个类别", () => {
  const result = resolveScoop(
    [
      critter({ uid: 1, speciesId: "shrimp", category: "crust" }),
      critter({ uid: 2, speciesId: "crab", category: "crust" }),
      critter({ uid: 3, speciesId: "scallop", category: "shell" }),
    ],
    0,
  );
  assert.equal(result.platter, true);
  assert.equal(result.seasoningCharge, 0);
  assert.equal(result.units.length, 3);
});

test("三个类别给出调料进度", () => {
  const result = resolveScoop(
    [
      critter({ uid: 1, speciesId: "shrimp", category: "crust" }),
      critter({ uid: 2, speciesId: "scallop", category: "shell" }),
      critter({ uid: 3, speciesId: "fish", category: "fish" }),
    ],
    0,
  );
  assert.equal(result.seasoningCharge, 1);
  assert.equal(result.platter, false);
});

test("场上同星可合，不同星不可合，5 星封顶", () => {
  assert.equal(canFieldMerge({ speciesId: "shrimp", star: 1 }, { speciesId: "shrimp", star: 1 }), true);
  assert.equal(canFieldMerge({ speciesId: "shrimp", star: 1 }, { speciesId: "shrimp", star: 2 }), false);
  assert.equal(canFieldMerge({ speciesId: "shrimp", star: 1 }, { speciesId: "crab", star: 1 }), false);
  assert.equal(canFieldMerge({ speciesId: "shrimp", star: 5 }, { speciesId: "shrimp", star: 5 }), false);
  assert.equal(nextStar(2), 3);
  assert.equal(nextStar(5), 5);
});

test("护甲：直伤 5 减 4 得 1，持续伤害只吃一半护甲", () => {
  assert.equal(applyArmor(5, 4, false), 1);
  assert.equal(applyArmor(5, 4, true), 3);
  assert.equal(applyArmor(1, 20, false), 1);
});

test("空间网格只返回附近格子里的单位", () => {
  const hash = new SpatialHash<{ id: number; x: number; y: number }>(64);
  hash.insert({ id: 1, x: 10, y: 10 });
  hash.insert({ id: 2, x: 400, y: 400 });
  const near = hash.queryRadius(12, 12, 20).map((item) => item.id);
  assert.deepEqual(near, [1]);
});
