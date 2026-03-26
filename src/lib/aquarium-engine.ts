// =========================================================
// DIGITALES AQUARIUM ENGINE - Core logic preserved from original
// =========================================================

export interface AquariumState {
  originalImg: HTMLImageElement | null;
  preparedTex: HTMLCanvasElement | null;
  bgSample: number[];
  W: number;
  H: number;
  smoothedDt: number;
  dtAlpha: number;
  aquarium: {
    creatures: Creature[];
    foods: Food[];
    bubbles: Bubble[];
    speed: number;
    max: number;
    fx: number;
    scale: number;
    soundEnabled: boolean;
    volume: number;
    profile: string;
    audioCtx: AudioContext | null;
    masterGain: GainNode | null;
    ambientGain: GainNode | null;
    ambientNodes: (OscillatorNode | BiquadFilterNode | GainNode | AudioBufferSourceNode)[];
  };
  design: DesignState;
  ui: {
    currentTab: string;
    currBgMode: string;
    selectedAssetType: string;
    selectedAssetIndex: number;
    selectedImgData: string | null;
    draggingAssetIndex: number;
    dragDX: number;
    dragDY: number;
  };
  kiosk: {
    hideDelay: number;
    timer: ReturnType<typeof setTimeout> | null;
  };
}

export interface DesignState {
  type: string;
  theme: string;
  light: boolean;
  lightIntensity: number;
  vignette: number;
  bubbleDensity: number;
  grassCount: number;
  bgFit: string;
  bgVignette: number;
  bgData: string | null;
  assets: DesignAsset[];
}

export interface DesignAsset {
  type: string;
  kind?: string;
  data?: string;
  x: number;
  y: number;
  s: number;
  r: number;
}

export interface Food {
  x: number;
  y: number;
  vy: number;
}

export interface Bubble {
  x: number;
  y: number;
  r: number;
  vy: number;
}

// Helpers
export function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function colorDistSq(r: number, g: number, b: number, R: number, G: number, B: number): number {
  const dr = r - R;
  const dg = g - G;
  const db = b - B;
  return dr * dr + dg * dg + db * db;
}

// Image cache
const imgCache = new Map<string, HTMLImageElement>();

export function getCachedImage(src: string): HTMLImageElement | null {
  if (!src) return null;
  let img = imgCache.get(src);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = src;
    imgCache.set(src, img);
  }
  return img;
}

export function getPointerPos(canvas: HTMLCanvasElement, e: MouseEvent | PointerEvent, targetW: number, targetH: number) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * targetW / r.width,
    y: (e.clientY - r.top) * targetH / r.height,
  };
}

