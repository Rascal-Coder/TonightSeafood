---
name: cocos-creator
description: >-
  Implement TonightSeafood in Cocos Creator 3.8: scenes, nodes, components,
  prefabs, and TypeScript via the cocos-creator MCP, with gameplay rules kept
  in assets/scripts/core. Use when the task touches cc APIs, the NightStall
  scene, prefabs, editor preview, or build. Discipline skills that name
  Godot or Unity APIs bind here instead.
---

# Cocos Creator

本仓库的引擎技能。场景和预制体走 MCP。玩法脚本和数值 JSON 直接改文件。项目硬规则在 `tonight-seafood-cocos`。

通用技能里的 `godot-*` / `unity-*` 绑定到这里：2D 节点、UI Widget、动画和音频都用 Cocos 3.8 的组件，不引入别的引擎。

## 编辑器还是文件

MCP 服务名是 `cocos-creator`，地址 `http://127.0.0.1:3000/mcp`，扩展在 `extensions/cocos-mcp-server`。

先确认这个 MCP 已连接，并读当前工具的 schema，再调用。工具名以已连接服务器为准。

| 要改的东西 | 做法 |
|------------|------|
| 场景、节点、组件、预制体、资源引用、控制台、预览、构建 | MCP |
| `assets/scripts/**`、`assets/data/**`、`assets/resources/config/**` | 直接改文件 |
| `.scene` / `.prefab` 里的 `__id__` | 不要手改 |

MCP 没连上时说明服务器未启动，再退回改文件。

## 调用顺序

1. `scene_management` 确认当前场景。战斗场景是 `assets/scenes/NightStall.scene`。
2. `node_query` 拿到父节点 UUID。
3. `node_lifecycle` 的 `action: "create"` 建节点。2D 用 `nodeType: "2DNode"`。要挂引擎组件就传 `components`，例如 `["cc.Sprite"]`。要放预制体就传 `assetPath`（`db://assets/...`）。
4. `node_transform` 改位置、缩放、显隐。坐标原点在左下，y 向上。
5. `component_manage` 补组件，`set_component_property` 写属性。自定义脚本用节点上的脚本管理工具挂上，类名和文件里的 `@ccclass` 一致。
6. `scene_management` 保存场景。

删节点用 `node_lifecycle` 的 `action: "delete"`，UUID 来自上一步查询。

## 工具名

场景：`scene_management`、`scene_hierarchy`、`scene_execution_control`

节点：`node_query`、`node_lifecycle`、`node_transform`、`node_hierarchy`

组件：`component_manage`、`component_query`、`set_component_property`、`configure_click_event`

预制体：`prefab_browse`、`prefab_lifecycle`、`prefab_instance`、`prefab_edit`

资源：`asset_query`、`asset_manage`、`asset_operations`、`asset_system`

运行与日志：`project_manage`、`project_build_system`、`debug_console`、`debug_logs`

完整参数在扩展源码 `extensions/cocos-mcp-server/source/tools/`。调用前以实时 schema 为准。

## 脚本怎么分

`assets/scripts/core/` 是数据和战斗规则，禁止 `import` `cc`。`BattleWorld.step` 在这里。

`assets/scripts/battle/` 才是 Cocos 组件。`BattleDirector` 是场景里唯一推进逻辑的组件：`update` 里累积时间，每 0.05 秒调用一次 `world.step(0.05)`。表现放在 `BattleView` 和 `BattlePainter`，跟逻辑 id 同步位置和动画。

新 seafood 差异写进数据的 `attackType`，不要每种海鲜一个巨型组件。

组件骨架：

```ts
import { _decorator, Component } from "cc";
const { ccclass } = _decorator;

@ccclass("ExampleView")
export class ExampleView extends Component {
  // 只做生成、绑定、表现
}
```

## UI 和画面

设计分辨率 750×1334，`FIXED_WIDTH`。HUD 用 Widget 锚到边或角，战斗区随更高的屏幕上下拉开。顶栏贴顶，海鲜池贴底。

图片用 `cc.Sprite` 加透明 PNG。角色、敌人和道具不用 `Graphics` 矩形当最终画面。
