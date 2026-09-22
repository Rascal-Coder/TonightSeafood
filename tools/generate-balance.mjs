/**
 * 《今晚吃海鲜》正式数值生成器。
 * 输出 assets/data/*.json，并断言目录恰好 100 条（Build / 敌人 / Boss / 调料 / 料理 / 屏幕技能）。
 * 海鲜 8×5 星是单位表，不计入这 100 条。
 */
import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(root, "assets", "data");
fs.mkdirSync(dataDir, { recursive: true });

const round = (n, d = 2) => {
  const p = 10 ** d;
  return Math.round(n * p) / p;
};
const iround = (n) => Math.max(1, Math.round(n));

const balance = {
  version: "0.1.0",
  design: { width: 750, height: 1334, policy: "FIXED_WIDTH" },
  tick: { logicHz: 20, logicDt: 0.05, visualFps: 60, spatialCell: 64 },
  lantern: { max: 20, leakDamage: 1, bossLeakDamage: 3, eliteLeakDamage: 2 },
  leakDistance: 600,
  pond: {
    capacity: 10,
    initialCount: 6,
    spawnIntervalMin: 2.2,
    spawnIntervalMax: 3.6,
    maxSpeed: 28,
    separateRadius: 36,
    bobAmplitude: 4,
    bobPeriod: 1.6,
  },
  net: { capacity: 2, radius: 78, cooldown: 0.4, followLerp: 18, maxCapacity: 4 },
  slots: { initial: 5, max: 8, snapRadius: 52 },
  merge: { maxStar: 5, fieldRule: "sameSpeciesSameStar", scoopRule: "maxStar + count - 1" },
  growth: { starDamage: 1.62, starInterval: 0.94, starRangeAdd: 8 },
  combat: {
    openingGraceSeconds: 6,
    critDamageDefault: 1.5,
    hitStopMs: { normal: 0, heavy: 40, boss: 120 },
    armorFormula: "max(1, hit - armor)",
    dotArmorFactor: 0.5,
  },
  economy: {
    fishbonePerWave: 2,
    fishbonePerBoss: 8,
    goldWaveGrowth: 0.08,
  },
  hpMult(wave) {
    return round(1 + (wave - 1) * 0.16 + Math.floor((wave - 1) / 6) * 0.22, 3);
  },
  speedMult(wave) {
    return round(1 + (wave - 1) * 0.012, 3);
  },
};

const starNames = {
  shrimp: ["小虾", "基围虾", "黑虎虾", "大龙虾", "黄金龙虾"],
  crab: ["小青蟹", "梭子蟹", "面包蟹", "帝王蟹", "深海蟹王"],
  oyster: ["小生蚝", "肥蚝", "珍珠蚝", "金蚝", "海后蚝"],
  scallop: ["小扇贝", "鲜扇贝", "彩扇贝", "扇贝王", "潮汐扇贝"],
  squid: ["小鱿鱼", "枪乌贼", "墨鱼", "大王鱿", "深渊鱿"],
  urchin: ["小海胆", "刺海胆", "紫海胆", "海胆王", "星刺胆"],
  fish: ["小黄鱼", "鲈鱼", "石斑", "金枪鱼", "龙鱼"],
  octopus: ["小章鱼", "八爪鱼", "章鱼哥", "章鱼王", "千手章"],
};

const species = [
  {
    id: "shrimp", name: "虾", category: "crust", attackType: "pellet",
    baseDamage: 5, interval: 0.5, range: 170, projectileSpeed: 680,
    pierce: 0, knockback: 6, critRate: 0.05, critDamage: 1.5,
    targets: 1, hitAir: true, projectileRadius: 10,
    tags: ["shrimp", "fast", "single"],
    attackEffect: "fx_pellet", hitEffect: "fx_hit_spark",
  },
  {
    id: "crab", name: "蟹", category: "crust", attackType: "claw",
    baseDamage: 18, interval: 1.15, range: 100, projectileSpeed: 0,
    pierce: 0, knockback: 52, critRate: 0.08, critDamage: 1.5,
    targets: 1, hitAir: false, projectileRadius: 28,
    tags: ["crab", "melee", "knockback"],
    attackEffect: "fx_claw", hitEffect: "fx_hit_heavy",
  },
  {
    id: "oyster", name: "生蚝", category: "shell", attackType: "pearl",
    baseDamage: 34, interval: 1.75, range: 250, projectileSpeed: 420,
    pierce: 0, knockback: 0, critRate: 0.12, critDamage: 1.6,
    targets: 1, hitAir: true, projectileRadius: 16,
    tags: ["oyster", "sniper", "single"],
    attackEffect: "fx_pearl", hitEffect: "fx_hit_pearl",
  },
  {
    id: "scallop", name: "扇贝", category: "shell", attackType: "fan",
    baseDamage: 10, interval: 1.05, range: 160, projectileSpeed: 360,
    pierce: 0, knockback: 14, critRate: 0.04, critDamage: 1.5,
    targets: 1, hitAir: true, projectileRadius: 0, coneDeg: 72,
    tags: ["scallop", "cone", "wave"],
    attackEffect: "fx_fanwave", hitEffect: "fx_hit_splash",
  },
  {
    id: "squid", name: "鱿鱼", category: "soft", attackType: "ink",
    baseDamage: 8, interval: 1.3, range: 150, projectileSpeed: 300,
    pierce: 0, knockback: 0, critRate: 0.03, critDamage: 1.5,
    targets: 1, hitAir: true, projectileRadius: 34,
    tags: ["squid", "control", "slow"],
    attackEffect: "fx_ink", hitEffect: "fx_hit_ink",
    slowPct: 0.3, slowSec: 1.4, inkRadius: 54,
  },
  {
    id: "urchin", name: "海胆", category: "spine", attackType: "spike",
    baseDamage: 6, interval: 0.8, range: 120, projectileSpeed: 460,
    pierce: 0, knockback: 8, critRate: 0.06, critDamage: 1.5,
    targets: 8, hitAir: true, projectileRadius: 8,
    tags: ["urchin", "omni"],
    attackEffect: "fx_spike", hitEffect: "fx_hit_spike",
  },
  {
    id: "fish", name: "海鱼", category: "fish", attackType: "blade",
    baseDamage: 16, interval: 1.15, range: 280, projectileSpeed: 740,
    pierce: 3, knockback: 10, critRate: 0.07, critDamage: 1.5,
    targets: 1, hitAir: true, projectileRadius: 14,
    tags: ["fish", "pierce"],
    attackEffect: "fx_blade", hitEffect: "fx_hit_slash",
  },
  {
    id: "octopus", name: "章鱼", category: "soft", attackType: "tentacle",
    baseDamage: 11, interval: 1.0, range: 145, projectileSpeed: 0,
    pierce: 0, knockback: 12, critRate: 0.05, critDamage: 1.5,
    targets: 2, hitAir: true, projectileRadius: 18,
    tags: ["octopus", "multi"],
    attackEffect: "fx_tentacle", hitEffect: "fx_hit_slap",
  },
];