// Background rendering
export function buildBackground(bgCtx: CanvasRenderingContext2D, W: number, H: number, design: DesignState) {
  bgCtx.clearRect(0, 0, W, H);

  if (design.type === 'image' && design.bgData) {
    const img = getCachedImage(design.bgData);
    if (img) {
      if (!img.complete) {
        img.onload = () => buildBackground(bgCtx, W, H, design);
        return;
      }

      const iw = img.width || 1;
      const ih = img.height || 1;
      let dw = W;
      let dh = H;
      const r = iw / ih;
      const R = W / H;

      if (design.bgFit === 'contain') {
        if (r > R) { dh = W / r; dw = W; }
        else { dw = H * r; dh = H; }
      } else {
        if (r > R) { dh = H; dw = H * r; }
        else { dw = W; dh = W / r; }
      }

      const dx = (W - dw) / 2;
      const dy = (H - dh) / 2;
      bgCtx.drawImage(img, dx, dy, dw, dh);

      const vg = bgCtx.createRadialGradient(
        W / 2, H / 2, Math.min(W, H) * (1 - design.bgVignette),
        W / 2, H / 2, Math.max(W, H) * 0.65
      );
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(0,0,0,${0.45 * design.bgVignette})`);
      bgCtx.fillStyle = vg;
      bgCtx.fillRect(0, 0, W, H);
    }
    return;
  }

  let top = '#0b233e';
  let mid = '#081a31';
  let bot = '#061222';

  if (design.theme === 'lagoon') { top = '#0e3d4a'; mid = '#0a3840'; bot = '#072a34'; }
  if (design.theme === 'night') { top = '#06102a'; mid = '#080e20'; bot = '#060914'; }
  if (design.theme === 'sunset') { top = '#1a294b'; mid = '#162a4a'; bot = '#0d1e38'; }

  const grd = bgCtx.createRadialGradient(W / 2, H * 0.2, 10, W / 2, H * 0.5, H * 0.9);
  grd.addColorStop(0, top);
  grd.addColorStop(0.6, mid);
  grd.addColorStop(1, bot);
  bgCtx.fillStyle = grd;
  bgCtx.fillRect(0, 0, W, H);

  const vg = bgCtx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * (1 - design.vignette),
    W / 2, H / 2, Math.max(W, H) * 0.6
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(0,0,0,${0.35 * design.vignette})`);
  bgCtx.fillStyle = vg;
  bgCtx.fillRect(0, 0, W, H);
}

export function drawAssetToContext(context: CanvasRenderingContext2D, asset: DesignAsset) {
  context.save();
  context.translate(asset.x, asset.y);
  context.rotate(asset.r || 0);
  context.scale(asset.s || 1, asset.s || 1);

  if (asset.kind === 'img' && asset.data) {
    const img = getCachedImage(asset.data);
    if (img && img.complete) {
      context.drawImage(img, -(img.width / 2), -(img.height / 2));
    }
  } else {
    context.font = '48px serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    const sym: Record<string, string> = {
      grass: '🌿', kelp: '🌱', coral: '🪸', stone: '🪨',
      rock: '⛰️', chest: '🧰', star: '⭐', bubble: '🫧',
    };

    context.fillText(sym[asset.type] || '❇️', 0, 0);
  }

  context.restore();
}

// Segmentation
export function alphaFeather(data: Uint8ClampedArray, w: number, h: number, radius: number) {
  if (radius <= 0) return;

  const a = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 3; i < w * h; i++, j += 4) a[i] = data[j];

  const tmp = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w - 1, x + radius);
      let sum = 0;
      let cnt = 0;
      for (let k = x0; k <= x1; k++) { sum += a[y * w + k]; cnt++; }
      tmp[y * w + x] = sum / cnt;
    }
  }

  const out = new Uint8ClampedArray(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(h - 1, y + radius);
      let sum = 0;
      let cnt = 0;
      for (let k = y0; k <= y1; k++) { sum += tmp[k * w + x]; cnt++; }
      out[y * w + x] = sum / cnt;
    }
  }

  for (let i = 0, j = 3; i < w * h; i++, j += 4) data[j] = out[i];
}

export function floodFillBg(imgd: ImageData, w: number, h: number, bg: number[], thr: number) {
  const d = imgd.data;
  const visited = new Uint8Array(w * h);
  const q: number[] = [];
  let qi = 0;
  const t = thr * thr * 3;

  function push(x: number, y: number) {
    const i = y * w + x;
    if (visited[i]) return;
    visited[i] = 1;
    q.push(i);
  }

  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }

  while (qi < q.length) {
    const i = q[qi++];
    const x = i % w;
    const y = (i / w) | 0;
    const j = i * 4;
    const r = d[j], g = d[j + 1], b = d[j + 2];

    if (colorDistSq(r, g, b, bg[0], bg[1], bg[2]) <= t) {
      d[j + 3] = 0;
      if (x > 0) push(x - 1, y);
      if (x < w - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < h - 1) push(x, y + 1);
    }
  }
}

