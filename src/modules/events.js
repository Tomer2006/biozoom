/**
 * Canvas and keyboard interaction module
 *
 * Handles direct canvas input (pan, zoom, hover/pick, click-to-navigate) and
 * global keyboard shortcuts (W = provider search, R = reset, F = fit, ? = help).
 * UI buttons and modals are owned by the React components (Topbar, Breadcrumbs, etc.).
 */

import { canvas, helpModal } from './dom.js';
import { requestRender, screenToWorld } from './canvas.js';
import { pickNodeAt } from './picking.js';
import { state } from './state.js';
import { updateTooltip } from './tooltip.js';
import { logInfo, logDebug, logTrace } from './logger.js';
import { openProviderSearch } from './providers.js';
import { fitNodeInView, goToNode, updateCurrentNodeOnly } from './navigation.js';
import { clampCameraZoom } from './camera.js';
import { isCurrentlyLoading } from './loading.js';
import { hideBigPreview } from './preview.js';
import { perf } from './settings.js';

export function initEvents() {
  let isMiddlePanning = false;
  let lastPan = null;

  // Throttle picking to once per animation frame
  let pickingScheduled = false;
  const lastMouse = { x: 0, y: 0 };

  canvas.addEventListener('mousemove', ev => {
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left,
      y = ev.clientY - rect.top;
    lastMouse.x = x;
    lastMouse.y = y;
    if (isMiddlePanning && lastPan) {
      const dx = x - lastPan.x,
        dy = y - lastPan.y;
      state.camera.x -= dx / state.camera.k;
      state.camera.y -= dy / state.camera.k;
      lastPan = { x, y };
      requestRender();
      // Hide tooltip and big preview while panning
      const tooltipEl = document.getElementById('tooltip');
      if (tooltipEl) tooltipEl.style.opacity = 0;
      hideBigPreview();
      return;
    }

    if (!pickingScheduled) {
      pickingScheduled = true;
      requestAnimationFrame(() => {
        pickingScheduled = false;
        const n = pickNodeAt(lastMouse.x, lastMouse.y);
        const prevId = state.hoverNode?._id || 0;
        const nextId = n?._id || 0;
        state.hoverNode = n;
        // Only update tooltip position every frame; only update content when id changes (handled inside)
        updateTooltip(n, lastMouse.x, lastMouse.y);
        // No canvas re-render needed - highlight is now CSS-based
      });
    }
  });

  canvas.addEventListener('mouseleave', () => {
    state.hoverNode = null;
    if (document.getElementById('tooltip')) document.getElementById('tooltip').style.opacity = 0;
    hideBigPreview();
    // No canvas re-render needed - highlight is now CSS-based
  });

  canvas.addEventListener('mousedown', ev => {
    if (ev.button === 1) {
      isMiddlePanning = true;
      const rect = canvas.getBoundingClientRect();
      lastPan = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      ev.preventDefault();
    }
  });
  window.addEventListener('mouseup', () => {
    isMiddlePanning = false;
    lastPan = null;
  });

  canvas.addEventListener('contextmenu', async ev => {
    ev.preventDefault();

    // Prevent right-clicks during loading to avoid bugs
    if (isCurrentlyLoading()) {
      console.log('🚫 [EVENTS] Right-click ignored - currently loading data');
      logDebug('Right-click ignored during loading');
      return;
    }

    if (state.current && state.current.parent) await goToNode(state.current.parent, true);
  });

  canvas.addEventListener('click', async ev => {
    if (ev.button !== 0) return;

    // Prevent clicks during loading to avoid bugs
    if (isCurrentlyLoading()) {
      console.log('🚫 [EVENTS] Click ignored - currently loading data');
      logDebug('Click ignored during loading');
      // Visual feedback - briefly change cursor to indicate disabled state
      canvas.style.cursor = 'not-allowed';
      setTimeout(() => {
        canvas.style.cursor = '';
      }, perf.input.clickDisabledFeedbackMs);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const screenX = ev.clientX - rect.left;
    const screenY = ev.clientY - rect.top;

    logTrace(`Canvas click: screen=(${screenX}, ${screenY}), canvas_rect=(${rect.left}, ${rect.top}, ${rect.width}, ${rect.height})`);

    const n = pickNodeAt(screenX, screenY);
    if (!n) {
      logDebug('Click missed any node');
      return;
    }

    logInfo(`Node clicked: "${n.name}" (id: ${n._id || 'unknown'})`);
    if (n === state.current) {
      logDebug('Fitting current node in view');
      fitNodeInView(n);
    } else {
      logDebug('Updating tree view to show subtree without moving camera');
      updateCurrentNodeOnly(n);
    }
  });

  canvas.addEventListener(
    'wheel',
    ev => {
      const scale = Math.exp(-ev.deltaY * perf.input.zoomSensitivity);
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left,
        my = ev.clientY - rect.top;
      const [wx, wy] = screenToWorld(mx, my);

      state.camera.k = clampCameraZoom(state.camera.k * scale);
      state.camera.x = wx - (mx - rect.width / 2) / state.camera.k;
      state.camera.y = wy - (my - rect.height / 2) / state.camera.k;

      requestRender();
      ev.preventDefault();
    },
    { passive: false }
  );

  // Keyboard shortcuts
  window.addEventListener('keydown', e => {
    const active = document.activeElement;
    const tag = (active && active.tagName) || '';
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (active && active.isContentEditable === true);
    if (isTyping) return;
    if (e.code === 'KeyW') {
      const target = state.hoverNode || state.current || state.DATA_ROOT;
      if (target) openProviderSearch(target);
      e.preventDefault();
    }
  });

  // R / F / ?
  window.addEventListener('keydown', e => {
    const active = document.activeElement;
    const tag = (active && active.tagName) || '';
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (active && active.isContentEditable === true);
    if (isTyping) return;

    if (e.code === 'KeyR') {
      if (state.DATA_ROOT) (async () => await goToNode(state.DATA_ROOT, true))();
      e.preventDefault();
    } else if (e.code === 'KeyF') {
      const target = state.hoverNode || state.current;
      if (target) fitNodeInView(target);
      e.preventDefault();
    } else if (e.code === 'Slash' || e.code === 'IntlRo' || e.key === 'F1' || e.code === 'F1') {
      if (!helpModal) return;
      const isOpen = helpModal.classList.contains('open');
      if (isOpen) {
        helpModal.classList.remove('open');
        helpModal.setAttribute('aria-hidden', 'true');
      } else {
        helpModal.classList.add('open');
        helpModal.setAttribute('aria-hidden', 'false');
      }
      e.preventDefault();
    }
  });

}
