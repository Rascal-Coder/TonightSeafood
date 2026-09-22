# 执行 Prompt ①：Cocos 工程架构与第一版可玩 Demo

你是《今晚吃海鲜》（TonightSeafood）的主程。按本 Prompt 在当前仓库做出第一版可玩闭环。不要扩到商城、签到、排行榜、复杂首页。

## 目标

玩家能完成这条循环，并且愿意再开一局：

进入夜市摊位 → 拖动捞网捞海鲜 → 放到料理位 → 海鲜自动攻击 → 敌人倒下掉金币 → 再捞 → 同类合成 → 三选一或料理选择 → 短局 Boss → 结算。

Demo 单局大约 3～5 分钟。架构必须能直接接上正式 18 波，而不是写死一局脚本。

## 已锁定、禁止重做

- 设计分辨率 750×1334，适配 `FIXED_WIDTH`。更高的屏幕只把战斗区上下拉开，海鲜池仍贴底，顶栏仍贴顶。
- 坐标系：Cocos 左下角为原点，y 向上。敌人从 y=1014 走向 y=414。走完 600 像素碰到灯火。
- 分区像素以 `assets/data/balance.json` 的 `layout` 为准。
- 失败条件叫**灯火**，不是基地血条。灯火归零，摊位收灯，本局结束。
- 玩家不点按钮买单位。唯一主操作是捞网。
- 料理位是自由槽位 + 半吸附，不是九宫格，也不是固定三轨。
- 数值只来自 `assets/data/*.json`。这些 JSON 由 `tools/generate-balance.mjs` 生成。要改数字就改生成器，再运行 `node tools/generate-balance.mjs`。不要在组件里写另一套伤害。
- Demo 出场范围读 `assets/data/demo.json`。

## 不要做

- 不要把全部逻辑写进一个 `Game.ts`。
- 不要用代码 `Graphics` 矩形充当最终单位。缺图时可以放同名占位 PNG，但 Prefab、配置、对象池照正式结构做。
- 不要给每种海鲜各写一个巨型脚本。差异放在数据的 `attackType`。
- 不要上物理引擎扫全部弹幕。普通弹用距离 / AABB / 空间网格。Boss 碰撞也先用圆与扇形数学。
- 不要做局外成长、广告、账号。

## 技术

- Cocos Creator 3.8.x，2D。微信小游戏是目标平台，同时保证浏览器预览能玩。
- 语言 TypeScript。
- 逻辑 Tick 20Hz（`logicDt = 0.05`）。表现 60fps，用插值，不要在每个单位的 `update` 里跑战斗规则。
- 若本机没有 Cocos Dashboard：先完成不依赖 `cc` 的核心与测试；场景和 Prefab 等编辑器就绪后再绑。不要伪造打不开的场景文件。把缺的编辑器步骤写进 `docs/execution/BLOCKED.md`。

## 目录

```
assets/
  art/                      # 图由 Prompt ② 生产，文件名先占位
  audio/
  data/                     # 已存在，只读使用
  prefabs/
    battle/SeafoodUnit.prefab
    battle/EnemyUnit.prefab
    battle/Projectile.prefab
    battle/DamageText.prefab
    battle/VfxBurst.prefab
    battle/CoinDrop.prefab
    ui/UpgradeCard.prefab
    ui/ResultPanel.prefab
  scenes/NightStall.scene
  scripts/
    core/                   # 禁止 import 'cc'
    battle/                 # Cocos 组件，只做生成、绑定、表现
    ui/
tests/
```

## 数据怎么读

启动时把下列 JSON 读进一个 `ConfigDB`。用 id 索引，缺 id 直接抛错，不要静默跳过。

- `balance.json`：手感、布局、公式、反制规则、招牌联动
- `seafood.json`：8 种海鲜与 5 星数值
- `recipes.json`：6 种料理
- `upgrades.json`：57 条肉鸽
- `enemies.json` `elites.json` `bosses.json`
- `waves.json`：夜市摊地图 18 波，战斗时长合计 612 秒
- `seasonings.json` `screen-skills.json` `vendors.json`
- `demo.json`：第一版实际出场