const seafood = species.map((s) => {
  const levels = [1, 2, 3, 4, 5].map((star) => {
    const g = star - 1;
    return {
      star,
      name: starNames[s.id][g],
      damage: iround(s.baseDamage * balance.growth.starDamage ** g),
      interval: round(s.interval * balance.growth.starInterval ** g, 2),
      range: s.range + balance.growth.starRangeAdd * g,
      displayScale: round(0.82 + g * 0.12, 2),
      sprite: `seafood/${s.id}_star${star}`,
    };
  });
  return {
    id: s.id,
    name: s.name,
    rarity: "base",
    category: s.category,
    attackType: s.attackType,
    projectileSpeed: s.projectileSpeed,
    pierce: s.pierce,
    knockback: s.knockback,
    critRate: s.critRate,
    critDamage: s.critDamage,
    targets: s.targets,
    hitAir: s.hitAir,
    projectileRadius: s.projectileRadius,
    coneDeg: s.coneDeg ?? 0,
    slowPct: s.slowPct ?? 0,
    slowSec: s.slowSec ?? 0,
    inkRadius: s.inkRadius ?? 0,
    tags: s.tags,
    recipeTags: [s.category, s.id],
    attackEffect: s.attackEffect,
    hitEffect: s.hitEffect,
    levels,
  };
});

const recipes = [
  {
    id: "C001", name: "蒜蓉", keyword: ["持续伤害", "爆香", "连锁爆炸"],
    prefer: ["shell", "shrimp"],
    mods: { dotDamage: 3, dotInterval: 0.5, dotDuration: 2, explodeEveryHits: 4, explodeRadius: 48, explodeDamageMul: 0.4 },
    note: "命中挂香伤。同一目标每第 4 次命中爆香。",
  },
  {
    id: "C002", name: "麻辣", keyword: ["攻速", "连锁", "灼烧"],
    prefer: ["shrimp", "octopus"],
    mods: { intervalMul: 0.85, chainEveryAttacks: 5, chainJumps: 2, chainDamageMul: [0.7, 0.5], burnDps: 4, burnSec: 2 },
    note: "攻速提高。每 5 次攻击辣油弹跳。",
  },
  {
    id: "C003", name: "椒盐", keyword: ["暴击", "击退", "破甲"],
    prefer: ["crab", "urchin"],
    mods: { critAdd: 0.12, critDamage: 1.9, armorShred: 0.2, shredSec: 3, knockbackAdd: 18 },
    note: "暴击时破甲并追加击退。",
  },
  {
    id: "C004", name: "炭烤", keyword: ["高伤", "灼烧", "穿透"],
    prefer: ["fish"],
    mods: { damageMul: 1.22, pierceAdd: 1, trailDpsMul: 0.25, trailSec: 2, trailWidth: 28 },
    note: "伤害提高，弹道留下燃烧路径。",
  },
  {
    id: "C005", name: "清蒸", keyword: ["恢复", "攻速", "增益"],
    prefer: ["scallop"],
    mods: { selfDamageMul: 0.85, pulseSec: 4, pulseRadius: 90, allyIntervalMul: 0.85, buffSec: 3 },
    note: "自身伤害降低，周期性加快附近友军攻速。",
  },
  {
    id: "C006", name: "冰鲜", keyword: ["减速", "冻结", "控制"],
    prefer: ["squid", "shell"],
    mods: { damageMul: 0.9, slowPct: 0.35, slowSec: 1.2, freezeAtStacks: 4, freezeSec: 0.8 },
    note: "攻击减速。冰层叠到 4 层冻结。",
  },
];