export function prepare(
  originalImg: HTMLImageElement,
  segMode: string,
  segThreshold: number,
  edgeFeather: number,
  autoCrop: boolean,
  bgSample: number[]
): HTMLCanvasElement | null {
  if (!originalImg) return null;

  const off = document.createElement('canvas');
  const maxDim = 1800;
  const s = Math.min(maxDim / originalImg.width, maxDim / originalImg.height, 1);

  off.width = Math.round(originalImg.width * s);
  off.height = Math.round(originalImg.height * s);

  const o = off.getContext('2d', { willReadFrequently: true })!;
  o.imageSmoothingQuality = 'high';
  o.drawImage(originalImg, 0, 0, off.width, off.height);

  let imgd = o.getImageData(0, 0, off.width, off.height);
  const d = imgd.data;
  const w = off.width;
  const h = off.height;

  let bg = [255, 255, 255];
  if (segMode === 'region' || segMode === 'sample' || segMode === 'chroma') bg = [...bgSample];
  if (segMode === 'white') bg = [255, 255, 255];

  if (segMode === 'region') {
    floodFillBg(imgd, w, h, bg, segThreshold);
  } else if (segMode === 'white') {
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 255 - segThreshold && d[i + 1] > 255 - segThreshold && d[i + 2] > 255 - segThreshold) d[i + 3] = 0;
    }
  } else if (segMode === 'sample') {
    const t = segThreshold * segThreshold * 3;
    for (let i = 0; i < d.length; i += 4) {
      if (colorDistSq(d[i], d[i + 1], d[i + 2], bg[0], bg[1], bg[2]) <= t) d[i + 3] = 0;
    }
  } else if (segMode === 'chroma') {
    const t = (segThreshold * 1.6) * (segThreshold * 1.6) * 3;
    for (let i = 0; i < d.length; i += 4) {
      if (colorDistSq(d[i], d[i + 1], d[i + 2], bg[0], bg[1], bg[2]) <= t) d[i + 3] = 0;
    }
  }

  // Remove isolated pixels
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4 + 3;
      if (d[idx] > 0) {
        let cnt = 0;
        for (let yy = -1; yy <= 1; yy++) {
          for (let xx = -1; xx <= 1; xx++) {
            if (d[((y + yy) * w + (x + xx)) * 4 + 3] > 0) cnt++;
          }
        }
        if (cnt <= 2) d[idx] = 0;
      }
    }
  }

  alphaFeather(d, w, h, edgeFeather);

  if (autoCrop) {
    let minx = w, miny = h, maxx = 0, maxy = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = d[(y * w + x) * 4 + 3];
        if (a > 8) {
          if (x < minx) minx = x;
          if (y < miny) miny = y;
          if (x > maxx) maxx = x;
          if (y > maxy) maxy = y;
        }
      }
    }

    minx = Math.max(0, minx - 2);
    miny = Math.max(0, miny - 2);
    maxx = Math.min(w - 1, maxx + 2);
    maxy = Math.min(h - 1, maxy + 2);

    if (maxx > minx && maxy > miny) {
      const nw = maxx - minx + 1;
      const nh = maxy - miny + 1;
      const nd = new ImageData(nw, nh);
      const sd = nd.data;

      for (let y = 0; y < nh; y++) {
        for (let x = 0; x < nw; x++) {
          const si = ((y + miny) * w + (x + minx)) * 4;
          const di = (y * nw + x) * 4;
          sd[di] = d[si];
          sd[di + 1] = d[si + 1];
          sd[di + 2] = d[si + 2];
          sd[di + 3] = d[si + 3];
        }
      }

      imgd = nd;
      off.width = nw;
      off.height = nh;
      o.clearRect(0, 0, nw, nh);
      o.putImageData(imgd, 0, 0);
    } else {
      o.putImageData(imgd, 0, 0);
    }
  } else {
    o.putImageData(imgd, 0, 0);
  }

  return off;
}

// Creature class
function compositeNoise(t: number, p: number): number {
  return Math.sin(t * 0.7 + p) * 0.6 + Math.sin(t * 1.3 + p * 1.7) * 0.4;
}

function applySeparation(creature: Creature, list: Creature[], dt: number) {
  const range = 120;
  const range2 = range * range;
  let rx = 0, ry = 0, count = 0;

  for (const other of list) {
    if (other === creature) continue;
    const dx = creature.x - other.x;
    const dy = creature.y - other.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 0 && d2 < range2) {
      const inv = 1 / Math.sqrt(d2);
      rx += dx * inv;
      ry += dy * inv;
      count++;
    }
  }

  if (count > 0) {
    rx /= count;
    ry /= count;
    creature.velX += rx * 60 * dt;
    creature.velY += ry * 40 * dt;
  }
}