Demo 只生成 `enabledSpecies`。波次用 `playWaves`，打完后生成 `bossId`，生命乘 `bossHpScale`（0.16，约 1472）。Boss 技能仍走 `bosses.json` 的原文，不另写一套。

## 运行时分层

**数据层** `assets/scripts/core/`  
纯函数和结构体。Node 测试覆盖。禁止 `import { ... } from 'cc'`。

**逻辑层** `BattleDirector`  
场景里只有这一个组件持有逻辑循环。它持有数组：`pond[]`、`tray[]`、`seafood[]`、`enemies[]`、`projectiles[]`、`effects[]`。每 0.05 秒调用 `step(0.05)`。

**表现层**  
Prefab 视图监听逻辑 id，同步位置、缩放、动画。视图被回收时只隐藏，不 `destroy`。

对象池从第一天就用：`EnemyPool`、`ProjectilePool`、`DamageTextPool`、`VfxPool`、`CoinPool`、`SeafoodPool`。禁止在战斗中 `instantiate` / `destroy` 单位或飘字。

## 核心接口（按这个名字实现）

```ts
export interface PondCritter {
  uid: number;
  speciesId: string;
  star: number;
  x: number;
  y: number;
  special?: "gold" | "mutant" | "seasoned" | "frozen" | "chest";
  recipeId?: string;
}

export interface ScoopResult {
  units: { speciesId: string; star: number; special?: PondCritter["special"]; recipeId?: string }[];
  platter: boolean;
  seasoningCharge: number;
}

export function resolveScoop(
  caught: PondCritter[],
  pairStarBonus: number,
): ScoopResult;
```

捞取规则：

1. 松手时，圆心在捞网半径内的海鲜按距离排序，取前 `net.capacity` 只（初始 2，上限 4）。
2. 同 `speciesId` 分组。1 只原样进托盘。2 只及以上合成 1 只：`star = min(5, 组内最高星 + 数量 - 1)`。若正好 2 只且 `pairStarBonus > 0`（升级 B028），再 +1，仍封顶 5。
3. 同一次捞起里同时有虾、蟹、以及生蚝或扇贝：`platter = true`。Demo 给予 8 金币，并在托盘旁跳一句「海鲜拼盘」。
4. 类别按 `seafood.json` 的 `category`（crust / shell / soft / spine / fish）。一次捞起覆盖至少 3 个类别：`seasoningCharge = 1`。Demo 只记次数并飘字「多了一味调料」，不必展开 12 种调料。
5. 黄金海鲜在 Demo 不刷新（没有 B006）。

场上合成，另写：

```ts
export function canFieldMerge(a: { speciesId: string; star: number }, b: { speciesId: string; star: number }): boolean;
export function nextStar(star: number): number;
```

规则：同种类、同星级、星级 < 5，松手叠在一起合成星 +1。不同星级不能合。合成播放 0.12 秒顿帧：挤压到 scale 0.8、弹回 1.15、回到该星 `displayScale`，旋转 ±8°，闪白，粒子。这是手感，不能省。

伤害：

```ts
export function applyArmor(raw: number, armor: number, dot: boolean): number;
```

`dot === false` 时 `max(1, raw - armor)`。`dot === true` 时 `max(1, raw - armor * 0.5)`。暴击先乘暴击伤害再进护甲。

空间网格格子 64。弹幕只查附近格。

## 场景节点

`NightStall` 下：

```
Canvas
  GameRoot
    Bg
    TopBar          # 波次、灯火、金币、暂停、当前料理图标
    EnemyGate
    BattleZone
      SlotAnchors   # 坐标读 balance.layout.slots
      SeafoodLayer
      ProjectileLayer
      EnemyLayer
      VfxLayer
      FloatTextLayer
    RecipeBar       # 蒜蓉 / 麻辣 两个倾向，Demo 只亮这两个
    Pond
      Water
      CritterLayer
      BubbleLayer
    Net
    Tray            # 捞到、还没放下的海鲜
    SkillButton     # 阿浪的「海浪」
    Overlay         # 教学、三选一、暂停、结算
```

初始开放 `openAtSlotCount <= 5` 的 5 个锚点：f1 f2 f3 b1 b2。其余锚点藏起，等升级加格子再开。

## 海鲜池

