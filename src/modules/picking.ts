/**
 * Node picking and viewport culling module
 *
 * Handles mouse-to-node collision detection for interactive selection.
 * Uses lightweight checks for fast performance.
 */

import { viewportRadius, getFrameCounter, W, H } from './canvas';
import { state } from './state';
import { perf } from './settings';
import type { TaxonomyNode } from './types'

let _cachedViewR = 0;
let _cachedFrame = -1;

// Fast viewport check - only uses distance from camera center
function nodeInView(d: TaxonomyNode) {
  const frame = getFrameCounter();
  if (frame !== _cachedFrame) {
    _cachedViewR = viewportRadius(perf.rendering.renderDistance);
    _cachedFrame = frame;
  }
  const dx = d._vx - state.camera.x;
  const dy = d._vy - state.camera.y;
  const r = _cachedViewR + d._vr;
  return dx * dx + dy * dy <= r * r;
}

// Check if a node is within the current subtree (is state.current or a descendant of it)
export function isNodeInCurrentSubtree(nodeData: TaxonomyNode) {
  if (!state.current) return true; // If no current node, allow all nodes
  
  // If the node is state.current itself, it's in the subtree
  if (nodeData._id === state.current._id) return true;
  
  // Walk up the parent chain to see if state.current is an ancestor
  let current = nodeData;
  while (current && current.parent) {
    if (current.parent._id === state.current._id) return true;
    current = current.parent;
  }
  
  return false;
}

export function pickNodeAt(px: number, py: number): TaxonomyNode | null {
  const wx = state.camera.x + (px - W / 2) / state.camera.k;
  const wy = state.camera.y + (py - H / 2) / state.camera.k;

  // Fast path: scan only the nodes drawn last frame, topmost (last-drawn) first.
  // This is O(visible) instead of O(total nodes) per pick.
  const visible = state.visibleNodes;
  if (visible && visible.length) {
    for (let i = visible.length - 1; i >= 0; i--) {
      const d = visible[i];
      if (!isNodeInCurrentSubtree(d)) continue;
      const dx = wx - d._vx;
      const dy = wy - d._vy;
      if (dx * dx + dy * dy <= d._vr * d._vr) return d;
    }
    return null;
  }

  // Fallback (e.g. before the first render): scan the precomputed pick order.
  const { pickMinPxRadius, minPxRadius } = perf.rendering;
  const nodes = state.pickOrder || [];
  for (const d of nodes) {
    if (!nodeInView(d)) continue;
    const screenR = d._vr * state.camera.k;
    if (screenR < (pickMinPxRadius || 0)) continue;
    if (screenR < minPxRadius) continue;
    if (!isNodeInCurrentSubtree(d)) continue;
    const dx = wx - d._vx;
    const dy = wy - d._vy;
    if (dx * dx + dy * dy <= d._vr * d._vr) return d;
  }
  return null;
}
