---
name: tonight-seafood-cocos
description: >-
  Routes TonightSeafood (今晚吃海鲜) Cocos Creator work to the smallest skill set:
  cocos-creator, level-design, camera-systems, generate2dsprite, generate2dmap,
  video2dsprite, game-feel, input-systems, physics-tuning, audio-design,
  game-ui-ux, tower-defense, and performance-optimization. Use at the start of
  any task in this repo that changes gameplay, scenes, cameras, art, feel,
  input, physics, audio, UI, waves, or performance.
---

# Tonight Seafood Cocos

本仓库的入口路由。先读本技能，再只打开这次任务用到的技能。不要把整张表读进上下文。

## 加载顺序

1. 本技能。
2. 碰到 Cocos API、场景、节点、组件或预制体时，读 `cocos-creator`。
3. 按下面的表，只读命中的分层技能。
4. 任务在改波次、走线、索敌、搭位或局内经济时，再加 `tower-defense`。
5. 出图时只读三条素材技能里的一条。
6. 任务转到另一层时，改读新技能。

项目硬规则压过通用技能。引擎写法以 `cocos-creator` 为准；概念以分层技能为准；波次和搭位结构以 `tower-defense` 为准；和本仓库冲突时以本技能为准。

技能正文放在 `.agents/skills/<name>/SKILL.md`。那里没有时，再用本机已安装的同名技能。

## 路由表

| 分层 | 技能 | 在这些请求里读 |
|------|------|----------------|
| Cocos 实现 | `cocos-creator` | 场景、节点、组件、预制体、`cc` API、预览、构建 |
| 空间 / 场景 | `level-design` | 摊位分区、敌人走线、波次节奏、料理位布局、白盒 |
| 空间 / 场景 | `camera-systems` | 竖屏取景、镜头边界、跟随、震动 |
| 素材 | `generate2dsprite` | 海鲜、敌人、道具、攻击、投射物、命中、单帧或动画表 |
| 素材 | `generate2dmap` | 摊位地图、分层场景、碰撞区、prop pack |
| 素材 | `video2dsprite` | 用生成视频抽帧，或要更密的原地动作 |
| 手感 | `game-feel` | 打击停顿、挤压拉伸、击退、果汁感 |
| 手感 | `input-systems` | 捞网拖动、松手判定、输入缓冲 |
| 手感 | `physics-tuning` | 固定时间步、碰撞稳定性、穿透 |
| 手感 | `audio-design` | BGM、音效、混音压低 |
| UI | `game-ui-ux` | HUD、三选一、结算、安全区、焦点 |
| 玩法 | `tower-defense` | 波次、走线、索敌、自动攻击、局内经济 |
| 性能 | `performance-optimization` | 掉帧、Draw Call、GC、对象池、profiler |

改精灵、碰撞、镜头、手感或关卡数据时，同时读 `.agents/skills/2d-games/SKILL.md`。`.agents/rules/` 里的规则始终有效。

## 项目硬规则

和通用技能冲突时，按下面做。产品设定在 `docs/execution/04-commercial-night.md`，数值在 `docs/execution/03-balance-100-prompt.md`。没有单独的 Demo 局。

- 引擎是 Cocos Creator 3.8.x，TypeScript，2D。微信小游戏是目标平台，浏览器预览也要能玩。
- 场景、节点、组件、预制体、资源引用、控制台、预览、构建：先用 MCP 服务 `cocos-creator`（`http://127.0.0.1:3000/mcp`，扩展在 `extensions/cocos-mcp-server`）。玩法脚本和数值 JSON 直接改文件。MCP 没连上时说明服务器未启动，再改文件。不要手改 `.scene` 或 `.prefab` 里的 `__id__`。
- 图片按 `.agents/rules/png-assets.mdc`：原图用 `image_gen` 画在纯色 `#FF00FF` 上，透明 PNG 由 `generate2dsprite` 的脚本抠出。
- 设计分辨率 750×1334，适配 `FIXED_WIDTH`。更高的屏幕只把战斗区上下拉开。镜头是固定摊位画面；震动短、逐渐减弱。
- 逻辑 20Hz（`logicDt = 0.05`），表现 60fps，用插值。
- 数值只来自 `assets/data/*.json`。改数字就改 `tools/generate-balance.mjs`，再运行它。
- 失败条件是锅火。主操作是捞网，以及把海鲜拖到要守的那一路。料理位是自由槽位加半吸附，槽位落在左中右三路里。
- 普通弹用距离、AABB 或空间网格。Boss 碰撞用圆与扇形。
- 战斗中的单位和飘字走对象池，不在战斗里 `instantiate` / `destroy`。

## 技能文件不在时

点名缺失的技能，然后用本技能、`.agents/rules/`、`docs/execution/04-commercial-night.md` 和已经能读到的技能继续。不要编造缺失技能的步骤，也不要在同一次任务里把缺失技能写出来。

## 例子

| 请求 | 读取顺序 |
|------|----------|
| 给虾做一套攻击动画 | 本技能 → `generate2dsprite` |
| 敌人从摊位顶走到锅的路线不对 | 本技能 → `cocos-creator` → `level-design` → `tower-defense` |
| 捞网松手太肉 | 本技能 → `input-systems` → `game-feel` |
| 命中时镜头抖一下 | 本技能 → `camera-systems` → `game-feel` |
| 给下锅加音效 | 本技能 → `audio-design` |
| 三选一卡面挤在一起 | 本技能 → `game-ui-ux` |
| 战斗掉到 30 帧 | 本技能 → `performance-optimization` → `cocos-creator` |