- 容量 10。满了就不再刷新。刷新间隔在 2.2～3.6 秒之间随机。
- 不要排队。每只在池内椭圆里缓慢游动，互相用圆分离（半径 36），上下浮动振幅 4、周期 1.6 秒。偶尔翻 `scaleX`。
- 每隔一段时间在随机位置冒 1 个气泡粒子。
- Demo 刷新权重：小虾 50%，青蟹 25%，扇贝 15%，海鱼 10%。第 2 波之前如果玩家还没合成过，下一次刷新强制两只相邻的小虾，保证教学捞得到。

## 捞网手感

- 按下并拖动：网的位置向手指平滑跟随，`lerp` 系数按 `1 - exp(-18 * dt)`。
- 松手：若冷却好了（0.4 秒），按半径 78 捞起，播一次水花。冷却中松手只晃一下网，不捞。
- 网是圆形半透明渔网，跟着手指，不要变成按钮。

## 放置

托盘里的海鲜可拖。

- 松手点离某空锚点 ≤ 52：吸附放下。
- 松手点离同种类同星级单位 ≤ 52：场上合成。
- 松手点离不同单位 ≤ 52：互换位置。
- 其他位置：弹回托盘。
- 放下时若当前灶火是蒜蓉或麻辣，写入该 `recipeId`。宝箱贝 Demo 不出现。

前排锚点 y=820，后排 y=560。后排射程视觉上更长，数据仍用海鲜自己的 `range`。

## 战斗

`step` 顺序固定：

1. 海鲜池刷新与游动
2. 按当前波次时间表刷敌人
3. 敌人移动、技能冷却
4. 海鲜索敌与攻击
5. 弹幕移动与命中
6. 持续伤害、减速、冻结
7. 灯火判定与波次结束

敌人没有寻路。出生 x 在 80～670，y=1014，速度向下。`speed` 再乘该波 `speedMult`。生命乘该波 `hpMult`。

Demo 敌人只用：

- E001 偷吃鼠
- E002 快跑鼠
- E005 海鸥：`air = true`。青蟹 `hitAir = false`，打不中海鸥。虾、扇贝、海鱼打得中。

漏怪：普通敌人碰到 y≤414，灯火 -1。精英 -2。Boss -3。然后回收。

四种攻击，全部由 `attackType` 分发：

| attackType | Demo 单位 | 表现 |
| --- | --- | --- |
| pellet | 虾 | 小、快、直线 |
| claw | 蟹 | 近战钳击，带击退，不打飞行 |
| fan | 扇贝 | 朝上 72° 扇形，范围内敌人都吃到 |
| blade | 海鱼 | 长条水刃，穿透次数读 `pierce` |

索敌：射程内最近，且自己打得中的敌人。没有目标就待机。

命中至少包含：单位压缩再伸展、目标闪白、击退位移、一个粒子、一个飘字。暴击飘字放大 1.6 倍并上色。重击（蟹、Boss 冲撞）HitStop 40ms。Boss 滚桶 120ms。同一帧多个 HitStop 取最大，不要叠满。

## 料理（Demo 只开两条，结构按六条做）

灶火是全局倾向。新放下的海鲜抄当前灶火。已经在场上的不改，除非玩家把它捞回再放下（Demo 可以先不做捞回）。

- 蒜蓉 C001：命中挂每 0.5 秒 3 点的香伤，持续 2 秒。同一目标每第 4 次命中，半径 48 爆香，伤害为该次的 40%。
- 麻辣 C002：攻击间隔 ×0.85。每 5 次攻击，辣油再跳 2 个目标，系数 0.7 和 0.5。

招牌联动先实现两条，数据在 `balance.json` 的 `signatures`：

- 蒜蓉 + 生蚝：Demo 没有生蚝，函数留好，不在 Demo 触发。
- 麻辣 + 虾：麻辣连弹，每 5 次攻击跳 3 段，系数 0.70 / 0.50 / 0.35。这条 Demo 必须打得出来。

## 波次与选择

Demo 跑 `waves.json` 里 wave 1～5 的 `groups` 和 `duration`，但把组内敌人 id 滤掉不在 `enabledEnemies` 的项。滤空的组改成同等数量的偷吃鼠，避免空波。

