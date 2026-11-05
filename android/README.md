# 安卓构建

安卓应用使用仓库根目录的 `site/` 作为共享网页源码。构建时 Gradle 将其复制到 APK 的 `assets/site/`，无需手动复制。

首次竖屏启动会显示可关闭的“建议横屏使用”提示；不会锁定方向，横屏启动不会显示提示。旋转时保留当前 WebView 页面，系统返回键先关闭网页内的面板。Android 15 的系统栏、刘海与输入法安全区由外层原生容器处理，导入与导出沿用系统文件选择器。

需要 JDK 17、Android SDK Platform 35、Android SDK Build Tools，以及 Gradle 8.9。Windows 下请将项目和 Android SDK 放在不含中文等非 ASCII 字符的路径中。首次构建需要联网下载 Android Gradle Plugin 8.7.3 和 AndroidX 依赖。可在 Android Studio 中打开本目录，安装提示的 SDK 组件并同步项目；也可以使用已安装的 Gradle，在本目录运行：

```powershell
gradle assembleDebug
```

调试 APK 位于 `build/outputs/apk/debug/`。项目的包名为 `cn.planet.world`，最低支持 Android 8.0（API 26）。调试构建使用本机调试密钥签名，不能覆盖以其他密钥签名的旧应用。

正式发布需要使用原发布密钥签名。密钥和密码必须保存在仓库外，切勿提交；必须先妥善备份原密钥，否则新的 APK 无法覆盖此前发布的版本。此项目没有内置发布签名配置；未签名的 release APK 可通过 `gradle assembleRelease` 构建，再使用 Android SDK 的 `zipalign` 和 `apksigner` 签名及验证。更新已有安装时还需提高 `versionCode`。
