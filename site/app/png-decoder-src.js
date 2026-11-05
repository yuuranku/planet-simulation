// fast-png reads integer samples before color management. Display previews alone use Canvas.
import { decode, encode, convertIndexedToRgb } from 'fast-png';

export function rgba(bytes) {
  const header = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // fast-png 8's Adam7 decoder does not unpack sub-byte scanlines correctly.
  // The upload worker routes those ordinary 1/2/4-bit images to browser decoding.
  if (header.length >= 29 && header[24] < 8 && header[28] === 1) throw new Error('低位深交错 PNG 需要浏览器图片解码。');
  const png = decode(bytes, { checkCrc: true });
  const bitDepth = png.depth === 16 ? 16 : 8, max = 2 ** bitDepth - 1;
  const out = bitDepth === 16 ? new Uint16Array(png.width * png.height * 4) : new Uint8Array(png.width * png.height * 4);
  const paletteData = png.palette ? convertIndexedToRgb(png) : null;
  const paletteChannels = png.palette && png.palette[0].length;
  const packedStride = Math.ceil(png.width * png.depth / 8), sampleMask = (1 << png.depth) - 1;
  for (let i = 0; i < png.width * png.height; i++) {
    const s = i * png.channels, d = i * 4;
    if (paletteData) {
      const p = i * paletteChannels;
      out[d] = paletteData[p]; out[d + 1] = paletteData[p + 1]; out[d + 2] = paletteData[p + 2]; out[d + 3] = paletteChannels === 4 ? paletteData[p + 3] : max;
    } else if (png.depth < 8) {
      // Low-depth grayscale scanlines are bit-packed, including row padding.
      const x = i % png.width, y = Math.floor(i / png.width), bit = x * png.depth;
      const sample = (png.data[y * packedStride + (bit >> 3)] >> (8 - png.depth - (bit & 7))) & sampleMask;
      out[d] = out[d + 1] = out[d + 2] = Math.round(sample * 255 / sampleMask);
      out[d + 3] = png.transparency && sample === png.transparency[0] ? 0 : max;
    } else if (png.channels <= 2) {
      out[d] = out[d + 1] = out[d + 2] = png.data[s];
      out[d + 3] = png.channels === 2 ? png.data[s + 1] : png.transparency && png.data[s] === png.transparency[0] ? 0 : max;
    } else {
      out[d] = png.data[s]; out[d + 1] = png.data[s + 1]; out[d + 2] = png.data[s + 2];
      out[d + 3] = png.channels === 4 ? png.data[s + 3] : png.transparency && png.transparency.every((v, k) => png.data[s + k] === v) ? 0 : max;
    }
  }
  return { width: png.width, height: png.height, bitDepth, data: out };
}

export function encodeHeightmap(width, height, gray) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || !(gray instanceof Uint16Array) || gray.length !== width * height) throw new Error('高程图片数据无效。');
  return encode({ width, height, depth: 16, channels: 1, data: gray }, { zlib: { level: 6 } });
}