export class Creature {
  tex: HTMLCanvasElement;
  name: string;
  x: number;
  y: number;
  baseS: number;
  headRight: boolean;
  dir: number;
  v: number;
  phase: number;
  nameA: number;
  velX: number;
  velY: number;
  tilt: number;
  biteT: number;
  speedF: number;
  nameAlways: boolean;
  target: { x: number; y: number };

  constructor(tex: HTMLCanvasElement, name: string, spawn: { scale?: number; speed?: number; headRight?: boolean; speedF?: number; nameAlways?: boolean }, W: number, H: number) {
    this.tex = tex;
    this.name = name || '';
    this.x = rand(W * 0.4, W * 0.6);
    this.y = rand(H * 0.3, H * 0.7);
    this.baseS = spawn?.scale || 1.0;
    this.headRight = typeof spawn?.headRight !== 'undefined' ? !!spawn.headRight : true;
    this.dir = this.headRight ? 1 : -1;
    this.v = rand(50, 95) * (spawn?.speed || 1.0);
    this.phase = Math.random() * Math.PI * 2;
    this.nameA = 0;
    this.velX = (Math.random() < 0.5 ? -1 : 1) * this.v * 0.2;
    this.velY = rand(-10, 10);
    this.tilt = 0;
    this.biteT = 0;
    this.speedF = spawn?.speedF || 1.0;
    this.nameAlways = !!spawn?.nameAlways;
    this.target = { x: 0, y: 0 };
    this.setEdgeTarget(W, H);
  }

  setEdgeTarget(W: number, H: number) {
    const goRight = Math.random() < 0.5;
    this.target = {
      x: goRight ? rand(0.82 * W, 0.92 * W) : rand(0.08 * W, 0.18 * W),
      y: rand(0.2 * H, 0.8 * H),
    };
  }

  chooseWander(W: number, H: number) {
    this.target = {
      x: rand(0.2 * W, 0.8 * W),
      y: rand(0.2 * H, 0.8 * H),
    };
  }

  update(dt: number, list: Creature[], aq: AquariumState['aquarium'], W: number, H: number) {
    const speed = this.v * aq.speed * (this.speedF || 1);
    let localTarget = this.target;

    if (aq.foods.length) {
      let best: Food | null = null;
      let bd = 1e9;
      for (const f of aq.foods) {
        const d = Math.hypot(f.x - this.x, f.y - this.y);
        if (d < bd) { bd = d; best = f; }
      }
      if (best) localTarget = { x: best.x, y: best.y };
    }

    const dx = localTarget.x - this.x;
    const dy = localTarget.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ax = (dx / dist) * speed * 0.20;
    const ay = (dy / dist) * speed * 0.10;

    this.velX = this.velX * 0.90 + ax * 0.10;
    this.velY = this.velY * 0.90 + ay * 0.10;

    applySeparation(this, list, dt);

    const n = compositeNoise(performance.now() * 0.001, this.phase);
    const biteFactor = this.biteT > 0 ? 0.6 : 1.0;

    this.y += biteFactor * (this.velY * dt + n * 0.6);
    this.x += biteFactor * (this.velX * dt);

    const movingRight = this.velX >= 0;
    this.dir = this.headRight ? (movingRight ? 1 : -1) : (movingRight ? -1 : 1);
    this.tilt = Math.atan2(this.velY, Math.abs(this.velX) + 1e-3) * 0.3;

    if (this.x < -240) this.x = W + 240;
    if (this.x > W + 240) this.x = -240;
    this.y = clamp(this.y, 60, H - 60);

    if (!aq.foods.length && dist < 60) {
      if (Math.random() < 0.6) this.setEdgeTarget(W, H);
      else this.chooseWander(W, H);
    }

    const scale = this.baseS * aq.scale;
    const halfW = this.tex.width * scale * 0.40;
    const halfH = this.tex.height * scale * 0.32;

    for (let i = aq.foods.length - 1; i >= 0; i--) {
      const f = aq.foods[i];
      const nx = (f.x - this.x) / halfW;
      const ny = (f.y - this.y) / halfH;

      if (nx * nx + ny * ny < 1.0) {
        aq.foods.splice(i, 1);
        for (let k = 0; k < 8; k++) {
          aq.bubbles.push({ x: f.x, y: f.y, r: rand(1.5, 2.5), vy: rand(30, 60) });
        }
        this.biteT = 0.45;
      }
    }

    this.biteT = this.biteT > 0 ? this.biteT - dt : 0;
    this.nameA = this.nameAlways ? 1 : Math.max(0, this.nameA - dt * 1.4);
  }

