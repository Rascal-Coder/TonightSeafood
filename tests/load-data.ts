import fs from "node:fs";
import path from "node:path";
import type { GameData } from "../assets/scripts/core/config-db";

const root = path.resolve(import.meta.dirname, "..");

function read(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(root, "assets", "data", name), "utf8"));
}

export function loadGameData(): GameData {
  return {
    balance: read("balance.json"),
    seafood: read("seafood.json"),
    recipes: read("recipes.json"),
    upgrades: read("upgrades.json"),
    enemies: read("enemies.json"),
    bosses: read("bosses.json"),
    waves: read("waves.json"),
    vendors: read("vendors.json"),
    demo: read("demo.json"),
  } as GameData;
}