const signatures = [
  { recipe: "C001", species: "oyster", skill: "蒜香爆汁", rule: "命中时爆炸半径 70，伤害为该次命中的 55%。取代普通爆香。" },
  { recipe: "C002", species: "shrimp", skill: "麻辣连弹", rule: "每 5 次攻击辣油跳 3 次，伤害系数 0.70 / 0.50 / 0.35。" },
  { recipe: "C003", species: "crab", skill: "椒盐重钳", rule: "暴击击退再乘 1.8，并硬直 0.25 秒。" },
  { recipe: "C006", species: "squid", skill: "冰墨", rule: "墨圈半径 64。敌人在墨圈内停留 0.6 秒后冻结 0.9 秒。" },
  { recipe: "C004", species: "fish", skill: "火焰水刃", rule: "水刃路径留下 4 点/秒灼烧，持续 2.5 秒，路径宽 36。" },
  { recipe: "C005", species: "scallop", skill: "鲜味蒸汽", rule: "每 5 秒给扇形内友军 +20% 伤害，持续 4 秒。" },
];

const seasonings = [
  { id: "R001", name: "蒜瓣", chain: ["蒜瓣", "蒜球", "火蒜", "爆蒜头"], stat: "garlic.dotDamage", perTier: [2, 4, 7, 0], grantAt4: "X004" },
  { id: "R002", name: "辣椒", chain: ["辣椒", "朝天椒", "魔鬼椒", "地狱辣椒"], stat: "spicy.chainDamageMul", perTier: [1.1, 1.25, 1.45, 0], grantAt4: "X001" },
  { id: "R003", name: "花椒", chain: ["花椒", "大红袍", "藤椒", "麻椒王"], stat: "pepper.critDamageAdd", perTier: [0.15, 0.3, 0.5, 0.75], grantAt4: null },
  { id: "R004", name: "柠檬", chain: ["柠檬", "青柠", "黄柠", "冻柠"], stat: "ice.slowAdd", perTier: [0.05, 0.1, 0.16, 0.24], grantAt4: null },
  { id: "R005", name: "酱油", chain: ["酱油", "生抽", "老抽", "头抽"], stat: "mark.colorDamageMul", perTier: [0.3, 0.4, 0.55, 0.75], grantAt4: null, rule: "命中叠上色。3 层时追加一次标记伤害。" },
  { id: "R006", name: "芥末", chain: ["芥末", "青芥", "辣芥", "冲鼻芥"], stat: "sneeze.radius", perTier: [70, 100, 130, 170], grantAt4: null, rule: "每 8 秒打一个喷嚏，击退半径内敌人。4 阶硬直 0.4 秒。" },
  { id: "R007", name: "胡椒", chain: ["胡椒", "白胡椒", "黑胡椒", "混合胡椒"], stat: "projectile.speedMul", perTier: [1.1, 1.18, 1.28, 1.4], grantAt4: null, rule: "同时暴击率 +0.02 / +0.04 / +0.06 / +0.1。" },
  { id: "R008", name: "葱花", chain: ["葱花", "香葱", "大葱", "葱龙"], stat: "steam.extraAllies", perTier: [1, 1, 2, 3], grantAt4: null },
  { id: "R009", name: "黄油", chain: ["黄油", "蒜油", "焦黄油", "金黄油"], stat: "butter.knockbackMul", perTier: [1.15, 1.3, 1.5, 1.8], grantAt4: null, rule: "被击中的敌人下一次受到的击退按倍率提高。" },
  { id: "R010", name: "冰块", chain: ["冰块", "碎冰", "冰砖", "冰山"], stat: "ice.freezeStacks", perTier: [4, 3, 3, 0], grantAt4: "X002", rule: "降低触发冻结所需层数。4 阶改为屏幕技能。" },
  { id: "R011", name: "木炭", chain: ["木炭", "果木炭", "备长炭", "龙炭"], stat: "char.burnSecAdd", perTier: [0.4, 0.8, 1.3, 0], grantAt4: "X003" },
  { id: "R012", name: "海盐", chain: ["海盐", "粗盐", "玫瑰盐", "晶盐"], stat: "salt.critAdd", perTier: [0.03, 0.05, 0.08, 0.12], grantAt4: null, rule: "暴击时额外无视 2 / 4 / 7 / 12 点护甲。" },
];

const screenSkills = [
  { id: "X001", name: "地狱辣油", from: "R002", cooldown: 8, rule: "一道辣油从料理区扫到入口，对路径上敌人造成 80% 攻击者伤害并灼烧 3 秒。视觉必须高于普通连锁，但留出一条可走空隙。" },
  { id: "X002", name: "冰海覆盖", from: "R010", cooldown: 16, rule: "冻结当前全部地面敌人 1.2 秒。飞行单位改为减速 70%。每局视觉只在叠满冰块后出现。" },
  { id: "X003", name: "炭火幕", from: "R011", cooldown: 10, rule: "在战场拉出 3 道横向炭火，每道 6 点/秒，持续 3 秒。不覆盖全屏。" },
  { id: "X004", name: "爆蒜雨", from: "R001", cooldown: 9, rule: "随机 6 个敌人脚下爆香，每个半径 56，伤害为蒜蓉单位平均攻击的 70%。" },
];