- 第 3 波结束：三选一，选项固定为 B002 海鲜快手、B003 厚网、B009 重钳。选完立刻改 `RunMods`。
- 第 4 波结束：在蒜蓉和麻辣里选一个，成为当前灶火。
- 第 5 波结束：进入垃圾桶鼠王。生命 = `9200 * 0.16`。技能照 `bosses.json`：桶盖格挡、召唤偷吃鼠、半血后滚桶。滚桶会把撞到的料理单位推 36 像素；若推出锚点吸附范围，吸附回最近空位，没有空位就停在被推后的位置并视为暂时脱锚，0.4 秒后再吸一次。

正式 18 波的事件类型（`draft`、`recipeOffer`、`elite`、`counterShift`）写成 `WaveEvent` 开关，Demo 没走到的分支可以空实现，但不要用 `if (wave===3)` 散落在渲染代码里。

## 摊主

Demo 固定阿浪。被动：捞网跟随系数 18 × 1.10。主动「海浪」在右下角，冷却 24 秒：地面敌人沿 +y 推回 160 像素，飞行单位只减速 40% 共 1.5 秒。海浪必须能改变玩家操作，所以教程不强制使用，但 Boss 滚桶阶段玩家用得上。

## 教学

只在第一局，四句，出现在操作点旁边，不要文字墙。

1. 还没捞起过：「拖动捞网」。完成条件：捞网移动超过 40 像素。
2. 「捞两只一样的」。完成条件：托盘出现星级 ≥2 的虾，或场上合成过。
3. 「放到料理台」。完成条件：场上有 1 只海鲜并且打出过一次攻击。
4. 第一次三选一出现时：「选一个强化」。选完之后删除教学组件，本局不再出现。

## 结算

灯火归零或 Boss 死亡进入结算。显示：波次、击倒数、金币、鱼骨（每波 2，Boss 另加 8）、本局灶火、是否合成到 3 星。两个按钮：「再来一局」「回到摊位」。回到摊位在 Demo 就是重开本场景。不要接局外养成。

## 实现顺序

每步都要能玩或能测，再做下一步。

1. `ConfigDB` 与核心纯函数：捞取、场上合成、护甲、空间网格。
2. `npx tsx --test tests/core.test.ts` 通过。测试至少覆盖：两只 1 星虾合成 2 星；三只 1 星虾合成 3 星；虾+蟹+扇贝给出拼盘；三种类别给出调料进度；蟹打不中飞行标记；护甲 4 点时 5 点直伤变 1、持续伤害仍高于 1。
3. 场景骨架、顶栏灯火、池子游动、捞网。
4. 托盘与吸附放置。
5. 偷吃鼠 + 小虾自动攻击 + 飘字 + 漏怪扣灯火。
6. 蟹、扇贝、海鱼三种攻击，以及海鸥对近战免疫。
7. 合成反馈。
8. 蒜蓉、麻辣与麻辣连弹。
9. 三选一和阿浪海浪。
10. 垃圾桶鼠王与结算。
11. 把对象池接到上述全部生成点，确认战斗中没有 `instantiate`。

## 性能检查

在浏览器预览里，Demo 满场时：

- 同屏敌人不超过 Demo 的实际数量即可，但池子 API 按 120 敌人、300 弹幕设计，禁止每发弹一个独立组件 `update`。
- 逻辑更新只在 `BattleDirector.step`。
- 画布上不要叠三层全屏半透明。

## 体验检查（必须手玩，不能只看编译）

- 10 秒内捞到第一只虾并放下。
- 30 秒内完成一次合成，并且外形缩放明显变大。
- 海鸥飞过时，只有远程海鲜在打它；蟹的钳子打空要看得出来。
- 选了麻辣之后，虾打满 5 下会跳出辣油，而不是只加攻速。
- 鼠王滚桶会推动料理位置，玩家需要重新捞或用海浪。
- 灯火会掉。空场故意漏 20 只鼠，游戏会结束并给出结算。
- 再来一局是干净的，没有上一局的海鲜、弹幕、冷却。

## 完成定义

浏览器里能从教学打到鼠王结算，核心测试通过，战斗脚本里没有第二套写死数值。做到这里就停，把下一阶段（其余 4 种海鲜、精英、反制权重）留作后续，不要顺手做局外系统。
