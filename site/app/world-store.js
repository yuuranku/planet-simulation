/* 1.4.3 专用世界记录；完整库快照保存在 IndexedDB，不占用 localStorage 配额。 */
(function (G) {
  'use strict';
  let db = null, cache = [], committed = [], revision = 0, initPromise = null, writes = Promise.resolve();
  const copy = value => JSON.parse(JSON.stringify(value));
  function init() {
    if (initPromise) return initPromise;
    initPromise = new Promise((resolve, reject) => {
      if (!G.indexedDB) { reject(new Error('当前环境不支持 IndexedDB')); return; }
      const request = G.indexedDB.open('planet-worlds-1.4.3', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('state');
      request.onerror = () => reject(request.error || new Error('无法打开世界存储'));
      request.onblocked = () => reject(new Error('世界存储被其他页面占用'));
      request.onsuccess = () => {
        db = request.result;
        db.onversionchange = () => { db.close(); db = null; };
        const tx = db.transaction('state', 'readonly'), get = tx.objectStore('state').get('worlds');
        get.onsuccess = () => { cache = Array.isArray(get.result) ? get.result : []; committed = copy(cache); };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('无法读取世界记录'));
        tx.onabort = () => reject(tx.error || new Error('读取世界记录中断'));
      };
    });
    return initPromise;
  }
  function list() { if (!db) throw new Error('世界存储尚未初始化'); return copy(cache); }
  function save(list) {
    if (!db) return Promise.reject(new Error('世界存储尚未初始化'));
    if (!Array.isArray(list)) return Promise.reject(new Error('世界记录必须是数组'));
    const value = copy(list), current = ++revision; cache = value;
    const op = writes.catch(() => {}).then(() => new Promise((resolve, reject) => {
      if (!db) { reject(new Error('世界存储连接已关闭')); return; }
      const tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put(value, 'worlds');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('无法保存世界记录'));
      tx.onabort = () => reject(tx.error || new Error('保存世界记录中断'));
    })).then(() => { committed = copy(value); }, error => { if (current === revision) cache = copy(committed); throw error; });
    writes = op;
    return op;
  }
  G.WorldStore = { init, list, save };
})(window);
