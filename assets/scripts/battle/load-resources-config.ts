import { JsonAsset, resources } from "cc";
import type { GameData } from "../core/config-db";

const FILES = [
  "balance",
  "seafood",
  "recipes",
  "upgrades",
  "enemies",
  "bosses",
  "waves",
  "vendors",
  "demo",
] as const;

export function loadResourcesConfig(): Promise<GameData> {
  return new Promise((resolve, reject) => {
    resources.loadDir("config", JsonAsset, (error, assets) => {
      if (error) {
        reject(error);
        return;
      }
      const bag: Record<string, unknown> = {};
      for (const asset of assets) bag[asset.name] = asset.json;
      for (const name of FILES) {
        if (!bag[name]) {
          reject(new Error(`缺少配置 ${name}`));
          return;
        }
      }
      resolve({
        balance: bag.balance,
        seafood: bag.seafood,
        recipes: bag.recipes,
        upgrades: bag.upgrades,
        enemies: bag.enemies,
        bosses: bag.bosses,
        waves: bag.waves,
        vendors: bag.vendors,
        demo: bag.demo,
      } as GameData);
    });
  });
}