const upgrades = [
  ["B001", "爆蒜", "common", "蒜蓉爆香半径 ×1.35", { stat: "garlic.explodeRadiusMul", op: "mul", value: 1.35 }],
  ["B002", "海鲜快手", "common", "虾类攻击间隔 ×0.80", { stat: "species.shrimp.intervalMul", op: "mul", value: 0.8 }],
  ["B003", "厚网", "common", "捞网半径 ×1.20", { stat: "net.radiusMul", op: "mul", value: 1.2 }],
  ["B004", "多带一筐", "common", "海鲜池容量 +3", { stat: "pond.capacityAdd", op: "add", value: 3 }],
  ["B005", "捞回来", "common", "料理单位死亡时 15% 以 1 星回到海鲜池", { stat: "seafood.deathReturnChance", op: "add", value: 0.15 }],
  ["B006", "深网", "common", "海鲜池可以刷出黄金海鲜", { stat: "flag.catchGold", op: "flag", value: true }],
  ["B007", "辣油弹射", "common", "麻辣连锁次数 +1", { stat: "spicy.chainAdd", op: "add", value: 1 }],
  ["B008", "薄冰", "common", "冰鲜减速 +10 个百分点", { stat: "ice.slowAdd", op: "add", value: 0.1 }],
  ["B009", "重钳", "common", "蟹击退 +20", { stat: "species.crab.knockbackAdd", op: "add", value: 20 }],
  ["B010", "珍珠溅射", "common", "生蚝命中溅射半径 36，溅射伤害 35%", { stat: "species.oyster.splashRadius", op: "set", value: 36 }],
  ["B011", "扇贝开口", "common", "扇贝扇形角度 +30°", { stat: "species.scallop.coneAdd", op: "add", value: 30 }],
  ["B012", "多一只触手", "common", "章鱼同时攻击目标 +1", { stat: "species.octopus.targetsAdd", op: "add", value: 1 }],
  ["B013", "鱼骨利刃", "common", "海鱼穿透 +1", { stat: "species.fish.pierceAdd", op: "add", value: 1 }],
  ["B014", "胆刺加密", "common", "海胆尖刺 +2", { stat: "species.urchin.spikesAdd", op: "add", value: 2 }],
  ["B015", "快捞", "common", "捞网冷却 ×0.75", { stat: "net.cooldownMul", op: "mul", value: 0.75 }],
  ["B016", "稳手", "common", "槽位吸附半径 +16", { stat: "slot.snapRadiusAdd", op: "add", value: 16 }],
  ["B017", "旺灯", "common", "灯火上限 +4", { stat: "lantern.maxAdd", op: "add", value: 4 }],
  ["B018", "小费", "common", "金币掉落 ×1.25", { stat: "gold.mul", op: "mul", value: 1.25 }],
  ["B019", "活水", "common", "海鲜池刷新间隔 ×0.85", { stat: "pond.spawnIntervalMul", op: "mul", value: 0.85 }],
  ["B020", "蒸汽久留", "common", "清蒸增益持续时间 +1.5 秒", { stat: "steam.buffDurationAdd", op: "add", value: 1.5 }],
  ["B021", "炭火旺", "common", "炭烤灼烧每秒伤害 ×1.30", { stat: "char.burnDpsMul", op: "mul", value: 1.3 }],
  ["B022", "椒盐脆", "common", "椒盐暴击率 +0.06", { stat: "pepper.critAdd", op: "add", value: 0.06 }],
  ["B023", "蒜香残留", "common", "蒜蓉持续伤害时间 +1 秒", { stat: "garlic.dotDurationAdd", op: "add", value: 1 }],
  ["B024", "墨圈扩大", "common", "鱿鱼墨圈半径 ×1.25", { stat: "species.squid.inkRadiusMul", op: "mul", value: 1.25 }],
  ["B025", "铁盘护位", "common", "潮水推移料理位的距离 ×0.50", { stat: "slot.tideResistMul", op: "mul", value: 0.5 }],
  ["B026", "后厨长筷", "common", "后排单位射程 +24", { stat: "slot.backRangeAdd", op: "add", value: 24 }],
  ["B027", "邻里帮厨", "common", "相邻同种类攻速间隔 ×0.92", { stat: "adjacent.sameTypeIntervalMul", op: "mul", value: 0.92 }],
  ["B028", "双响", "common", "一次正好捞到 2 只相同海鲜时，合成星级再 +1", { stat: "scoop.pairStarBonus", op: "add", value: 1 }],
  ["B029", "小骨奖", "common", "普通敌人 8% 额外掉 1 鱼骨", { stat: "fishbone.smallDropChance", op: "add", value: 0.08 }],
  ["B030", "夜市加单", "common", "每击倒 20 个敌人，海鲜池下一只必为带调料海鲜", { stat: "pond.seasonedEveryKills", op: "set", value: 20 }],
  ["B031", "麻辣连锅", "rare", "麻辣连锁 +2，且可以跳到飞行单位", { stat: "spicy.chainAdd", op: "add", value: 2, flag: "spicy.chainHitsFlying" }],
  ["B032", "结冰", "rare", "冰鲜冻结时间 ×1.75", { stat: "ice.freezeDurationMul", op: "mul", value: 1.75 }],
  ["B033", "火焰水路", "rare", "炭烤燃烧路径宽度 ×1.50", { stat: "char.trailWidthMul", op: "mul", value: 1.5 }],
  ["B034", "鲜味共鸣", "rare", "清蒸脉冲同时给予 +20% 伤害", { stat: "steam.damageBuff", op: "set", value: 0.2 }],
  ["B035", "黄金眼", "rare", "黄金海鲜出现概率 +6%", { stat: "pond.goldChanceAdd", op: "add", value: 0.06 }],
  ["B036", "一网三鲜", "rare", "捞网容量 +1", { stat: "net.capacityAdd", op: "add", value: 1 }],
  ["B037", "拼盘师傅", "rare", "海鲜拼盘必定额外获得 1 个调料进度", { stat: "flag.platterGivesSeasoning", op: "flag", value: true }],
  ["B038", "破壳", "rare", "椒盐单位无视 50% 护甲", { stat: "pepper.armorIgnore", op: "set", value: 0.5 }],
  ["B039", "防空夹", "rare", "近战可以以 70% 伤害命中飞行单位", { stat: "melee.flyingHitMul", op: "set", value: 0.7 }],
  ["B040", "猫怕热", "rare", "场上有麻辣或炭烤时，偷海鲜成功率 -40%", { stat: "thief.failIfHeat", op: "set", value: 0.4 }],
  ["B041", "连珠", "rare", "虾额外发射 1 颗弹，该弹伤害 ×0.65", { stat: "species.shrimp.extraPelletMul", op: "set", value: 0.65 }],
  ["B042", "加一只盘", "rare", "料理位 +1", { stat: "slot.countAdd", op: "add", value: 1 }],
  ["B043", "回锅", "rare", "合成时保留被吃掉那只的料理，并继承其 30% 伤害加成 8 秒", { stat: "merge.keepDamageMul", op: "set", value: 0.3 }],
  ["B044", "慢火", "rare", "生蚝与海鱼间隔 ×1.15，伤害 ×1.45", { stat: "slowFire.damageMul", op: "set", value: 1.45 }],
  ["B045", "赶场", "rare", "波次时长 ×0.90，金币 ×1.20", { stat: "wave.durationMul", op: "mul", value: 0.9 }],
  ["B046", "地狱小灶", "epic", "麻辣每第 5 次攻击改为窄辣油波，宽 180，伤害 80%", { stat: "spicy.oilWaveWidth", op: "set", value: 180 }],
  ["B047", "冰海", "epic", "冻结时间 ×1.50，被冻结敌人受伤 ×1.25", { stat: "ice.frozenTakenMul", op: "set", value: 1.25 }],
  ["B048", "蟹阵", "epic", "场上至少 3 只蟹时，每次蟹攻击有 20% 概率全体螃蟹一起攻击", { stat: "crab.syncChance", op: "set", value: 0.2 }],
  ["B049", "龙鱼斩", "epic", "海鱼每 8 秒有一次攻击变为无限穿透且宽度 ×2", { stat: "fish.dragonEverySec", op: "set", value: 8 }],
  ["B050", "千手", "epic", "章鱼同时攻击目标变为 5", { stat: "species.octopus.targetsSet", op: "set", value: 5 }],
  ["B051", "爆炒", "epic", "解锁主动技能：全体攻击间隔 ×0.50，持续 5 秒，冷却 28 秒", { stat: "active.stirFry", op: "unlock", value: { duration: 5, intervalMul: 0.5, cooldown: 28 } }],
  ["B052", "深海菜单", "epic", "传说升级出现权重 +8%", { stat: "draft.legendaryWeightAdd", op: "add", value: 0.08 }],
  ["B053", "摊位扩建", "epic", "料理位 +2，海鲜池容量 +4", { stat: "slot.countAdd", op: "add", value: 2 }],
  ["B054", "一网打尽", "legendary", "解锁主动：捞起池中全部海鲜，忽略容量，冷却 45 秒。捞网容量 +1", { stat: "active.haulAll", op: "unlock", value: { cooldown: 45 } }],
  ["B055", "满汉全席", "legendary", "场上至少 4 种海鲜时，全部招牌联动以 50% 强度生效，即使料理不匹配", { stat: "signature.banquetMul", op: "set", value: 0.5 }],
  ["B056", "夜市烟火", "legendary", "每 12 秒随机一个已部署招牌技能额外触发一次", { stat: "signature.extraEverySec", op: "set", value: 12 }],
  ["B057", "围裙续灯", "legendary", "灯火归零时每局一次回到 5 点并冻结敌人 2 秒。Boss 受到伤害 +20%", { stat: "lantern.onceSave", op: "set", value: 5 }],
].map(([id, name, rarity, desc, effect]) => ({
  id, name, rarity, desc,
  effects: [{ stat: effect.stat, op: effect.op, value: effect.value }],
  flags: effect.flag ? [effect.flag] : [],
}));

