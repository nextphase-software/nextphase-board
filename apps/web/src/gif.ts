// SPDX-License-Identifier: Apache-2.0
type Control = { disposal: number; delay: number; transparent?: number };
type Descriptor = {
  x: number; y: number; width: number; height: number; interlaced: boolean;
  palette: Uint8Array; min: number; start: number; end: number; control: Control;
};
const defaultControl: Control = { disposal: 0, delay: 100 };
function walk(input: ArrayBuffer | Uint8Array, visit?: (image: Descriptor) => boolean) {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (data.length < 13 || !["GIF87a", "GIF89a"].includes(String.fromCharCode(...data.subarray(0, 6)))) return null;
  const word = (at: number) => data[at] | data[at + 1] << 8;
  const width = word(6), height = word(8);
  if (!width || !height) return null;
  let at = 13, frames = 0, area = 0, control = defaultControl;
  function palette(flags: number) {
    const start = at;
    if (flags & 128) at += 3 * (2 << (flags & 7));
    return at <= data.length ? data.subarray(start, at) : data.subarray(0, 0);
  }
  const global = palette(data[10]);
  function skipBlocks() {
    while (at < data.length) {
      const count = data[at++];
      if (!count) return true;
      at += count;
    }
    return false;
  }
  while (at < data.length) {
    const block = data[at++];
    if (block === 0x21) {
      const label = data[at++];
      if (label === 0xf9 && data[at] === 4 && at + 4 < data.length) {
        const flags = data[at + 1], delay = word(at + 2);
        control = { disposal: flags >> 2 & 7, delay: delay < 2 ? 100 : delay * 10,
          transparent: flags & 1 ? data[at + 4] : undefined };
      }
      if (label === 1) control = defaultControl;
      if (!skipBlocks()) break;
    } else if (block === 0x2c && at + 9 <= data.length) {
      const x = word(at), y = word(at + 2), w = word(at + 4), h = word(at + 6), flags = data[at + 8];
      at += 9;
      const colors = flags & 128 ? palette(flags) : global;
      if (at >= data.length) break;
      const min = data[at++], start = at;
      const complete = skipBlocks();
      frames++; area += w * h;
      if (visit && !visit({ x, y, width: w, height: h, interlaced: !!(flags & 64), palette: colors, min,
        start, end: Math.min(data.length, at), control })) break;
      control = defaultControl;
      if (!complete) break;
    } else break;
  }
  return { width, height, frames, area };
}
export function gifInfo(input: ArrayBuffer | Uint8Array) { return walk(input); }

// Read variable-width codes directly across GIF sub-blocks. The dictionary uses
// prefix links so a full 12-bit dictionary still occupies fixed space.
function pixels(data: Uint8Array, image: Descriptor, draw: (index: number) => void) {
  const clear = 1 << image.min, end = clear + 1;
  const prefix = new Uint16Array(4096), suffix = new Uint8Array(4096), stack = new Uint8Array(4097);
  let bits = 0, count = 0, at = image.start, remaining = 0;
  function code(width: number) {
    while (count < width) {
      if (!remaining) {
        if (at >= image.end) return -1;
        remaining = data[at++]; if (!remaining) return -1;
      }
      if (at >= image.end) return -1;
      bits |= data[at++] << count; count += 8; remaining--;
    }
    const result = bits & ((1 << width) - 1); bits >>>= width; count -= width;
    return result;
  }
  const needed = image.width * image.height;
  let width = image.min + 1, next = end + 1, previous = -1, first = 0, written = 0;
  while (written < needed) {
    let current = code(width);
    if (current < 0 || current === end || current > next) break;
    if (current === clear) { width = image.min + 1; next = end + 1; previous = -1; continue; }
    if (previous < 0 && current >= clear) break;
    const original = current;
    let top = 0;
    if (current === next) { stack[top++] = first; current = previous; }
    while (current >= clear) { stack[top++] = suffix[current]; current = prefix[current]; }
    first = current; stack[top++] = first;
    while (top && written < needed) { draw(stack[--top]); written++; }
    if (previous >= 0 && next < 4096) {
      prefix[next] = previous; suffix[next++] = first;
      if (next === 1 << width && width < 12) width++;
    }
    previous = original;
  }
  return written;
}

export function decodeGif(input: ArrayBuffer | Uint8Array, limit: number) {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input), info = gifInfo(data);
  if (!info) throw Error("gif_invalid");
  const { width, height } = info;
  if (info.frames * width * height > limit || info.area > limit) throw Error("gif_too_large");
  if (!info.frames) throw Error("gif_invalid");
  const screen = new Uint8ClampedArray(width * height * 4);
  const frames: { rgba: Uint8ClampedArray<ArrayBuffer>; delay: number }[] = [];
  walk(data, image => {
    if (image.min < 2 || image.min > 8) throw Error("gif_invalid");
    const before = image.control.disposal === 3 ? screen.slice() : null;
    let x = 0, y = 0, pass = 0;
    const starts = [0, 4, 2, 1], steps = [8, 8, 4, 2];
    const written = image.palette.length ? pixels(data, image, index => {
      if (index !== image.control.transparent && index * 3 < image.palette.length &&
          x + image.x < width && y + image.y < height) {
        const at = ((image.y + y) * width + image.x + x) * 4;
        screen[at] = image.palette[index * 3]; screen[at + 1] = image.palette[index * 3 + 1];
        screen[at + 2] = image.palette[index * 3 + 2]; screen[at + 3] = 255;
      }
      if (++x === image.width) {
        x = 0; y += image.interlaced ? steps[pass] : 1;
        while (image.interlaced && y >= image.height && pass < 3) y = starts[++pass];
      }
    }) : 0;
    if (!written && !frames.length) throw Error("gif_invalid");
    frames.push({ rgba: screen.slice(), delay: image.control.delay });
    if (before) screen.set(before);
    else if (image.control.disposal === 2) {
      const right = Math.min(width, image.x + image.width), bottom = Math.min(height, image.y + image.height);
      for (let row = image.y; row < bottom && image.x < right; row++) screen.fill(0, (row * width + image.x) * 4, (row * width + right) * 4);
    }
    return !!image.palette.length && written === image.width * image.height;
  });
  return { width, height, frames };
}
