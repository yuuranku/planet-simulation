/* 跨平台测试入口：显式枚举 tests/ 下的 .cjs 文件再交给 node --test。
 *
 * 为什么不用 `node --test tests/*.cjs`：那个写法依赖 shell 展开 glob，
 * 在 Windows 的 cmd.exe / PowerShell 下不会展开，`node --test` 会把字面量
 * `tests/*.cjs` 当作路径而报错。本脚本用 Node 的 fs 枚举目录，跨平台一致，
 * 且与 tools/verify.mjs 的测试发现逻辑保持同一套规则（所有 .cjs 文件）。
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const testDir = join(ROOT, 'tests');
const files = readdirSync(testDir)
  .filter(f => f.endsWith('.cjs'))
  .sort()
  .map(f => join(testDir, f));

if (!files.length) {
  console.error('[run-tests] 未在 tests/ 下找到任何 .cjs 测试文件');
  process.exit(1);
}

console.log(`[run-tests] 运行 ${files.length} 个测试文件（跨平台入口）`);
const r = spawnSync(process.execPath, ['--test', ...files], {
  cwd: ROOT,
  stdio: 'inherit'
});
process.exit(r.status === null ? 1 : r.status);
