/* 世界输入包：保存全部原始资源与人物，不冒充自然网格快照。 */
import { zip, unzip, strToU8, strFromU8 } from 'fflate';

const LIMIT = 160 * 1024 * 1024;
const schema = 'planet-forge-world';
const format = 5;
const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/bmp': 'bmp' };
function imageResources(state) {
  const input = state.terrainInput, byHash = new Map();
  if (!input) return byHash;
  for (const meta of [input.asset, ...(input.source ? [input.source.asset] : [])]) {
    if (!meta || !/^[a-f0-9]{64}$/.test(meta.hash) || !Object.hasOwn(extensions, meta.mime) || !Number.isInteger(meta.byteLength) || meta.byteLength < 1 || meta.byteLength > 128 * 1024 * 1024) throw new Error('图纸资源清单无效');
    const previous = byHash.get(meta.hash);
    if (previous && (previous.mime !== meta.mime || previous.byteLength !== meta.byteLength)) throw new Error('同一图纸资源的引用不一致');
    if (!previous) byHash.set(meta.hash, { ...meta, path: `assets/${meta.hash}.${extensions[meta.mime]}` });
  }
  return byHash;
}
const pack = files => new Promise((resolve, reject) => zip(files, { level: 1 }, (error, bytes) => error ? reject(error) : resolve(bytes)));
const unpack = bytes => new Promise((resolve, reject) => {
  let total = 0, rejected = false;
  const seen = new Set();
  unzip(bytes, { filter: entry => {
    total += entry.originalSize;
    if (entry.originalSize > LIMIT || total > LIMIT || seen.has(entry.name) || !/^(world\.json|assets\/[a-f0-9]{64}\.(png|jpg|webp|bmp))$/.test(entry.name)) rejected = true;
    seen.add(entry.name);
    return !rejected;
  } }, (error, files) => error ? reject(error) : rejected ? reject(new Error('世界文件大小或资源路径无效')) : resolve(files));
});

export async function encode(record, assets) {
  const manifest = { ...record, schema, format, markers:record.markers || [], names:record.names || {}, resources: [] }, entries = {};
  let resourceBytes = 0;
  for (const meta of imageResources(record.state).values()) {
    const blob = await assets.get(meta.hash);
    if (blob.size !== meta.byteLength || blob.type !== meta.mime) throw new Error('图纸资源大小或格式与设置不一致');
    if (await assets.digest(blob) !== meta.hash) throw new Error('图纸资源校验失败');
    entries[meta.path] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
    resourceBytes += blob.size;
    manifest.resources.push(meta);
  }
  entries['world.json'] = strToU8(JSON.stringify(manifest));
  if (entries['world.json'].byteLength + resourceBytes > LIMIT - 4096) throw new Error('世界输入包超过 160 MB，请减少保存的人物或图纸大小');
  const bytes=await pack(entries);
  if (bytes.byteLength > LIMIT) throw new Error('世界输入包超过 160 MB');
  return new Blob([bytes], { type: 'application/zip' });
}

export async function decode(file, { engineVersion, rulesVersion, validateState, validatePeople, assets }) {
  if (!file.size || file.size > LIMIT) throw new Error('世界文件过大或为空');
  const files = await unpack(new Uint8Array(await file.arrayBuffer()));
  if (!files['world.json']) throw new Error('缺少世界清单，请使用本版导出的 .planet.zip 文件');
  const world = JSON.parse(strFromU8(files['world.json']));
  if (world.schema !== schema || world.format !== format || world.engineVersion !== engineVersion || world.rulesVersion !== rulesVersion) throw new Error('此文件使用其他规则版本，请用对应版本打开');
  validateState(world.state);
  if (!Array.isArray(world.people) || !Array.isArray(world.resources)) throw new Error('人物或资源清单无效');
  validatePeople(world.people, world.state);
  if(!Array.isArray(world.markers)||world.markers.length>10000||world.markers.some(m=>!m||!Number.isFinite(m.x)||!Number.isFinite(m.y)||typeof m.n!=='string'||m.n.length>1000))throw new Error('地图标记无效');
  if(!world.names||typeof world.names!=='object'||Array.isArray(world.names)||Object.entries(world.names).some(([k,v])=>!(/^(world|[a-zA-Z]+:[a-zA-Z0-9_-]+)$/.test(k))||typeof v!=='string'||v.length>1000))throw new Error('地图命名无效');
  const expected = imageResources(world.state);
  if (world.resources.length !== expected.size) throw new Error('图纸资源数量不一致');
  const validated = [], seen = new Set();
  for (const meta of world.resources) {
    const ref = meta && expected.get(meta.hash);
    if (!ref || seen.has(meta.hash) || meta.mime !== ref.mime || meta.byteLength !== ref.byteLength || meta.path !== ref.path) throw new Error('图纸资源引用不一致');
    seen.add(meta.hash);
    const bytes = files[meta.path];
    if (!bytes || bytes.byteLength !== meta.byteLength) throw new Error('图纸资源丢失或不完整');
    const blob = new Blob([bytes], { type: meta.mime });
    if (await assets.digest(blob) !== meta.hash) throw new Error('图纸资源校验失败');
    validated.push([blob, meta.hash]);
  }
  if (Object.keys(files).length !== 1 + validated.length) throw new Error('世界文件含有未登记的资源');
  // 完整校验后才写入资源库，失败不覆盖当前世界。
  for (const [blob, hash] of validated) await assets.put(blob, hash);
  return world;
}
