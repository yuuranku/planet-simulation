# 架构说明

本文说明项目当前（v1.4.6.0）的整体架构与关键设计决策，面向维护者与二次开发者。开发过程与方案推演记录不在仓库内。

## 1. 总体结构

项目是「一套共享网页代码 + 两个运行容器」：

- `site/`：世界生成引擎与网页 UI，Windows 与 Android 共用。
- `windows/server.py`：本机静态服务（默认端口 18768，可用 `--port` 改）。
- `android/`：WebView 容器 + Gradle 构建；**从 `dist/android/site` 打包**。
- `tools/`：构建、校验、冒烟、打包、版本同步脚本（见 `README.md` 的构建与发布一节）。
- `tests/`：规则回归与坐标/城市层测试，统一入口 `npm test`。

## 2. 世界生成引擎（site/core）

程序化生成星球地理、气候、水系、文明历史。`render.js` 暴露 `R.render(req)`——一个"按世界坐标窗口 `(x0,y0,s,w,h)` 渲染任意区域"的通用渲染器，是世界地图与城市细节共用的底层。`worker.js` 在 Web Worker 中跑推演，主线程通过 `app.call(type, payload)` 异步取结果（如 `cityMap`、`urban`）。生成算法与存档格式在本 fork 中**从未改动**。

## 3. 无缝地图（关键决策）

目标：像主流地图那样，从星球一路滚轮缩放到城市街道/建筑，中途不点击切换。

### 3.1 为什么能做到

调研发现两套地图的**地形底图本就共用 `R.render`**；分裂只在上层矢量要素与坐标单位。因此没有重写引擎，而是在统一渲染器之上重建一层调度层。

### 3.2 三个核心模块

| 模块 | 职责 |
|---|---|
| `site/core/wgs.js` | WGS（World Grid Space）统一坐标层。纯函数，精确复现 `urban.js`（局部线性投影，cos 下限 0.15）与 `citysite.js`（球面投影，cos 下限 1e-12）两套换算法则，`tests/wgs.test.cjs` 逐点验证等价 → 接入后视觉零变化。 |
| `site/app/city-layer.js` | 城市细节层。用主地图同一相机把城市配方（世界网格坐标）直接画进主画布；LOD 分级（建成区→城区→街巷→建筑）、LRU 缓存、请求队列（有界并发 + 优先级）、预取、淡入、底图羽化、分端配置。 |
| `site/app/map.js` | 主地图。`MapView` 持有 cityLayer 实例，render() 在矢量层之后调用城市层；`maxScale` 提升到 `fitScale × cityMaxRel`（关闭城市层时回退原版 ×48）。 |

### 3.3 LOD 与缩放

- 主地图阈值（`map.js` 的 `levelOf`）：`<2.5 / <7 / <18 / ≥18` → world/region/local/detail。
- 城市层阈值（`city-layer.js`）：`URBAN=16, CITY=26, STREETS=46, BUILDINGS=90, TEXTURE=240`，上限 `maxRel=900`（Android=520）。
- 从 L0 到 L6 是**同一相机、同一画布**；城市细节达阈值时原地渐入，不再弹独立面板。旧的"点城市打开独立大图"入口保留兼容。

### 3.4 稳定性设计（v1.4.6.0 加固）

- **代际校验**：换世界递增 `gen`，丢弃在飞旧请求，防止跨世界按 idx 错配。
- **有界队列**：单线程 Worker 同时最多 2 个 `cityMap`，交互请求（probe/route）不再被挤堵。
- **真 LRU**：命中即刷新顺序，淘汰最久未用；缓存容量桌面 8 / 移动 5，位图像素按视口推导。
- **统一淡入**：多城共享单条 rAF，160ms，避免每帧全量重绘。
- **可观测性**：`G.CityLayer._i.stats` 暴露请求/命中/失败/丢弃/耗时；关键异常有 `console.warn`。

## 4. 构建与发布

`version.json` 是版本、versionCode、缓存串的单一来源。`npm run build` 校验引用完整性、检查离线可用、把源码缓存串统一为 `version.build`，生成 `dist/windows/` 与 `dist/android/`。`npm run verify` 校验版本/授权/Android 打包源/缓存串并跑全部测试；`npm run smoke` 起真实服务探测关键资源。CI 在 push/PR 时自动串起以上流程。

## 5. 不变的红线

- 不改世界生成/历史推演核心算法（避免结果漂移）。
- 不改存档格式（保持老存档兼容）。
- 签名密钥留在仓库外（Android 仅在 CI/本地产出未签名资源）。
