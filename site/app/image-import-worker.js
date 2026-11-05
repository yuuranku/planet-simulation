/* 图像解码、高程估算和 PNG 编码都在独立线程完成。 */
'use strict';
importScripts('png-decoder.js', '../core/image-heightmap.js');
const progress = message => postMessage({ type: 'progress', message });
const checkSize = (width, height) => {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 4 || height < 2 || width > 16384 || height > 16384 || width * height > 67108864) throw new Error('图片尺寸须在 4×2 至 16384×16384 之间，且不超过 6400 万像素。');
};
function mimeOf(b) {
  if (b.length >= 24 && b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71) return 'image/png';
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if (b[0] === 66 && b[1] === 77) return 'image/bmp';
  if (b.length >= 12 && String.fromCharCode(...b.subarray(0,4)) === 'RIFF' && String.fromCharCode(...b.subarray(8,12)) === 'WEBP') return 'image/webp';
  throw new Error('无法读取这张图片，请选择 PNG、JPG、WebP 或 BMP 文件。');
}
self.onmessage = async ({ data: { file, grid } }) => {
  try {
    progress('正在读取图片…');
    const bytes = new Uint8Array(await file.arrayBuffer()), mime = mimeOf(bytes);
    let decoded;
    if (mime === 'image/png') {
      const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      checkSize(header.getUint32(16), header.getUint32(20));
      if (bytes[24] >= 8) decoded = PngDecoder.rgba(bytes);
    }
    // 低位索引/交错图片交给浏览器解码；8/16 位 PNG 保留原整数采样。
    if (!decoded) {
      if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') throw new Error('当前浏览器不支持后台图片处理，请更新浏览器或系统 WebView 后重试。');
      const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
      try {
        checkSize(bitmap.width, bitmap.height);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(bitmap, 0, 0);
        decoded = { width: bitmap.width, height: bitmap.height, bitDepth: 8, data: ctx.getImageData(0, 0, bitmap.width, bitmap.height).data };
      } finally { bitmap.close(); }
    }
    progress('正在识别海陆并估算高程…');
    const result = ImageHeightmap.convert(decoded, grid);
    progress('正在生成高度图…');
    const png = PngDecoder.encodeHeightmap(result.width, result.height, result.gray);
    postMessage({ ...result, type: 'ready', bytes: png, mime, sourceWidth: decoded.width, sourceHeight: decoded.height }, [png.buffer, result.gray.buffer]);
  } catch (error) { postMessage({ type: 'error', message: error.message || '图片处理失败，请更换图片重试。' }); }
};
