/* 原始地图资源独立保存；世界设置只引用内容摘要。 */
(function (G) {
  'use strict';
  let dbp;
  const hashPattern = /^[a-f0-9]{64}$/;
  function open() {
    return dbp || (dbp = new Promise((resolve, reject) => {
      const request = indexedDB.open('planet-world-assets-1.4.3', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('assets');
      request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); dbp = null; }; resolve(db); };
      request.onerror = () => { dbp = null; reject(request.error || new Error('无法打开地图资源库')); };
      request.onblocked = () => reject(new Error('地图资源库被其他页面占用'));
    }));
  }
  async function digest(value) {
    const bytes = value instanceof Blob ? await value.arrayBuffer() : value;
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  }
  async function transaction(mode, operation) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assets', mode), request = operation(tx.objectStore('assets'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('地图资源读写失败'));
    });
  }
  async function put(file, expectedHash) {
    if (!(file instanceof Blob) || !file.size || file.size > 128 * 1024 * 1024) throw new Error('原始地图必须为 128 MB 以内的非空文件');
    const hash = await digest(file);
    if (expectedHash && hash !== expectedHash) throw new Error('原始地图校验失败，文件内容与保存时不一致');
    await transaction('readwrite', store => store.put(file, hash));
    return { hash, name: String(file.name || '地图.png').slice(0, 200), mime: file.type || 'image/png', byteLength: file.size };
  }
  async function get(hash) {
    if (!hashPattern.test(hash || '')) throw new Error('原始地图摘要无效');
    const file = await transaction('readonly', store => store.get(hash));
    if (!(file instanceof Blob)) throw new Error('缺少原始地图，请导入包含原图的世界文件');
    if (await digest(file) !== hash) throw new Error('原始地图已损坏，请重新导入世界文件');
    return file;
  }
  G.WorldAssets = { put, get, digest };
})(window);