function addEffect(id, effect) {
  const row = upgrades.find((u) => u.id === id);
  row.effects.push(effect);
}
addEffect("B044", { stat: "slowFire.intervalMul", op: "set", value: 1.15 });
addEffect("B045", { stat: "gold.mul", op: "mul", value: 1.2 });
addEffect("B047", { stat: "ice.freezeDurationMul", op: "mul", value: 1.5 });
addEffect("B053", { stat: "pond.capacityAdd", op: "add", value: 4 });
addEffect("B054", { stat: "net.capacityAdd", op: "add", value: 1 });

const enemies = [
  { id: "E001", name: "偷吃鼠", hp: 42, speed: 68, armor: 0, gold: 1, radius: 18, air: false, tags: ["basic"], ability: "沿直线走向灯火。无特殊能力。" },
  { id: "E002", name: "快跑鼠", hp: 24, speed: 118, armor: 0, gold: 1, radius: 16, air: false, tags: ["fast"], ability: "只靠速度。控制单位能拉开处理时间。" },
  { id: "E003", name: "铁桶鼠", hp: 86, speed: 42, armor: 4, gold: 2, radius: 22, air: false, tags: ["armored"], ability: "护甲减平坦伤害。持续伤害只吃 50% 护甲。" },
  { id: "E004", name: "醉猫", hp: 96, speed: 46, armor: 0, gold: 2, radius: 24, air: false, tags: ["dash"], ability: "每 3 秒朝灯火冲刺 0.55 秒，冲刺速度 150，期间击退抗性 50%。" },
  { id: "E005", name: "海鸥", hp: 38, speed: 84, armor: 0, gold: 2, radius: 18, air: true, tags: ["flying"], ability: "飞行。近战默认打不中。被击落前不走地面减速带。" },
  { id: "E006", name: "寄居蟹", hp: 170, speed: 30, armor: 12, gold: 3, radius: 26, air: false, tags: ["armored", "slow"], ability: "高护甲慢速。破甲和单体高伤更合适。" },
  { id: "E007", name: "偷海鲜猫", hp: 58, speed: 76, armor: 0, gold: 2, radius: 20, air: false, tags: ["thief"], ability: "碰到料理区后不扣灯火，叼走星级最低的一只海鲜并离场。场上没有海鲜时改为扣 1 点灯火。" },
  { id: "E008", name: "水母怪", hp: 52, speed: 40, armor: 0, gold: 2, radius: 20, air: false, tags: ["stun"], ability: "每 4 秒麻痹最近的料理单位 1.1 秒。自身不飞行。" },
  { id: "E009", name: "章鱼怪", hp: 120, speed: 34, armor: 2, gold: 3, radius: 26, air: false, tags: ["lock"], ability: "每 6 秒锁住一个有海鲜的料理位 3 秒，该单位不能攻击也不能被换位。" },
  { id: "E010", name: "泡沫箱怪", hp: 74, speed: 38, armor: 0, gold: 2, radius: 24, air: false, tags: ["splitter"], ability: "死亡时放出 3 只泡沫鼠（生命 16，速度 90，半径 12）。" },
  { id: "E011", name: "厨师鼠", hp: 64, speed: 44, armor: 0, gold: 2, radius: 20, air: false, tags: ["buffer"], ability: "光环半径 90：友军速度 ×1.15，并获得 10 点临时护盾。" },
  { id: "E012", name: "纸船仔", hp: 48, speed: 56, armor: 0, gold: 2, radius: 18, air: false, tags: ["stable"], ability: "免疫击退。可以正常被减速和冻结。" },
];

