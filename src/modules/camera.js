/**
 * Camera animation and viewport management module
 *
 * Handles smooth camera transitions, viewport tracking, and coordinates the
 * loading system when the viewport changes during animations.
 */

import { state } from './state.js';
import { requestRender, screenToWorld, W, H } from './canvas.js';
import { perf } from './settings.js';

// Native cubic-in-out easing function (replaces d3-ease)
function easeCubicInOut(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getBreadcrumbZoomOutLimit() {
  const breadcrumbRadius = Number(state.current?._vr ?? state.DATA_ROOT?._vr);
  const zoomLimitRadius = breadcrumbRadius > 0 ? breadcrumbRadius : state.maxNodeRadius;

  if (!(zoomLimitRadius > 0) || !(W > 0) || !(H > 0)) {
    return Number.POSITIVE_INFINITY;
  }

  const targetDiameterPx = Math.min(W, H) * perf.navigation.zoomOutLargestCircleViewportRatio;
  return targetDiameterPx / (zoomLimitRadius * 2);
}

export function getMinCameraZoom() {
  const zoomOutLimit = getBreadcrumbZoomOutLimit();
  if (!Number.isFinite(zoomOutLimit) || zoomOutLimit <= 0) {
    return 0;
  }

  return zoomOutLimit;
}

export function getMaxCameraZoom() {
  const maxZoom = perf.navigation.maxCameraZoom;
  if (!Number.isFinite(maxZoom) || maxZoom <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return maxZoom;
}

export function clampCameraZoom(k) {
  if (!Number.isFinite(k) || k <= 0) {
    return 1;
  }

  const minZoom = getMinCameraZoom();
  const maxZoom = getMaxCameraZoom();
  let clamped = Number.isFinite(minZoom) ? Math.max(k, minZoom) : k;
  clamped = Number.isFinite(maxZoom) ? Math.min(clamped, maxZoom) : clamped;
  return clamped;
}

export function animateToCam(nx, ny, nk, dur = perf.animation.cameraAnimationMs) {
  if (!Number.isFinite(dur) || dur <= 0) dur = perf.animation.cameraAnimationMs;
  const animationId = ++state.cameraAnimationId;
  state.targetCam.x = nx;
  state.targetCam.y = ny;
  state.targetCam.k = clampCameraZoom(nk);

  const sx = state.camera.x,
    sy = state.camera.y,
    sk = state.camera.k,
    start = performance.now();
  state.animating = true;

  function step(now) {
    if (animationId !== state.cameraAnimationId) return;
    const t = Math.min(1, (now - start) / dur);
    const e = easeCubicInOut(t);
    state.camera.x = lerp(sx, state.targetCam.x, e);
    state.camera.y = lerp(sy, state.targetCam.y, e);
    state.camera.k = clampCameraZoom(lerp(sk, state.targetCam.k, e));

    requestRender();

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      state.animating = false;
    }
  }
  requestAnimationFrame(step);
}

export function stopCameraAnimation() {
  state.cameraAnimationId += 1;
  state.animating = false;
  state.targetCam = { ...state.camera };
}

/**
 * Handle wheel zoom (performance-critical - runs on every scroll)
 * @param {WheelEvent} e - The wheel event
 * @param {HTMLElement} canvas - The canvas element
 */
export function handleWheelZoom(e, canvas) {
  const scale = Math.exp(-e.deltaY * perf.input.zoomSensitivity);
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const [wx, wy] = screenToWorld(mx, my);

  state.camera.k = clampCameraZoom(state.camera.k * scale);
  state.camera.x = wx - (mx - rect.width / 2) / state.camera.k;
  state.camera.y = wy - (my - rect.height / 2) / state.camera.k;

  requestRender();
  e.preventDefault();
}

/**
 * Handle camera panning (performance-critical - runs during drag)
 * @param {number} dx - Delta X in screen pixels
 * @param {number} dy - Delta Y in screen pixels
 */
export function handleCameraPan(dx, dy) {
  state.camera.x -= dx / state.camera.k;
  state.camera.y -= dy / state.camera.k;
  requestRender();
}
