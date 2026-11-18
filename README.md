# 星球推演 · 世界生成器

> **来源与授权**：本项目是从 [yuuranku/planet-simulation](https://github.com/yuuranku/planet-simulation)（基线提交 `8257686`）导入的 fork，由 `sitong-zhang` 维护。本 fork 新增/改动的原创代码以 [MIT License](LICENSE) 授权；仓库内的第三方素材与预构建组件（城市模块、天体贴图、three.js、fast-png、fflate 等）按各自许可使用，不在 MIT 范围内，详见 [LICENSE](LICENSE) 与 `site/licenses/`。
>
> **上游同步**：本地已配置 `upstream` remote，可用 `git fetch upstream` 追踪上游更新；本 fork 的创新工作（发布工程、无缝地图）独立维护，合并上游改动前请先跑完整 `npm run verify`。

当前版本：**1.4.6.0**。在本机生成世界、探索地图并推演文明历史，Windows 和安卓共用 `site/` 的代码。

- 调整安卓安全区及手机布局：城市地图保留世界地图视野，历史地图的播放倍速可见。
- 优化历史军报传递，降低打开历史地图时的数据复制压力。
- 修复自定义文化库因国家后缀校验失败而无法保存的问题。
- 历史地图新增综合国力排行，可按经济、人口、军力、疆域和文治查看各国排名，并随时间观察变化。
- 调整国家规模分布、地域政权传承、王朝周期和飞地处理，并加入君主上位方式与编年记录。
- 战役要求双方各至少动员 1,000 人；调整义军与未设省地区的历史表现。
- 优化人口图、边界、地图交互，以及 720p 和 1080p 界面布局。
- 国家数量仍会随历史变化。
- 修复人物经历错误记录附庸事件的问题。
- 自定义上传高度图或海陆配色图，生成自己的世界，并调整生成设置。
- 军事系统推演军制、战争和攻守城，可查看战棋与战报。
- 在历史城市或省份创建人物，让人生经历随世界历史发展。
- 优化界面和安卓地图绘制；无文明的地区以部族状态存在，文明国家可扩张并逐渐同化当地居民。

## 下载安装

在项目的 Releases 页面下载 Windows 便携版 ZIP 或 Android APK。Windows 完整解压后双击“启动世界生成器.cmd”，使用时保持窗口开启；Android 支持 8.0 及以上，竖屏启动时会提示建议横屏使用；更新已安装的应用需要相同的签名。安卓真机运行和性能尚未完成验证。

世界保存在当前设备的浏览器或应用中，安装包不包含用户存档。更换设备前请导出世界文件及需要保留的城市存档、种族、文化和宗教库。建议更新前导出备份；重新打开世界时会按保存的种子和设置重新推演，政治历史可能变化，已保存的人物经历不会自动重算。

## 从源码运行

需要 Python 3，在项目根目录执行 `python windows/server.py`，访问 `http://127.0.0.1:18768/`。服务仅在本机监听。

安卓构建依赖和签名说明见 [安卓构建说明](android/README.md)。

网页所需脚本已随仓库提供。修改球体、世界文件或 PNG 解码入口后，可安装 Node.js 和 npm，运行 `npm ci`，然后按需运行 `npm run build:globe`、`npm run build:world-package` 或 `npm run build:png-decoder`。

### 无缝缩放地图

主地图支持从星球一路滚轮放大到城市街道、建筑，**中途无需点击切换**。跨越缩放阈值时城市细节按层级渐入：

- 全局/区域/地方级：地形、河流、边界、道路（沿用世界矢量地图）。
- 城市群级起：城市建成区轮廓淡入。
- 城区/街道/建筑级：程序化生成城市的地形底图、城区格网、街巷、建筑、城墙、道路逐级显现。

实现上把城市配方直接绘入主画布，与地形共用同一个相机和坐标系（`site/core/wgs.js` 统一坐标层）。城市数据按需从推演 Worker 获取、LRU 缓存、接近阈值时预取，底图边缘做羽化处理以融入地形。分端策略：Windows 显示到建筑细节，Android（触摸/窄屏）封顶在街道级并降低细节与缓存，兼顾性能。原「点击城市打开独立大图」功能保留不变。

相关自测：`npm run test:wgs`、`npm run test:city-layer`（渲染效果以真机/浏览器缩放体验为准）。

`tests/` 中部分历史规则回归使用旧版测试夹具，尚未适配当前生成数据结构；相关夹具和断言有待更新。

## 构建与发布

项目只发布 **Windows 便携版** 和 **Android APK** 两端，二者共用 `site/`。版本号集中定义在根目录 `version.json`，由脚本同步到各端，避免散落不一致。

依赖 Node.js 18+（脚本只用内置模块，无需 `npm install` 即可构建/校验；只有重新生成球体等产物时才需要 `npm ci` 安装 esbuild）。

```bash
npm run sync-version     # 把 version.json 的版本同步到 build.gradle / README / index.html
npm run build            # 校验引用与离线可用性，统一缓存串，生成 dist/windows 与 dist/android
npm run verify           # 发布前校验：版本一致性、关键文件、产物齐全
npm run smoke            # 本地冒烟：启动服务，请求首页/脚本/Worker 验证可访问
npm run check:city       # 检查 city/ 与 citygen/assets/ 的同源分叉状态
npm run test:wgs         # 统一坐标层等价性测试（与旧公式逐点一致）
npm run test:city-layer  # 无缝城市层模块契约测试
npm run package:windows  # 打包 dist/windows 为 release/*.zip（需系统 zip 命令）
npm run release:android  # 定位 release APK，打印签名/校验/冒烟清单（不碰密钥）
```

标准发布流程：

1. 更新 `version.json`（版本号、`versionCode` 递增、`build` 缓存串），运行 `npm run sync-version`。
2. `npm run build` → `npm run verify` → `npm run smoke`。
3. Windows：`npm run package:windows`，把 `release/` 下的 ZIP 上传到 Releases。
4. Android：在 `android/` 运行 `gradle assembleRelease`，用**仓库外的原发布密钥**签名并 `zipalign`/`apksigner verify`，确认 `versionCode` 递增后上传；签名密钥与密码绝不提交到仓库。

关于缓存串：前端是「全局脚本 + Worker `importScripts`」双上下文架构，不能简单合并为单个 bundle。`index.html`、`worker.js` 等处的 `?build=` 缓存串过去手工维护、取值不一；`npm run build` 会在产物中把它们统一为 `version.json` 的 `build` 值，一处定义、全局一致。源码本身的取值差异属正常，校验脚本会提示但不会报错。

关于城市模块：`site/city/`（主应用城市面板）与 `site/citygen/assets/`（独立生成器）同源但服务于不同功能，且 citygen 含专属改良，属**刻意分叉**，不可简单互相覆盖。`npm run check:city` 用于让分叉状态透明，防止误改。

## 项目结构与授权

- `site/`：共享网页、世界生成代码与资源。
- `windows/`：本机服务入口。
- `android/`：安卓 WebView 容器和构建配置。
- `tests/`：建国及历史规则回归。
- `tools/`：构建、校验、打包与发布辅助脚本（Node.js）。
- `version.json`：版本号与缓存串的单一来源。
- `dist/`、`release/`：构建产物与发布包（生成物，不入版本库）。

第三方素材和组件按各自附带的许可或声明使用，见 `site/licenses/`、`site/globe/` 和 `android/assets/licenses/`。项目其余源码的授权条款尚未指定。
