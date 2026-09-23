import test from "node:test";
import assert from "node:assert/strict";
import { BattleWorld } from "../assets/scripts/core/battle-world";
import { loadGameData } from "./load-data";

function world(): BattleWorld {
  return new BattleWorld(loadGameData(), () => 0.5, { sandbox: true });
}

test("a held seafood keeps its attack origin under the pointer", () => {
  const w = world();
  const shrimp = w.debugPlace("shrimp", 1, "f1");
  shrimp.cooldown = 0;
  assert.ok(w.beginUnitDrag(shrimp.uid));
  assert.ok(w.dragUnit(shrimp.uid, 545, 700));
  w.debugSpawnEnemy("E001", 545, 820);
  w.step(0.05);
  assert.ok(w.shots.some((shot) => shot.ownerUid === shrimp.uid && Math.abs(shot.x - 545) < 8));
});

test("drag contact pushes a ground enemy once per cooldown window", () => {
  const w = world();
  const crab = w.debugPlace("crab", 1, "f1");
  const enemy = w.debugSpawnEnemy("E001", 400, 700);
  enemy.speed = 0;
  w.beginUnitDrag(crab.uid);
  w.dragUnit(crab.uid, enemy.x, enemy.y);
  const before = enemy.y;
  w.step(0.05);
  assert.equal(enemy.y, before + 48);
  w.step(0.05);
  assert.equal(enemy.y, before + 48);
});

test("invalid field drop restores the original slot", () => {
  const w = world();
  const unit = w.debugPlace("scallop", 1, "f1");
  const origin = { x: unit.x, y: unit.y, slotId: unit.slotId };
  w.beginUnitDrag(unit.uid);
  w.dragUnit(unit.uid, 375, 700);
  assert.equal(w.endUnitDrag(unit.uid, 40, 430), false);
  assert.deepEqual({ x: unit.x, y: unit.y, slotId: unit.slotId }, origin);
});

test("enemy runtime records the nearest formal-night lane", () => {
  const w = world();
  assert.equal(w.debugSpawnEnemy("E001", 205, 900).laneId, "left");
  assert.equal(w.debugSpawnEnemy("E001", 375, 900).laneId, "middle");
  assert.equal(w.debugSpawnEnemy("E001", 545, 900).laneId, "right");
});
