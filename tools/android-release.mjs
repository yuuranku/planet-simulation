#!/usr/bin/env node
/**
 * Android 发布辅助（不接触签名密钥）
 * ------------------------------------------------------------------
 * 签名密钥与密码必须保存在仓库外，本脚本不会、也不应生成签名配置。
 * 它只做三件事：
 *   1. 提示将 dist/android/site 同步给 Gradle 构建（Gradle 默认直接读仓库 site/，二者内容一致）
 *   2. 定位 assembleRelease 产出的 APK 并校验存在
 *   3. 打印发布前必须完成的外部步骤清单（签名 / zipalign / versionCode）
 *
 * 用法： node tools/android-release.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const v = JSON.parse(readFileSync(join(ROOT, 'version.json'), 'utf8'));
const gradle = readFileSync(join(ROOT, 'android/build.gradle'), 'utf8');

console.log('\x1b[1mAndroid 发布辅助\x1b[0m');
console.log(`  版本 ${v.version} · versionCode ${v.versionCode}\n`);

console.log('\x1b[36m▸ 版本一致性\x1b[0m');
if (gradle.includes(`versionCode ${v.versionCode}`) && gradle.includes(`versionName '${v.version}'`)) {
  console.log('  \x1b[32m✓\x1b[0m build.gradle 与 version.json 一致');
} else {
  console.log('  \x1b[31m✗\x1b[0m 版本不一致，请先运行 npm run sync-version');
}
console.log(`  \x1b[33m!\x1b[0m 更新已安装用户时，versionCode 必须高于上一版（当前 ${v.versionCode}）`);

console.log('\x1b[36m▸ 网页资源\x1b[0m');
console.log('  Gradle 的 copySite 任务会从仓库 site/ 复制到 APK 的 assets/site/。');
console.log('  dist/android/site/ 是同一份内容的构建校验副本，二者应保持一致。');

console.log('\x1b[36m▸ release APK 定位\x1b[0m');
const apkDir = join(ROOT, 'android/build/outputs/apk/release');
if (existsSync(apkDir)) {
  const apks = readdirSync(apkDir).filter(f => f.endsWith('.apk'));
  if (apks.length) {
    for (const a of apks) {
      const s = (statSync(join(apkDir, a)).size / 1024 / 1024).toFixed(1);
      console.log(`  \x1b[32m✓\x1b[0m ${a}  (${s} MB)`);
    }
  } else console.log('  \x1b[90m—\x1b[0m 尚无 APK，运行 gradle assembleRelease');
} else {
  console.log('  \x1b[90m—\x1b[0m 尚无构建产物，运行 gradle assembleRelease');
}

console.log('\x1b[36m▸ 发布前必做（密钥在仓库外，需人工完成）\x1b[0m');
console.log('  1. 用原发布密钥对 unsigned release APK 签名（keytool/apksigner）');
console.log('  2. zipalign 对齐后 apksigner verify 校验');
console.log('  3. 确认 versionCode 递增，避免无法覆盖安装');
console.log('  4. 真机冒烟：启动 → 生成世界 → 打开城市 → 导出/导入存档\n');