const elites = [
  { id: "L001", name: "铁桶头目", from: "E003", hpMul: 3.4, armor: 8, gold: 8, ability: "生命降到 50% 时召唤 2 只当前波次强度的铁桶鼠。头目自身速度 ×0.9。" },
  { id: "L002", name: "海鸥领班", from: "E005", hpMul: 3.2, armor: 0, gold: 8, air: true, ability: "每 5 秒俯冲。俯冲碰到料理区扣 2 点灯火并回到入口高度。召唤 2 只海鸥。" },
  { id: "L003", name: "抗冻水母", from: "E008", hpMul: 3.0, armor: 0, gold: 8, ability: "受到的冻结时间 ×0.25。麻痹间隔缩短到 3 秒，麻痹 1.4 秒。" },
  { id: "L004", name: "散群沙丁", from: "E012", hp: 28, count: 6, armor: 0, gold: 6, ability: "一次出场 6 只。被穿透弹命中时，若生命高于 40%，分裂成 2 只各保留 45% 生命的沙丁，原穿透在这一下停止。" },
];

const bosses = [
  {
    id: "S001", name: "垃圾桶鼠王", map: "night_stall", debutWave: 18, hp: 9200, armor: 3, speed: 36, radius: 48,
    phases: [
      { enterBelow: 1, skills: ["桶盖格挡：正面 140° 减伤 40%，持续 2.5 秒，冷却 8 秒", "每 10 秒召唤 4 只偷吃鼠"] },
      { enterBelow: 0.5, skills: ["滚桶：朝灯火冲撞 0.7 秒，速度 220，撞到料理位把该单位沿冲撞方向推 36 像素"] },
    ],
  },
  {
    id: "S002", name: "海鸥船长", map: "pier", debutWave: 18, hp: 8400, armor: 0, speed: 70, radius: 46, air: true,
    phases: [
      { enterBelow: 1, skills: ["飞行。近战默认无效", "每 7 秒俯冲，扣 2 点灯火"] },
      { enterBelow: 0.6, skills: ["俯冲改为叼走星级最低海鲜；若没有海鲜则扣 3 点灯火", "每 12 秒召唤 3 只海鸥"] },
    ],
  },
  {
    id: "S003", name: "巨型寄居蟹", map: "reef", debutWave: 18, hp: 12800, armor: 16, speed: 26, radius: 54,
    phases: [
      { enterBelow: 1, skills: ["高护甲", "每 9 秒缩壳 2 秒，期间不受伤害，也不移动"] },
      { enterBelow: 0.45, skills: ["缩壳结束时横向冲撞，把碰到的料理单位横向挪 48 像素"] },
    ],
  },
  {
    id: "S004", name: "深海章鱼", map: "deep", debutWave: 18, hp: 11000, armor: 4, speed: 32, radius: 52,
    phases: [
      { enterBelow: 1, skills: ["每 8 秒锁 1 个料理位 3.5 秒", "每 11 秒喷墨，半径 120，减速 40% 持续 3 秒"] },
      { enterBelow: 0.4, skills: ["锁料理位改为同时 2 个", "触手拍击：对最靠近的 3 个单位造成 2 秒不能攻击"] },
    ],
  },
  {
    id: "S005", name: "蟹老板", map: "finale", debutWave: 18, hp: 15600, armor: 6, speed: 30, radius: 58,
    phases: [
      { enterBelow: 1, skills: ["推进：速度 30，每 6 秒召唤 2 只醉猫"] },
      { enterBelow: 0.75, skills: ["巨钳横扫：前方 160° 扇形，把海鲜击退 40 像素并硬直 0.4 秒，冷却 7 秒"] },
      { enterBelow: 0.5, skills: ["潮水：全体料理单位沿潮水方向平移 28 像素，可能换到别的吸附槽。冷却 9 秒"] },
      { enterBelow: 0.25, skills: ["撕咬狂暴：速度 ×1.35，护甲变为 0，每 4 秒对最近料理单位造成 1 点灯火伤害"] },
    ],
  },
];

