import test from "node:test";
import assert from "node:assert/strict";
import { frameTween } from "../assets/scripts/battle/PresentationMotion";

test("four-frame idle holds briefly and crossfades with a smooth curve", () => {
  const held = frameTween(0.04, 0, 4, 0.3);
  assert.equal(held.from, 0);
  assert.equal(held.to, 1);
  assert.equal(held.mix, 0);

  const crossing = frameTween(0.24, 0, 4, 0.3);
  assert.ok(crossing.mix > 0 && crossing.mix < 1);
  assert.ok(crossing.bridge > 0);
});

test("frame crossfade is visually continuous at a frame boundary", () => {
  const before = frameTween(0.3 - 1e-6, 0, 4, 0.3);
  const after = frameTween(0.3 + 1e-6, 0, 4, 0.3);
  assert.equal(before.to, after.from);
  assert.ok(before.mix > 0.999);
  assert.equal(after.mix, 0);
});

test("unit ids stagger small loops instead of flashing in lockstep", () => {
  const a = frameTween(0.1, 1, 4, 0.3);
  const b = frameTween(0.1, 2, 4, 0.3);
  assert.notDeepEqual([a.from, a.mix], [b.from, b.mix]);
});

