import assert from "node:assert/strict";
import test from "node:test";
import { BattleWorld } from "../assets/scripts/core/battle-world";
import { ConfigDB } from "../assets/scripts/core/config-db";
import { loadGameData } from "./load-data";

const data = loadGameData();

test("缺配置会直接报错", () => {
  const db = new ConfigDB(data);
  assert.throws(() => db.requireEnemy("NOPE"), /缺少敌人配置/);
});

test("一只小虾能在偷吃鼠走到灯火前打死它", () => {
  const world = new BattleWorld(data, () => 0, { sandbox: true });
  world.debugPlace("shrimp", 1, "f2");
  const rat = world.debugSpawnEnemy("E001", 440, 960);
  world.step(6);
  assert.equal(world.enemies.some((enemy) => enemy.uid === rat.uid), false);
  assert.equal(world.lantern, 20);
  assert.ok(world.gold > 0);
});

test("青蟹打不中海鸥", () => {
  const world = new BattleWorld(data, () => 0, { sandbox: true });
  world.debugPlace("crab", 1, "f2");
  const gull = world.debugSpawnEnemy("E005", 440, 880);
  const hp = gull.hp;
  world.step(3);
  const alive = world.enemies.find((enemy) => enemy.uid === gull.uid);
  assert.ok(alive);
  assert.equal(alive?.hp, hp);
});

test("麻辣虾打满五次会跳出连弹", () => {
  const world = new BattleWorld(data, () => 0, { sandbox: true });
  world.debugPlace("shrimp", 1, "f2");
  world.debugSetRecipe("C002");
  world.debugSpawnEnemy("E001", 440, 960);
  world.enemies[0].hp = 9999;
  world.enemies[0].maxHp = 9999;
  world.step(4);
  assert.ok(world.chainProcs >= 1);
});

test("同星叠在一起会合成，灯火归零会收摊", () => {
  const world = new BattleWorld(data, () => 0, { sandbox: true });
  const first = world.debugPlace("shrimp", 1, "f1");
  world.tray.push({ uid: 900, speciesId: "shrimp", category: "crust", star: 1 });
  assert.equal(world.dropTray(900, first.x, first.y), true);
  assert.equal(first.star, 2);
  assert.equal(world.seafood.length, 1);

  for (let i = 0; i < 20; i++) world.debugSpawnEnemy("E001", 200, 400);
  world.step(0.05);
  assert.equal(world.phase, "result");
  assert.equal(world.result, "lose");
  assert.equal(world.lantern, 0);
});

test("第三波清空后进入三选一", () => {
  const world = new BattleWorld(data, () => 0.4);
  for (let i = 0; i < 3000 && world.phase === "combat"; i++) {
    world.debugDefeatAll();
    world.step(0.2);
  }
  assert.equal(world.phase, "draft");
  world.chooseUpgrade(data.demo.draftIds[0]);
  assert.equal(world.tutorialDone, true);
  assert.equal(world.phase, "combat");
});

test("场上海鲜可换位、同星合成，非法拖放不丢失单位", () => {
  const world = new BattleWorld(data, () => 0, { sandbox: true });
  const a = world.debugPlace("shrimp", 1, "f1");
  const b = world.debugPlace("crab", 1, "f2");
  const oldA = { x: a.x, y: a.y, slot: a.slotId };
  assert.equal(world.moveUnit(a.uid, 999, -100), false);
  assert.equal(a.slotId, oldA.slot);
  assert.equal(world.moveUnit(a.uid, b.x, b.y), true);
  assert.equal(b.slotId, oldA.slot);
  const c = world.debugPlace("shrimp", 1, "b1");
  assert.equal(world.moveUnit(c.uid, a.x, a.y), true);
  assert.equal(a.star, 2);
  assert.equal(world.seafood.length, 2);
  assert.equal(world.seafood.some((u) => u.uid === c.uid), false);
});

test("结算后拖放和技能不会继续改变战局", () => {
  const world = new BattleWorld(data, () => 0, { sandbox: true });
  const a = world.debugPlace("shrimp", 1, "f1");
  world.tray.push({ uid: 12345, speciesId: "shrimp", category: "crust", star: 1 });
  for (let i = 0; i < 20; i++) world.debugSpawnEnemy("E001", 200, 400);
  world.step(0.05);
  assert.equal(world.dropTray(12345, a.x, a.y), false);
  assert.equal(world.moveUnit(a.uid, 440, 820), false);
  assert.equal(world.castSkill(), false);
  assert.equal(world.tray.length, 1);
});

test("无 Boss 的最后一波会胜利结算，重复击杀不重复领奖", () => {
  const config = structuredClone(data);
  config.demo.playWaves = [1]; config.demo.appendBossAfter = false;
  const world = new BattleWorld(config, () => 0.5);
  for (let i = 0; i < 600 && world.phase === "combat"; i++) { world.debugDefeatAll(); world.step(0.05); }
  assert.equal(world.result, "win");
  assert.equal(world.kills, config.waves.waves[0].groups.reduce((n, g) => n + g.count, 0));
  const gold = world.gold; world.debugDefeatAll(); assert.equal(world.gold, gold);
});

test("开局备菜和初始水池可操作，重开是独立状态", () => {
  const world = new BattleWorld(data, () => 0.5);
  assert.equal(world.pond.length, data.balance.pond.initialCount);
  world.step(2);
  assert.equal(world.enemies.length, 0);
  assert.ok(world.preparingSeconds > 0);
  const fresh = new BattleWorld(data);
  assert.equal(fresh.gold, 0); assert.equal(fresh.skillCd, 0);
  assert.equal(fresh.tray.length, 0); assert.equal(fresh.seafood.length, 0);
});

test("托盘同种同星可合成，异种、同一个单位和满星不会消失", () => {
  const world = new BattleWorld(data, () => 0.5, { sandbox: true });
  world.tray = [
    { uid: 800, speciesId: "shrimp", category: "crust", star: 1 },
    { uid: 801, speciesId: "shrimp", category: "crust", star: 1 },
    { uid: 802, speciesId: "crab", category: "crust", star: 1 },
  ];
  assert.equal(world.mergeTray(800, 800), false);
  assert.equal(world.mergeTray(800, 802), false);
  assert.equal(world.mergeTray(800, 801), true);
  assert.equal(world.tray.length, 2);
  assert.equal(world.tray.find((u) => u.uid === 801)?.star, 2);
});