const catalog = [
  ...upgrades.map((u) => ({ id: u.id, kind: "upgrade", name: u.name, rarity: u.rarity })),
  ...enemies.map((e) => ({ id: e.id, kind: "enemy", name: e.name, rarity: "normal" })),
  ...elites.map((e) => ({ id: e.id, kind: "elite", name: e.name, rarity: "elite" })),
  ...bosses.map((b) => ({ id: b.id, kind: "boss", name: b.name, rarity: "boss" })),
  ...seasonings.map((s) => ({ id: s.id, kind: "seasoning", name: s.name, rarity: "relic" })),
  ...recipes.map((r) => ({ id: r.id, kind: "recipe", name: r.name, rarity: "style" })),
  ...screenSkills.map((s) => ({ id: s.id, kind: "screenSkill", name: s.name, rarity: "legendary" })),
];

if (catalog.length !== 100) {
  throw new Error(`catalog length ${catalog.length}, expected 100`);
}
const ids = new Set(catalog.map((c) => c.id));
if (ids.size !== 100) throw new Error("duplicate catalog id");

const rarityCount = upgrades.reduce((m, u) => {
  m[u.rarity] = (m[u.rarity] || 0) + 1;
  return m;
}, {});
const expectRarity = { common: 30, rare: 15, epic: 8, legendary: 4 };
for (const [k, v] of Object.entries(expectRarity)) {
  if (rarityCount[k] !== v) throw new Error(`rarity ${k} = ${rarityCount[k]}, expected ${v}`);
}

function wavePlan() {
  const waves = [];
  const add = (wave, duration, groups, event) => {
    waves.push({
      wave,
      duration,
      hpMult: balance.hpMult(wave),
      speedMult: balance.speedMult(wave),
      groups,
      event,
    });
  };
  add(1, 18, [{ id: "E001", count: 6 }], { type: "tutorial", step: "scoop" });
  add(2, 22, [{ id: "E001", count: 5 }, { id: "E002", count: 3 }], { type: "tutorial", step: "merge" });
  add(3, 24, [{ id: "E001", count: 6 }, { id: "E002", count: 4 }], { type: "draft", count: 3, pool: "common" });
  add(4, 28, [{ id: "E001", count: 4 }, { id: "E003", count: 2 }, { id: "E002", count: 3 }], { type: "recipeOffer", options: ["C001", "C002"] });
  add(5, 30, [{ id: "E005", count: 4 }, { id: "E001", count: 6 }], { type: "newSpecies", species: "scallop" });
  add(6, 32, [{ id: "E004", count: 2 }, { id: "E002", count: 5 }, { id: "E003", count: 2 }], { type: "draft", count: 3, pool: "commonRare" });
  add(7, 36, [{ id: "L001", count: 1 }, { id: "E001", count: 8 }], { type: "elite" });
  add(8, 34, [{ id: "E006", count: 2 }, { id: "E005", count: 4 }, { id: "E002", count: 4 }], { type: "newSpecies", species: "fish" });
  add(9, 34, [{ id: "E007", count: 2 }, { id: "E001", count: 6 }, { id: "E012", count: 3 }], { type: "draft", count: 3, pool: "rare" });
  add(10, 34, [{ id: "E008", count: 3 }, { id: "E004", count: 2 }, { id: "E002", count: 4 }], { type: "counterShift" });
  add(11, 34, [{ id: "E010", count: 2 }, { id: "E011", count: 2 }, { id: "E001", count: 6 }], { type: "seasoningOffer" });
  add(12, 34, [{ id: "E009", count: 2 }, { id: "E006", count: 2 }, { id: "E005", count: 4 }], { type: "draft", count: 3, pool: "rareEpic" });
  add(13, 38, [{ id: "L002", count: 1 }, { id: "E005", count: 6 }], { type: "elite" });
  add(14, 36, [{ id: "E007", count: 3 }, { id: "E010", count: 2 }, { id: "E003", count: 3 }], { type: "counterShift" });
  add(15, 36, [{ id: "L003", count: 1 }, { id: "E008", count: 3 }, { id: "E002", count: 6 }], { type: "draft", count: 3, pool: "epic" });
  add(16, 36, [{ id: "L004", count: 1 }, { id: "E012", count: 4 }, { id: "E006", count: 2 }], { type: "pressure" });
  add(17, 36, [{ id: "E009", count: 2 }, { id: "E011", count: 2 }, { id: "E004", count: 3 }, { id: "E007", count: 2 }], { type: "draft", count: 3, pool: "epicLegendary" });
  add(18, 70, [{ id: "S001", count: 1 }], { type: "boss" });
  return waves;
}

const counterRules = [
  { if: "meleeRatio > 0.7", then: "E005 weight +40%", cap: "单波飞行单位数量不超过该波总刷新数的 40%" },
  { if: "iceFreezeCountInLast20s > 12", then: "L003 / 抗冻权重 +30%", cap: "抗冻单位不超过 40%" },
  { if: "pierceKillsRatio > 0.55", then: "L004 权重 +30%", cap: "分裂单位不超过 40%" },
  { if: "averageStar >= 3 && slotUsed >= 5", then: "E007 权重 +25%", cap: "小偷不超过 2 只同时在场" },
];