  draw(ctx: CanvasRenderingContext2D, aqScale: number) {
    const scale = this.baseS * aqScale;
    const vNow = Math.hypot(this.velX, this.velY);
    const speedNorm = clamp(vNow / 140, 0, 1);
    const biteBoost = this.biteT > 0 ? 4 : 0;

    drawImgWithWave(ctx, this.tex, this.x, this.y, scale, this.dir, this.tilt, performance.now() * 0.001, 7, speedNorm, biteBoost);

    if (this.name && this.nameA > 0.02) {
      ctx.save();
      ctx.globalAlpha = this.nameA;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '18px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.name, this.x, this.y - this.tex.height * scale * 0.55);
      ctx.restore();
    }
  }
}

function drawImgWithWave(
  ctx: CanvasRenderingContext2D,
  tex: HTMLCanvasElement,
  x: number, y: number, scale: number, dir: number,
  tilt: number, time: number, ampBase: number, speedNorm: number, biteBoost: number
) {
  const w = tex.width * scale;
  const h = tex.height * scale;
  const slices = 18;
  const sliceW = tex.width / slices;
  const amp = (ampBase + biteBoost) * (0.6 + 0.4 * speedNorm);
  const freq = 1.8 * (0.8 + 0.4 * speedNorm);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(dir, 1);

  for (let i = 0; i < slices; i++) {
    const sx = i * sliceW;
    const sw = i === slices - 1 ? (tex.width - sx) : sliceW;
    const progress = i / (slices - 1);
    const tailProg = dir === 1 ? progress : 1 - progress;
    const headBoost = 0.10 * (1.0 - progress);
    const offset = Math.sin(time * freq + progress * 3.2) * amp * (0.2 + 0.8 * tailProg) * (1.0 + headBoost);
    const dx = -w / 2 + (sx * scale) + offset;
    const dy = -h / 2;
    ctx.drawImage(tex, sx, 0, sw, tex.height, dx, dy, sw * scale, h);
  }

  ctx.restore();
}

// Audio engine
export function ensureAudio(aq: AquariumState['aquarium']): AudioContext | null {
  if (aq.audioCtx) return aq.audioCtx;

  const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtxClass) return null;

  aq.audioCtx = new AudioCtxClass();
  aq.masterGain = aq.audioCtx!.createGain();
  aq.ambientGain = aq.audioCtx!.createGain();

  aq.masterGain!.gain.value = aq.volume;
  aq.ambientGain!.gain.value = 0;

  aq.ambientGain!.connect(aq.masterGain!);
  aq.masterGain!.connect(aq.audioCtx!.destination);

  return aq.audioCtx;
}

export async function unlockAudio(aq: AquariumState['aquarium']): Promise<boolean> {
  const ctx = ensureAudio(aq);
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch (_e) { /* ignore */ }
  }
  return true;
}

