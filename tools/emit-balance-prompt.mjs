/**
 * 把 assets/data 渲染成可阅读的执行 Prompt ③。
 * 先运行 node tools/generate-balance.mjs。
 */
import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(root, "assets", "data");
const read = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));

const balance = read("balance.json");
const seafood = read("seafood.json");
const recipes = read("recipes.json");
const seasonings = read("seasonings.json");
const skills = read("screen-skills.json");
const upgrades = read("upgrades.json");
const enemies = read("enemies.json");
const elites = read("elites.json");
const bosses = read("bosses.json");
const waves = read("waves.json");
const vendors = read("vendors.json");
const catalog = read("catalog.json");
const ttk = read("ttk-notes.json");

if (catalog.length !== 100) throw new Error("catalog is not 100");

const lines = [];
const push = (s = "") => lines.push(s);

push("# 执行 Prompt ③：100 条 Build / 敌人 / Boss 正式数值");
push("");
push("你是《今晚吃海鲜》的数值策划。本文件是给人执行和核对的数值说明。程序只读 `assets/data/*.json`。");
push("");
push("## 修改规则");
push("");
push("- 源文件是 `tools/generate-balance.mjs`。JSON 是生成物。改完运行 `node tools/generate-balance.mjs`，再运行 `node tools/emit-balance-prompt.mjs` 刷新本文件。");
push("- 不要在战斗脚本里写另一套数字。");
push("- 不要把升级做成纯粹的攻击 +10%。每条都要改机制、操作或取舍。现有 57 条已经按这个原则写好，调整时保持这个性质。");
push("- 敌人强度用波次倍率，不要给每一波手写一套新怪物。");
push("- 反制是加压，不是让玩家的 Build 失效。单波被针对的单位数量不超过该波 40%。");
push("");
push("## 目录怎么数到 100");
push("");
push("海鲜 8 种 × 5 星是单位表，不占这 100 个编号。100 条是：");
push("");
push("| 区间 | 数量 | 内容 |");
push("| --- | --- | --- |");
push("| B001–B030 | 30 | 普通升级 |");
push("| B031–B045 | 15 | 稀有升级 |");
push("| B046–B053 | 8 | 史诗升级 |");
push("| B054–B057 | 4 | 传说升级 |");
push("| E001–E012 | 12 | 普通敌人 |");
push("| L001–L004 | 4 | 精英 |");
push("| S001–S005 | 5 | Boss |");
push("| R001–R012 | 12 | 调料 |");
push("| C001–C006 | 6 | 料理方式 |");
push("| X001–X004 | 4 | 调料 4 阶变成的屏幕技能 |");
push("");
push("合计 57 + 12 + 4 + 5 + 12 + 6 + 4 = 100。");
push("");
push("## 全局手感");
push("");
push(`- 灯火 ${balance.lantern.max}。普通漏怪 -${balance.lantern.leakDamage}，精英 -${balance.lantern.eliteLeakDamage}，Boss -${balance.lantern.bossLeakDamage}。`);
push(`- 入场线 y=${balance.layout.spawnLineY}，灯火线 y=${balance.layout.leakLineY}，路程 ${balance.leakDistance} 像素。`);
push(`- 海鲜池容量 ${balance.pond.capacity}，刷新 ${balance.pond.spawnIntervalMin}～${balance.pond.spawnIntervalMax} 秒。`);
push(`- 捞网容量 ${balance.net.capacity}，半径 ${balance.net.radius}，冷却 ${balance.net.cooldown} 秒，上限 ${balance.net.maxCapacity}。`);
push(`- 料理位初始 ${balance.slots.initial}，最多 ${balance.slots.max}，吸附半径 ${balance.slots.snapRadius}。`);
push("- 星级伤害：`round(base * 1.62^(star-1))`。间隔：`base * 0.94^(star-1)`。射程每星 +8。");
push("- 直伤护甲：`max(1, raw - armor)`。持续伤害护甲：`max(1, raw - armor * 0.5)`。");
push("- 波次生命：`1 + (wave-1)*0.16 + floor((wave-1)/6)*0.22`。速度：`1 + (wave-1)*0.012`。");
push("- 金币：`round(基础金币 * (1 + (wave-1)*0.08))`。鱼骨：每波 2，Boss 另加 8。");
push(`- 夜市摊 18 波纯战斗 ${waves.targetCombatSec} 秒。加上约 6 次选择，整局落在 10～12 分钟。`);
push(`- ${ttk.note}`);
push("");
push("## 1 星海鲜");
push("");
push("攻击类型决定弹幕。`hitAir` 为 false 的近战打不中海鸥。海胆的 `targets` 是一次发射的刺数，单目标只吃其中打中的刺。");
push("");
push("| id | 名称 | 类别 | 攻击 | 伤害 | 间隔 | 射程 | 穿透 | 击退 | 暴击 | 目标 | 打飞行 |");
push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const s of seafood) {
  const lv = s.levels[0];
  push(`| ${s.id} | ${lv.name} | ${s.category} | ${s.attackType} | ${lv.damage} | ${lv.interval} | ${lv.range} | ${s.pierce} | ${s.knockback} | ${s.critRate} | ${s.targets} | ${s.hitAir} |`);
}
push("");
push("## 五星成长");
push("");
push("| 种类 | 1 星 | 2 星 | 3 星 | 4 星 | 5 星 |");
push("| --- | --- | --- | --- | --- | --- |");
for (const s of seafood) {
  const cells = s.levels.map((lv) => `${lv.name} ${lv.damage}/${lv.interval}s r${lv.range}`).join(" | ");
  push(`| ${s.name} | ${cells} |`);
}
push("");
push("合成：场上同种类同星级合成星 +1。捞网里同种类数量为 n、组内最高星为 m 时，结果星级为 `min(5, m + n - 1)`。");
push("");
push("## 六种料理");
push("");
for (const r of recipes) {
  push(`### ${r.id} ${r.name}`);
  push("");
  push(`${r.note} 适合：${r.prefer.join("、")}。`);
  push("");
  push("```json");
  push(JSON.stringify(r.mods, null, 2));
  push("```");
  push("");
}
push("## 招牌联动");
push("");
push("这些是机制变化。料理和海鲜同时满足才触发，传说升级 B055 除外。");
push("");
for (const s of balance.signatures) {
  push(`- **${s.skill}**（${s.recipe} + ${s.species}）：${s.rule}`);
}
push("");
push("## 57 条肉鸽升级");
push("");
push("| id | 品质 | 名称 | 效果 | 数据 |");
push("| --- | --- | --- | --- | --- |");
for (const u of upgrades) {
  const data = u.effects.map((e) => `${e.stat} ${e.op} ${JSON.stringify(e.value)}`).join("；");
  const flags = u.flags?.length ? `；标记 ${u.flags.join(",")}` : "";
  push(`| ${u.id} | ${u.rarity} | ${u.name} | ${u.desc} | ${data}${flags} |`);
}
push("");
push("三选一权重建议：普通 70，稀有 22，史诗 7，传说 1。B052 给传说额外 +8 个百分点的权重，不是把传说变成常规。已拥有的升级不再出现。同一 stat 的 mul 连乘，add 累加，set 后者覆盖，flag 只打开一次。");
push("");
push("## 12 种调料");
push("");
push("调料是局内遗物，不是另一套百分比饰品。升到 4 阶时，若 `grantAt4` 有值，4 阶被动改由对应屏幕技能接管，不要把 4 阶数值和屏幕技能叠两次。");
push("");
for (const s of seasonings) {
  push(`### ${s.id} ${s.name}`);
  push("");
  push(`阶梯：${s.chain.join(" → ")}。字段 \`${s.stat}\`。每阶数值：${s.perTier.join(" / ")}。`);
  if (s.rule) push("");
  if (s.rule) push(s.rule);
  if (s.grantAt4) push("");
  if (s.grantAt4) push(`4 阶解锁 ${s.grantAt4}。`);
  push("");
}
push("## 四个屏幕技能");
push("");
for (const s of skills) {
  push(`### ${s.id} ${s.name}`);
  push("");
  push(`来自 ${s.from}。冷却 ${s.cooldown} 秒。${s.rule}`);
  push("");
}
push("## 12 种普通敌人");
push("");
push("表内是第 1 波基础值。实际上场生命再乘该波 `hpMult`，速度再乘 `speedMult`。");
push("");
push("| id | 名称 | 生命 | 速度 | 护甲 | 金币 | 半径 | 飞行 | 能力 |");
push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const e of enemies) {
  push(`| ${e.id} | ${e.name} | ${e.hp} | ${e.speed} | ${e.armor} | ${e.gold} | ${e.radius} | ${e.air} | ${e.ability} |`);
}
push("");
push("## 4 种精英");
push("");
for (const e of elites) {
  push(`### ${e.id} ${e.name}`);
  push("");
  push(`原型 ${e.from}。金币 ${e.gold}。${e.ability}`);
  if (e.hpMul) push(` 生命 = 原型生命 × ${e.hpMul} × 波次倍率。护甲 ${e.armor}。`);
  if (e.hp) push(` 单只基础生命 ${e.hp}，一次出场 ${e.count} 只。`);
  push("");
}
push("## 5 个 Boss");
push("");
push("生命是该 Boss 在自己地图第 18 波的值，不再乘 hpMult。Demo 的垃圾桶鼠王另乘 `demo.json` 的 `bossHpScale` 0.16。");
push("");
for (const b of bosses) {
  push(`### ${b.id} ${b.name}`);
  push("");
  push(`地图 \`${b.map}\`。生命 ${b.hp}，护甲 ${b.armor}，速度 ${b.speed}，半径 ${b.radius}，飞行 ${Boolean(b.air)}。`);
  push("");
  push("新阶段追加技能。文案里写「改为」的，替换同名旧行为。");
  push("");
  b.phases.forEach((p, i) => {
    const pct = Math.round(p.enterBelow * 100);
    const when = i === 0 ? "开场生效" : `生命降到 ${pct}% 及以下时追加`;
    push(`- ${when}：${p.skills.join("；")}`);
  });
  push("");
}
push("## 反制");
push("");
for (const c of balance.counterRules) {
  push(`- 若 ${c.if}，则 ${c.then}。上限：${c.cap}。`);
}
push("");
push("## 夜市摊 18 波");
push("");
push("| 波 | 秒 | 生命倍率 | 速度倍率 | 刷怪 | 事件 |");
push("| --- | --- | --- | --- | --- | --- |");
for (const w of waves.waves) {
  const groups = w.groups.map((g) => `${g.id}×${g.count}`).join("，");
  push(`| ${w.wave} | ${w.duration} | ${w.hpMult} | ${w.speedMult} | ${groups} | ${w.event.type} |`);
}
push("");
push("无尽：从第 19 波起，每波 40 秒，生命倍率在第 18 波基础上每波再 ×1.12，速度封顶 ×1.35。每 5 波换一个 Boss，顺序 S001 → S002 → S003 → S004 → S005 循环。灯火不回满。");
push("");
push("## 三个摊主");
push("");
for (const v of vendors) {
  push(`- **${v.name}**（${v.role}）：被动 ${v.passive} 主动「${v.active.name}」冷却 ${v.active.cooldown} 秒，${v.active.rule}`);
}
push("");
push("## 海鲜池特殊单位");
push("");
for (const s of balance.specialPond) {
  push(`- **${s.name}**（${s.id}，权重 ${s.chance}）：${s.rule}`);
}
push("");
push("## 执行时怎么用");
push("");
push("1. 战斗、UI、敌人全部读 JSON，id 对不上就报错。");
push("2. 改平衡只改 `tools/generate-balance.mjs`，然后重跑生成器和本脚本。");
push("3. 手玩验收看这三件事：一只 1 星小虾能在鼠走到灯火前打死一只偷吃鼠；两只鼠叠在一起会漏；铁桶鼠会逼玩家用持续伤害或高单发，而不是谁都刮得动。");
push("4. 若实机手感偏离，优先改基础伤害、敌人生命和路程，不要先叠新乘区。");
push("");

const out = path.join(root, "docs", "execution", "03-balance-100-prompt.md");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join("\n"), "utf8");
console.log(`wrote ${out} (${catalog.length} catalog, ${lines.length} lines)`);
