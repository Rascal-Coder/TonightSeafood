import test from "node:test";
import assert from "node:assert/strict";
import { BattleWorld } from "../assets/scripts/core/battle-world";
import { loadGameData } from "./load-data";

function world(): BattleWorld {
  return new BattleWorld(loadGameData(), () => 0.5, { sandbox: true });
}

test("an enemy crossing the fail line removes lantern and reports the full consequence", () => {
  const w = world();
  const before = w.lantern;
  const enemy = w.debugSpawnEnemy("E001", 375, w.db.data.balance.layout.leakLineY + 1);
  enemy.speed = 100;
  w.step(0.05);
  assert.equal(w.enemies.length, 0);
  assert.equal(w.lantern, before - enemy.leakDamage);
  assert.equal(w.leaks, 1);
  assert.equal(w.lanternLost, enemy.leakDamage);
  const leak = w.drainFx().find((fx) => fx.type === "leak");
  assert.equal(leak?.amount, enemy.leakDamage);
  assert.equal(leak?.remaining, w.lantern);
  assert.equal(leak?.text, `-${enemy.leakDamage}`);
});

test("elite ids are assigned elite pot damage when they spawn", () => {
  const w = world();
  // The runtime damage rule is id-driven even before elite content enters the demo roster.
  w.db.enemies.set("L_TEST", { ...w.db.requireEnemy("E001"), id: "L_TEST", name: "测试头目" });
  const elite = w.debugSpawnEnemy("L_TEST", 375, 800);
  assert.equal(elite.leakDamage, w.db.data.balance.lantern.eliteLeakDamage);
});

test("the boss parks at the pot and bites every two seconds without being removed", () => {
  const w = world();
  const boss = w.debugSpawnEnemy("E001", 375, 600);
  boss.boss = true;
  boss.leakDamage = w.db.data.balance.lantern.bossLeakDamage;
  boss.y = w.db.data.balance.layout.leakLineY + boss.radius;
  boss.parked = true;
  boss.leakPulse = 0.05;
  const before = w.lantern;
  w.step(0.05);
  assert.ok(w.enemies.includes(boss));
  assert.equal(w.lantern, before - w.db.data.balance.lantern.bossLeakDamage);
  assert.equal(w.drainFx().find((fx) => fx.type === "leak")?.text, "-3");
  w.step(1.9);
  assert.equal(w.lantern, before - w.db.data.balance.lantern.bossLeakDamage);
  w.step(0.1);
  assert.equal(w.lantern, before - w.db.data.balance.lantern.bossLeakDamage * 2);
});

test("rapid leaks form a readable combo and the streak expires", () => {
  const w = world();
  const y = w.db.data.balance.layout.leakLineY - 1;
  w.debugSpawnEnemy("E001", 300, y);
  w.debugSpawnEnemy("E001", 450, y);
  w.step(0.05);
  const leaks = w.drainFx().filter((fx) => fx.type === "leak");
  assert.deepEqual(leaks.map((fx) => fx.combo), [1, 2]);
  assert.equal(w.leakCombo, 2);
  w.step(1.55);
  assert.equal(w.leakCombo, 0);
});
