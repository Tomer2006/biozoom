import { breadcrumbsEl } from './dom.js';
import { layoutFor } from './layout.js';
import { rebuildNodeMap, state } from './state.js';
import { updateDeepLinkFromNode } from './deeplink.js';
import { animateToCam } from './camera.js';
import { requestRender, W, H } from './canvas.js';
import { loadChildrenIfNeeded } from './lazy.js';

export function setBreadcrumbs(node) {
  if (!breadcrumbsEl) return;
  breadcrumbsEl.innerHTML = '';
  const path = [];
  let p = node;
  while (p) {
    path.unshift(p);
    p = p.parent;
  }
  path.forEach((n, i) => {
    const el = document.createElement('div');
    el.className = 'crumb';
    el.textContent = n.name;
    el.title = `Go to ${n.name}`;
    el.addEventListener('click', () => goToNode(n, true));
    breadcrumbsEl.appendChild(el);
    if (i < path.length - 1) {
      const sep = document.createElement('div');
      sep.className = 'crumb sep';
      sep.textContent = '›';
      sep.style.cursor = 'default';
      breadcrumbsEl.appendChild(sep);
    }
  });
  updateDeepLinkFromNode(node);
}

export function fitNodeInView(node, frac = 0.35) {
  const d = state.nodeLayoutMap.get(node._id);
  if (!d) return;
  const targetRadiusPx = Math.min(W, H) * frac;
  const k = targetRadiusPx / d._vr;
  animateToCam(d._vx, d._vy, k);
}

export async function goToNode(node, animate = true) {
  await loadChildrenIfNeeded(node);
  state.current = node;
  state.layout = layoutFor(state.current);
  rebuildNodeMap();
  setBreadcrumbs(state.current);
  if (animate) {
    const pad = 20;
    const targetK = Math.min((W - pad) / state.layout.diameter, (H - pad) / state.layout.diameter);
    animateToCam(0, 0, targetK);
  } else {
    state.camera.x = 0;
    state.camera.y = 0;
    state.camera.k = Math.min(W, H) / state.layout.diameter;
  }
  requestRender();
}

export function relayoutPreserveView() {
  // Recompute layout for current node and rebuild mappings, keeping camera where it is
  if (!state.current) return;
  const cx = state.camera.x;
  const cy = state.camera.y;
  const ck = state.camera.k;
  state.layout = layoutFor(state.current);
  rebuildNodeMap();
  state.camera.x = cx;
  state.camera.y = cy;
  state.camera.k = ck;
  setBreadcrumbs(state.current);
  requestRender();
}


