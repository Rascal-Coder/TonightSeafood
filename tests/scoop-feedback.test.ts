import test from "node:test";
import assert from "node:assert/strict";
import { BattleWorld } from "../assets/scripts/core/battle-world";
import { circleCoverage } from "../assets/scripts/core/scoop";
import { loadGameData } from "./load-data";

function world(): BattleWorld {
  return new BattleWorld(loadGameData(), () => 0.5, { sandbox: true });
}
function critter(uid: number, x: number, y = 180, speciesId = "shrimp") {
  return { uid, x, y, speciesId, category: "seafood", star: 1 };
}

test("quick press and release catches at the pointer without a simulation tick", () => {
  const w = world(); w.pond = [critter(100, 120)];
  w.pointerDown(120, 180);
  assert.equal(w.netX, 120);
  assert.deepEqual(w.previewScoop().map((c) => c.uid), [100]);
  w.pointerUp(120, 180);
  assert.equal(w.tray.length, 1); assert.equal(w.pond.length, 0);
});

test("release consumes its final position, not the previous move event", () => {
  const w = world(); w.pond = [critter(100, 120), critter(101, 600, 180, "crab")];
  w.pointerDown(120, 180); w.pointerMove(300, 180); w.pointerUp(600, 180);
  assert.equal(w.tray[0].speciesId, "crab");
  assert.deepEqual(w.pond.map((c) => c.uid), [100]);
});

test("preview matches capacity, distance and deterministic ties, including radius boundary", () => {
  const w = world();
  w.pond = [critter(102, 400), critter(101, 350), critter(100, 350), critter(103, 700)];
  w.pointerDown(350, 180);
  assert.deepEqual(w.previewScoop().map((c) => c.uid), [100, 101]);
  w.pointerUp(350, 180);
  assert.deepEqual(w.pond.map((c) => c.uid), [102, 103]);
  assert.equal(w.tray[0].star, 2);
  const edge = world(); edge.pond = [critter(104, 350 + edge.netRadius)];
  edge.pointerDown(350, 180);
  assert.equal(edge.previewScoop().length, 1);
});

test("cooldown and cancellation cannot duplicate catches", () => {
  const w = world(); w.pond = [critter(100, 120)];
  w.pointerDown(120, 180); w.pointerUp(120, 180);
  w.pond = [critter(101, 120)];
  w.pointerDown(120, 180); w.pointerUp(120, 180);
  assert.equal(w.tray.length, 1); assert.equal(w.pond.length, 1);
  assert.ok(w.drainFx().some((f) => f.type === "wobble"));
  w.netCooldown = 0;
  w.pointerDown(120, 180); w.cancelPointer(); w.pointerUp(120, 180);
  assert.equal(w.tray.length, 1); assert.equal(w.pond.length, 1);
});

test("a light rim touch is not caught, and release uses the same caught set", () => {
  const w = world();
  const body = w.db.data.balance.net.bodyRadius.shrimp;
  const capture = w.db.data.balance.net.captureCoverage;
  const graze = w.db.data.balance.net.grazeCoverage;
  let grazeD = 0;
  let catchD = 0;
  for (let d = 0; d <= w.netRadius + body; d++) {
    const covered = circleCoverage(d, w.netRadius, body);
    if (covered >= capture) catchD = d;
    else if (covered >= graze) grazeD = d;
  }
  w.pond = [critter(1, 200 + catchD), critter(2, 200 + grazeD)];
  w.pointerDown(200, 180);
  const aim = w.aimNet();
  assert.deepEqual(aim.caught.map((c) => c.uid), [1]);
  assert.deepEqual(aim.grazed.map((c) => c.uid), [2]);
  assert.deepEqual(w.previewScoop().map((c) => c.uid), [1]);
  w.pointerUp(200, 180);
  assert.deepEqual(w.pond.map((c) => c.uid), [2]);
  assert.equal(w.tray.length, 1);
});

test("star and species travel with the shot, and a higher star bursts wider", () => {
  const low = world();
  const shrimp = low.debugPlace("shrimp", 1, "f1");
  shrimp.cooldown = 0;
  low.debugSpawnEnemy("E001", shrimp.x, shrimp.y + 120);
  low.step(0.05);
  const small = low.shots[0];
  const high = world();
  const lobster = high.debugPlace("shrimp", 5, "f1");
  lobster.cooldown = 0;
  high.debugSpawnEnemy("E001", lobster.x, lobster.y + 120);
  high.step(0.05);
  const big = high.shots[0];
  assert.equal(small.speciesId, "shrimp");
  assert.equal(big.speciesId, "shrimp");
  assert.equal(big.star, 5);
  assert.ok(big.radius > small.radius);
  assert.notEqual(big.tint, small.tint);
  const attack = high.drainFx().find((f) => f.type === "attack");
  assert.equal(attack?.speciesId, "shrimp");
  assert.equal(attack?.star, 5);
});

test("net clamps consistently to pond bounds and an empty scoop gives feedback", () => {
  const w = world(); w.pond = [];
  const p = w.db.data.balance.layout.pond;
  w.pointerDown(-100, -100);
  assert.equal(w.netX, p.x); assert.equal(w.netY, p.y);
  w.pointerMove(10000, 10000);
  assert.equal(w.netX, p.x + p.w); assert.equal(w.netY, p.y + p.h);
  w.pointerUp(10000, 10000);
  assert.ok(w.drainFx().some((f) => f.type === "toast" && f.text?.includes("空网")));
  assert.equal(w.netCooldown, 0);
});

test("crab attacks emit one attacker event and directional heavy-hit feedback", () => {
  const w = world();
  const crab = w.debugPlace("crab", 1, "f1");
  crab.cooldown = 0;
  const enemy = w.debugSpawnEnemy("E001", crab.x, crab.y + 50);
  w.step(0.05);
  const fx = w.drainFx();
  assert.equal(fx.filter((f) => f.type === "attack" && f.uid === crab.uid).length, 1);
  const hit = fx.find((f) => f.type === "hit" && f.uid === enemy.uid);
  assert.ok(hit?.heavy); assert.ok(hit.directionY! > 0);
  w.step(0.05);
  assert.equal(w.drainFx().filter((f) => f.type === "attack").length, 0);
});
