(() => {
  'use strict';
  // All bundled documents have the same origin; keep pending blobs in the top frame.
  if (window === window.top) {
    const pending = new Map();
    window.__atlasSaveBlob = async (url, filename) => {
      try {
        const blob = await (await fetch(url)).blob();
        const token = String(Date.now()) + '-' + Math.random().toString(36).slice(2);
        pending.set(token, blob);
        AndroidDownload.open(token, filename || '下载文件', blob.type || 'application/octet-stream');
      } catch (error) { alert('无法读取待导出的文件：' + error.message); }
    };
    window.__atlasCancelSave = token => pending.delete(token);
    window.__atlasWriteSave = async token => {
      const blob = pending.get(token);
      if (!blob) return;
      try {
        // Bounded chunks keep large world exports out of a single bridge string.
        for (let offset = 0; offset < blob.size; offset += 196608) {
          const bytes = new Uint8Array(await blob.slice(offset, offset + 196608).arrayBuffer());
          let binary = '';
          for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          if (!AndroidDownload.write(token, btoa(binary))) throw new Error('写入失败');
        }
        if (!AndroidDownload.finish(token)) throw new Error('保存失败');
      } catch (error) { AndroidDownload.abort(token); alert('导出失败：' + error.message); }
      finally { pending.delete(token); }
    };
  }
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download && this.href.startsWith('blob:')) {
      window.top.__atlasSaveBlob(this.href, this.download);
      return;
    }
    return originalClick.call(this);
  };
})();
