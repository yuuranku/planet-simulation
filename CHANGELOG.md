# 更新日志

本仓库变更记录。版本号的单一来源为 `version.json`，由 `npm run sync-version` 同步到 `build.gradle` / `README.md` / `index.html`。

## 1.4.6.0 (versionCode 25, build 20261118a)

发布工程与无缝地图的完整性加固（对应问题清单 A–E 全项修复）。

### 新增
- **MIT LICENSE** 与 README 来源/授权/上游同步说明（A1、D2）。
- **最小 CI**（`.github/workflows/ci.yml`）：push/PR 自动跑 `sync-version → build → verify → smoke`（C6）。
- **统一测试入口** `npm test`，`verify` 现在强制运行全部测试，红灯即阻断发布（A3、C2、C6）。
- **CHANGELOG.md** 与架构决策说明（本文件、`docs/ARCHITECTURE.md`）（D3）。

### 修复
- **Android 构建链**：`build.gradle` 改为从 `dist/android/site` 打包（此前读源码 `site/`，导致缓存串不统一、`dist/android` 白产出）（A2）。
- **源码缓存串统一**为单一占位值，构建产物按 `version.build` 全量替换（C1）。
- **server.py 跨平台**：改用 `webbrowser.open` + `except Exception`，`allow_reuse_address=True`，新增 `--port`；Linux 上不再启动即崩溃（A4、E）。
- **smoke 测试**：支持 `--port`，结束时优雅等待服务进程退出，连续运行不再撞端口（C3）。
- **版本号 bump** 到 1.4.6.0 / 25（C4）。
- **check:city** 改为扫描目录取交集，新文件默认报"未登记"强制确认，不再硬编码名单漏检（C5）。

### 无缝地图（city-layer）真缺陷修复
- **B1** 建筑层冻结：建筑路径从惰性静态路径中分离，放大到建筑级时按需构建，不再被首次低 LOD 固化为 null。
- **B2** 换世界错配：请求携带世界代际 `gen`，`detach` 后旧响应按代际丢弃，不再按 idx 错配进新世界。
- **B3** FIFO 冒充 LRU：命中即刷新 Map 顺序，淘汰真正最久未用的城市。
- **B4** Worker 被打满：请求队列 + 并发上限（桌面 2）+ 按重要性/距离优先级，交互请求不再被挤堵。
- **B5** 淡入重绘：多城共享单一 rAF ticker，淡入时长 260ms→160ms，避免每城各起循环全量重绘。
- **B6** 内存：缓存 12→8、位图像素按视口推导、轻量建成区加 TTL 淘汰。
- **B7** 静默异常：关键 catch 补 `console.warn`，暴露 `stats`（请求/命中/失败/丢弃/耗时）。
- **B8** 全局单例：MapView 持有自身 cityLayer 实例引用，保留全局兼容。

### 测试
- 4 个历史红灯测试根因排查完成：均为上游测试夹具随生成逻辑演进而过期（字段缺失、accession 类型重命名、收束期设计变更、动员率参数变化），逐一更新为匹配当前正确行为；**全量 65 项测试全绿，未改动核心生成算法**。
- 新增 B2（代际丢弃）、B4（并发上限）针对性测试。

## 1.4.5.3 (versionCode 24)

- 发布工程（build/verify/smoke/package 工具链、version.json 单一版本源）。
- 无缝地图 P0（WGS 统一坐标层）+ P1–P4（城市细节绘制进主画布、LOD/缓存/预取/淡入/分端配置）。
- 从 `yuuranku/planet-simulation` 基线 `8257686` 导入。