function createNoiseSource(ctx: AudioContext, seconds = 2, amp = 0.15): AudioBufferSourceNode {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * amp;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

export function stopAmbientLoop(aq: AquariumState['aquarium']) {
  if (!aq.audioCtx) return;
  const now = aq.audioCtx.currentTime;
  aq.ambientGain!.gain.cancelScheduledValues(now);
  aq.ambientGain!.gain.linearRampToValueAtTime(0, now + 0.25);

  (aq.ambientNodes || []).forEach(node => {
    try { if ((node as any).stop) (node as any).stop(now + 0.3); } catch (_e) { /* ignore */ }
    try { if (node.disconnect) node.disconnect(); } catch (_e) { /* ignore */ }
  });
  aq.ambientNodes = [];
}

export function startAmbientProfile(aq: AquariumState['aquarium'], profile: string) {
  const ctx = aq.audioCtx;
  if (!ctx) return;
  stopAmbientLoop(aq);
  aq.profile = profile;

  if (profile === 'off') {
    aq.soundEnabled = false;
    return;
  }

  const nodes: any[] = [];

  if (profile === 'aquarium') {
    const noise = createNoiseSource(ctx, 2, 0.16);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1;
    lfoGain.gain.value = 110;
    lfo.connect(lfoGain);
    lfoGain.connect(lp.frequency);
    noise.connect(lp);
    lp.connect(aq.ambientGain!);
    noise.start();
    lfo.start();
    nodes.push(noise, lfo, lp, lfoGain);
  }

  if (profile === 'ocean') {
    const noise = createNoiseSource(ctx, 3, 0.22);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 260;
    bp.Q.value = 0.8;
    const waveLfo = ctx.createOscillator();
    const waveGain = ctx.createGain();
    waveLfo.type = 'sine';
    waveLfo.frequency.value = 0.07;
    waveGain.gain.value = 180;
    waveLfo.connect(waveGain);
    waveGain.connect(bp.frequency);
    noise.connect(bp);
    bp.connect(aq.ambientGain!);
    noise.start();
    waveLfo.start();
    nodes.push(noise, waveLfo, bp, waveGain);
  }

  if (profile === 'lagoon') {
    const noise = createNoiseSource(ctx, 2, 0.12);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 180;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.value = 0.16;
    shimmerGain.gain.value = 90;
    shimmer.connect(shimmerGain);
    shimmerGain.connect(lp.frequency);
    noise.connect(hp);
    hp.connect(lp);
    lp.connect(aq.ambientGain!);
    noise.start();
    shimmer.start();
    nodes.push(noise, shimmer, hp, lp, shimmerGain);
  }

  if (profile === 'deep') {
    const noise = createNoiseSource(ctx, 4, 0.2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    const rumble = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    rumble.type = 'sine';
    rumble.frequency.value = 34;
    rumbleGain.gain.value = 0.015;
    noise.connect(lp);
    lp.connect(aq.ambientGain!);
    rumble.connect(rumbleGain);
    rumbleGain.connect(aq.ambientGain!);
    noise.start();
    rumble.start();
    nodes.push(noise, rumble, lp, rumbleGain);
  }

  aq.ambientNodes = nodes;

  if (aq.soundEnabled) {
    const now = ctx.currentTime;
    aq.ambientGain!.gain.cancelScheduledValues(now);
    aq.ambientGain!.gain.setValueAtTime(0, now);
    aq.ambientGain!.gain.linearRampToValueAtTime(0.08, now + 0.45);
  }
}

export function playTone(aq: AquariumState['aquarium'], opts: { freq?: number; type?: OscillatorType; duration?: number; gain?: number; slideTo?: number | null }) {
  if (!aq.soundEnabled) return;
  const ctx = ensureAudio(aq);
  if (!ctx || !aq.masterGain) return;

  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts.type || 'sine';
  osc.frequency.setValueAtTime(opts.freq || 440, ctx.currentTime);
  if (opts.slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), ctx.currentTime + (opts.duration || 0.12));
  }
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(opts.gain || 0.05, ctx.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (opts.duration || 0.12));
  osc.connect(g);
  g.connect(aq.masterGain);
  osc.start();
  osc.stop(ctx.currentTime + (opts.duration || 0.12) + 0.03);
}

// Presets
export const PRESETS: Record<string, { speed: number; fx: number; max: number }> = {
  Event: { speed: 1.7, fx: 0.8, max: 120 },
  Schule: { speed: 1.5, fx: 0.6, max: 100 },
  Museum: { speed: 1.3, fx: 0.5, max: 80 },
  App: { speed: 1.3, fx: 0.5, max: 70 },
  Schwimmbad: { speed: 1.1, fx: 0.3, max: 70 },
};

// Storage helpers
export function loadVariantMap(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem('da_variants') || '{}');
  } catch (_e) {
    return {};
  }
}

