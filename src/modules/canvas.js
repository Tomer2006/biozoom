/**
 * Canvas management and rendering loop module (React-compatible)
 *
 * Manages the HTML5 canvas context, handles resize events, coordinates the
 * rendering pipeline, implements frame rate limiting, and provides coordinate
 * transformation utilities between world and screen space.
 */

import { getCanvas, getStage } from './dom.js';
import { buildOverlayText, initRuntimeMetrics } from './metrics.js';
import { state } from './state.js';
import { perf } from './settings.js';
import { logDebug } from './logger.js';

let ctx;
let W = 0;
let H = 0;
let DPR = 1;

// Low-resolution offscreen layer for circles (flat fills don't need full DPR).
// Composited onto the main canvas each frame; see getCircleBuffer().
let circleCanvas = null;
let circleCtx = null;
let circleDPR = 1;

let needRender = true;
let rafId = null;
let drawCallback = null;
const onCameraChangeCallbacks = new Set();  // Callbacks when camera changes
let frameCounter = 0;
let lastFpsUpdate = 0;
let framesSinceFps = 0;
let lastCam = { x: 0, y: 0, k: 1 };

// Cache the FPS overlay element instead of querying the DOM every frame.
let fpsElCached = null;
function getFpsEl() {
  if (fpsElCached && fpsElCached.isConnected) return fpsElCached;
  fpsElCached = document.getElementById('fps');
  return fpsElCached;
}

// Frame rate limiting
let lastRenderTime = 0;
let targetFrameTime = 1000 / perf.canvas.targetFPS;
let adaptiveFrameRate = perf.canvas.adaptiveFrameRate;

export function getContext() {
  return ctx;
}

// Offscreen low-DPR layer for drawing circles, or null when a separate layer
// would not be cheaper than the main canvas (e.g. on 1x displays).
export function getCircleBuffer() {
  if (!circleCtx || circleDPR >= DPR) return null;
  return { canvas: circleCanvas, ctx: circleCtx };
}

export function resizeCanvas() {
  const stage = getStage();
  const canvas = getCanvas();
  
  if (!stage || !canvas) {
    // Retry after a short delay if elements aren't ready
    console.log('[Canvas] Waiting for stage/canvas elements...');
    setTimeout(resizeCanvas, 100);
    return;
  }
  
  const bb = stage.getBoundingClientRect();
  
  // Ensure we have valid dimensions
  if (bb.width === 0 || bb.height === 0) {
    console.log('[Canvas] Stage has no dimensions yet, retrying...');
    setTimeout(resizeCanvas, 100);
    return;
  }
  
  const oldW = W, oldH = H;
  DPR = Math.max(1, Math.min(perf.canvas.maxDevicePixelRatio, window.devicePixelRatio || 1));
  W = Math.floor(bb.width);
  H = Math.floor(bb.height);

  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx = canvas.getContext('2d', { desynchronized: true, alpha: false });
  if (ctx) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // Size the low-res circle layer. Only worth keeping when it's actually
  // cheaper than the main canvas (circleDevicePixelRatio < effective DPR).
  circleDPR = Math.max(0.1, Math.min(perf.canvas.circleDevicePixelRatio || 1, DPR));
  if (circleDPR < DPR) {
    if (!circleCanvas) circleCanvas = document.createElement('canvas');
    circleCanvas.width = Math.max(1, Math.floor(W * circleDPR));
    circleCanvas.height = Math.max(1, Math.floor(H * circleDPR));
    circleCtx = circleCanvas.getContext('2d', { alpha: false });
    if (circleCtx) circleCtx.setTransform(circleDPR, 0, 0, circleDPR, 0, 0);
  } else {
    circleCanvas = null;
    circleCtx = null;
  }

  logDebug(`Canvas resized: ${oldW}x${oldH} → ${W}x${H} (DPR: ${DPR}, circleDPR: ${circleDPR})`);
  console.log(`[Canvas] Resized: ${W}x${H} (DPR: ${DPR})`);
}

export function requestRender() {
  needRender = true;
  ensureRAF();
}

export function tick() {
  needRender = true;
  ensureRAF();
}

function ensureRAF() {
  if (rafId == null) rafId = requestAnimationFrame(loop);
}

function loop() {
  rafId = null;

  // Nothing to render: stop the loop entirely. requestRender()/tick() and the
  // camera animation will call ensureRAF() again when there is work to do, so
  // we no longer wake up 60x/sec while idle.
  if (!needRender) {
    return;
  }

  const now = performance.now();
  const timeSinceLastRender = now - lastRenderTime;

  // Frame rate limiting: too soon, keep waiting (needRender is still true).
  if (adaptiveFrameRate && timeSinceLastRender < targetFrameTime) {
    ensureRAF();
    return;
  }

  needRender = false;
  lastRenderTime = now;

  const cam = state.camera;
  const sameCam = cam.x === lastCam.x && cam.y === lastCam.y && cam.k === lastCam.k;
  const layoutChanged = state.layoutChanged;

  // Render if: drawCallback exists AND (camera moved OR layout changed)
  const shouldRender = drawCallback && (!sameCam || layoutChanged);

  if (shouldRender) {
    drawCallback();
    lastCam = { x: cam.x, y: cam.y, k: cam.k };
    state.layoutChanged = false;

    // Notify about camera change (for hover validation - O(1) check)
    for (const callback of onCameraChangeCallbacks) callback();
  }

  frameCounter++;

  // Update FPS display
  framesSinceFps++;
  if (now - lastFpsUpdate >= perf.canvas.fpsUpdateIntervalMs) {
    const fpsEl = getFpsEl();
    if (fpsEl) {
      const sec = (now - lastFpsUpdate) / 1000;
      const fps = framesSinceFps / sec;
      fpsEl.textContent = buildOverlayText(fps);
    }
    lastFpsUpdate = now;
    framesSinceFps = 0;
  }

  // Reschedule only if more rendering was requested during this frame
  // (e.g. an in-progress camera animation called requestRender()).
  if (needRender) ensureRAF();
}

export function registerDrawCallback(cb) {
  drawCallback = cb;
}

export function onCameraChange(cb) {
  if (!cb) return () => {};
  onCameraChangeCallbacks.add(cb);
  return () => onCameraChangeCallbacks.delete(cb);
}

window.addEventListener('resize', () => {
  resizeCanvas();
  requestRender();
});

// Initialize runtime metrics
try { initRuntimeMetrics(); } catch (_) {}

export function worldToScreen(x, y) {
  return [
    W / 2 + (x - state.camera.x) * state.camera.k,
    H / 2 + (y - state.camera.y) * state.camera.k
  ];
}

export function screenToWorld(px, py) {
  return [
    state.camera.x + (px - W / 2) / state.camera.k,
    state.camera.y + (py - H / 2) / state.camera.k
  ];
}

export function viewportRadius(renderDistance) {
  return (Math.hypot(W, H) * perf.canvas.viewportRadiusMultiplier) / state.camera.k * renderDistance;
}

export { W, H };
export function getFrameCounter() {
  return frameCounter;
}