const vendors = [
  {
    id: "vendor_lang", name: "阿浪", role: "新手",
    passive: "捞网跟随速度 +10%（followLerp ×1.10）",
    active: { name: "海浪", cooldown: 24, rule: "把地面敌人沿入口方向推回 160 像素。飞行单位只减速 40% 共 1.5 秒。" },
  },
  {
    id: "vendor_garlic", name: "蒜王", role: "蒜蓉",
    passive: "蒜蓉爆香伤害系数 +0.15",
    active: { name: "爆香一锅", cooldown: 22, rule: "所有蒜蓉单位立刻按当前攻击伤害打一次爆香。" },
  },
  {
    id: "vendor_spicy", name: "辣妹", role: "麻辣",
    passive: "麻辣单位攻击间隔再 ×0.92",
    active: { name: "爆炒", cooldown: 26, rule: "全体攻击间隔 ×0.50，持续 5 秒。" },
  },
];

const specialPond = [
  { id: "gold", name: "黄金海鲜", chance: 0.02, rule: "需要 B006 或之后的黄金眼。捞起后星级视为 2，并掉落双倍金币。" },
  { id: "mutant", name: "变异海鲜", chance: 0.015, rule: "随机一个非当前种类。合成时星级 +1 的效率额外 +1，最高仍为 5。" },
  { id: "seasoned", name: "带调料海鲜", chance: 0.04, rule: "部署时自带 1 个随机料理，不跟随当前灶火。" },
  { id: "frozen", name: "冰冻海鲜", chance: 0.02, rule: "部署后前 8 秒攻击自带冰鲜减速，即使料理不是冰鲜。" },
  { id: "chest", name: "宝箱贝", chance: 0.01, rule: "不参与战斗。放入料理位后立即裂开，给出一次三选一，并空出该位置。" },
];

const layout = {
  origin: "Cocos 左下角为原点，y 向上。敌人从高 y 走向低 y。",
  topBar: { x: 0, y: 1234, w: 750, h: 100 },
  enemyGate: { x: 0, y: 1014, w: 750, h: 220 },
  battleZone: { x: 0, y: 414, w: 750, h: 600 },
  recipeBar: { x: 0, y: 334, w: 750, h: 80 },
  pond: { x: 40, y: 75, w: 670, h: 210 },
  spawnLineY: 1014,
  leakLineY: 414,
  slots: [
    { id: "f0", row: "front", x: 270, y: 690, openAtSlotCount: 6 },
    { id: "f1", row: "front", x: 170, y: 820, openAtSlotCount: 5 },
    { id: "f2", row: "front", x: 375, y: 820, openAtSlotCount: 5 },
    { id: "f3", row: "front", x: 580, y: 820, openAtSlotCount: 5 },
    { id: "b0", row: "back", x: 480, y: 690, openAtSlotCount: 7 },
    { id: "b1", row: "back", x: 200, y: 560, openAtSlotCount: 5 },
    { id: "b2", row: "back", x: 550, y: 560, openAtSlotCount: 5 },
    { id: "b3", row: "back", x: 375, y: 490, openAtSlotCount: 8 },
  ],
};

const write = (name, obj) => {
  fs.writeFileSync(path.join(dataDir, name), JSON.stringify(obj, null, 2) + "\n", "utf8");
};

write("balance.json", {
  version: balance.version,
  design: balance.design,
  tick: balance.tick,
  lantern: balance.lantern,
  leakDistance: balance.leakDistance,
  layout,
  pond: balance.pond,
  net: balance.net,
  slots: balance.slots,
  merge: balance.merge,
  growth: balance.growth,
  combat: balance.combat,
  economy: balance.economy,
  formulas: {
    hpMult: "1 + (wave-1)*0.16 + floor((wave-1)/6)*0.22",
    speedMult: "1 + (wave-1)*0.012",
    starDamage: "round(baseDamage * 1.62^(star-1))",
    starInterval: "baseInterval * 0.94^(star-1)",
    gold: "round(baseGold * (1 + (wave-1)*0.08))",
    armorHit: "max(1, rawDamage - armor)",
    armorDot: "max(1, rawDamage - armor * 0.5)",
  },
  counterRules,
  specialPond,
  signatures,
});
write("seafood.json", seafood);
write("recipes.json", recipes);
write("seasonings.json", seasonings);
write("screen-skills.json", screenSkills);
write("upgrades.json", upgrades);
write("enemies.json", enemies);
write("elites.json", elites);
write("bosses.json", bosses);
const plannedWaves = wavePlan();
const combatSec = plannedWaves.reduce((sum, w) => sum + w.duration, 0);
write("waves.json", { map: "night_stall", boss: "S001", targetCombatSec: combatSec, waves: plannedWaves });
write("vendors.json", vendors);
write("catalog.json", catalog);

const ttk = [];
for (const s of seafood) {
  const lv = s.levels[0];
  ttk.push({
    id: s.id,
    dps: round(lv.damage / lv.interval, 2),
    ratSeconds: round(42 / (lv.damage / lv.interval), 2),
  });
}
write("ttk-notes.json", {
  leakTravelSecAtSpeed68: round(600 / 68, 2),
  star1: ttk,
  note: "偷吃鼠 42 血、速度 68，从入场线走到灯火线 600 像素约 8.8 秒。小虾单目标约 4.2 秒击杀，教程期一只虾打得过一只鼠，两只重叠就会漏。",
});

console.log(`catalog ${catalog.length}`);
console.log("rarity", rarityCount);
console.log("wrote", dataDir);