export function saveVariantMap(map: Record<string, any>) {
  localStorage.setItem('da_variants', JSON.stringify(map));
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target!.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve((e.target!.result as string) || '');
    r.onerror = reject;
    r.readAsText(file);
  });
}

// Auto background sample from image corners
export function autoBackgroundSample(img: HTMLImageElement): number[] {
  const off = document.createElement('canvas');
  off.width = 100;
  off.height = 100;
  const o = off.getContext('2d', { willReadFrequently: true })!;

  const s = Math.min(100 / img.width, 100 / img.height, 1);
  const w = Math.max(1, Math.round(img.width * s));
  const h = Math.max(1, Math.round(img.height * s));

  o.drawImage(img, 0, 0, w, h);

  const corners = [
    [2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3],
  ].map(([x, y]) => {
    const d = o.getImageData(Math.max(0, x), Math.max(0, y), 1, 1).data;
    return [d[0], d[1], d[2]];
  });

  const avg = [0, 0, 0];
  corners.forEach(c => { avg[0] += c[0]; avg[1] += c[1]; avg[2] += c[2]; });
  return avg.map(v => v / corners.length);
}

// Background frame drawing for aquarium loop
export function drawBackgroundFrame(
  ctx: CanvasRenderingContext2D,
  bgOff: HTMLCanvasElement,
  t: number,
  state: AquariumState
) {
  const { W, H, design, aquarium, smoothedDt } = state;
  ctx.drawImage(bgOff, 0, 0);

  // Light rays
  if (design.light) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const L = Math.round(6 * design.lightIntensity);
    for (let i = 0; i < L; i++) {
      const x = (W / 2) + Math.sin(t * 0.00018 + i) * W * 0.22;
      const g = ctx.createLinearGradient(x, 0, x + 220, H);
      const alpha = 0.03 * design.lightIntensity;
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 240, H);
    }
    ctx.restore();
  }

  // Seagrass
  ctx.save();
  const G = design.grassCount;
  for (let i = 0; i < G; i++) {
    const bx = (i + 0.5) * W / G;
    const sway = Math.sin(t * 0.001 + i) * 20;
    ctx.strokeStyle = 'rgba(46,193,168,0.45)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(bx, H);
    ctx.quadraticCurveTo(bx + sway * 0.5, H - 120, bx + sway, H - 260);
    ctx.stroke();
  }
  ctx.restore();

  // Bubbles
  const maxB = 90 * design.bubbleDensity * aquarium.fx;
  if (aquarium.bubbles.length < maxB) {
    aquarium.bubbles.push({
      x: rand(0, W),
      y: H + 20,
      r: rand(2, 6),
      vy: rand(28, 56),
    });
  }

  ctx.save();
  ctx.fillStyle = 'rgba(180,220,255,0.35)';
  for (const b of aquarium.bubbles) {
    b.y -= b.vy * smoothedDt;
    if (b.y < -20) { b.x = rand(0, W); b.y = H + 20; }
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function createInitialState(): AquariumState {
  return {
    originalImg: null,
    preparedTex: null,
    bgSample: [255, 255, 255],
    W: 1920,
    H: 1080,
    smoothedDt: 1 / 60,
    dtAlpha: 0.1,
    aquarium: {
      creatures: [],
      foods: [],
      bubbles: [],
      speed: 1.7,
      max: 100,
      fx: 0.6,
      scale: 1,
      soundEnabled: false,
      volume: 0.35,
      profile: 'aquarium',
      audioCtx: null,
      masterGain: null,
      ambientGain: null,
      ambientNodes: [],
    },
    design: {
      type: 'theme',
      theme: 'deep',
      light: true,
      lightIntensity: 0.8,
      vignette: 0.25,
      bubbleDensity: 1.0,
      grassCount: 18,
      bgFit: 'cover',
      bgVignette: 0.2,
      bgData: null,
      assets: [],
    },
    ui: {
      currentTab: 'studio',
      currBgMode: 'theme',
      selectedAssetType: 'grass',
      selectedAssetIndex: -1,
      selectedImgData: null,
      draggingAssetIndex: -1,
      dragDX: 0,
      dragDY: 0,
    },
    kiosk: {
      hideDelay: 5000,
      timer: null,
    },
  };
}
