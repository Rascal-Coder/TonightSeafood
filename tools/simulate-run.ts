import { BattleWorld } from '../assets/scripts/core/battle-world';
import { loadGameData } from '../tests/load-data';
// Exercise the public gameplay operations, never debug-kill enemies or grant resources.
const reports = [];
for (const seed of [42, 1337, 2026]) {
  let state = seed;
  const rng = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const world = new BattleWorld(loadGameData(), rng);
  let nextScoop = 0;
  const phases = new Set<string>();
  for (let tick = 0; tick < 12000 && world.phase !== 'result'; tick++) {
    phases.add(world.phase);
    if (world.phase === 'draft') world.chooseUpgrade('B002');
    if (world.phase === 'recipe') world.chooseRecipe('C002');
    if (tick >= nextScoop && world.pond.length) {
      const critter = world.pond[0];
      world.pointerDown(critter.x, critter.y); nextScoop = tick + 24;
    }
    world.step(0.05);
    if (world.draggingNet && tick === nextScoop - 16) world.pointerUp(world.netX, world.netY);
    for (const item of [...world.tray]) {
      const match = world.tray.find((u) => u.uid !== item.uid && u.speciesId === item.speciesId && u.star === item.star && u.star < 5);
      if (match) world.mergeTray(item.uid, match.uid);
    }
    for (const item of [...world.tray]) {
      const merge = world.seafood.find((u) => u.speciesId === item.speciesId && u.star === item.star && u.star < 5);
      const empty = world.openSlots().find((s) => !world.seafood.some((u) => u.slotId === s.id));
      const lower = [...world.seafood].sort((a, b) => a.star - b.star).find((u) => u.star < item.star);
      const slot = merge || empty || lower;
      if (slot) world.dropTray(item.uid, slot.x, slot.y);
    }
    // Consolidate matching defenders to free room for new species.
    for (const unit of [...world.seafood]) {
      const match = world.seafood.find((u) => u.uid !== unit.uid && u.star === unit.star && u.speciesId === unit.speciesId && u.star < 5);
      if (match) world.moveUnit(unit.uid, match.x, match.y);
    }
    if (world.enemies.some((e) => e.y < 580)) world.castSkill();
    world.drainFx();
  }
  reports.push({ seed, result: world.result, seconds: Math.round(world.elapsed), wave: world.waveLabel, lantern: world.lantern, kills: world.kills, phases: [...phases], units: world.seafood.map((u) => `${u.speciesId}:${u.star}`) });
}
console.log(JSON.stringify(reports, null, 2));
// This is a simple player strategy, not an invincibility test. Require a reachable
// victory and bounded completion on every seed; losing remains part of gameplay.
if (!reports.some((r) => r.result === 'win') || reports.some((r) => r.result === null)) process.exitCode = 1;
