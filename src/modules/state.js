/**
 * Global application state management module
 *
 * Centralizes all application state including current navigation position,
 * layout data, camera settings, hover states, and data loading status.
 * Provides node mapping and layout indexing utilities for efficient lookups.
 */

export const state = {
  DATA_ROOT: null,
  current: null,
  layout: null,
  rootLayout: null, // Cached global layout for Eager mode
  globalId: 1,
  maxNodeRadius: 0,
  minNodeRadius: 0,

  // camera
  camera: { x: 0, y: 0, k: 1 },
  targetCam: { x: 0, y: 0, k: 1 },
  cameraAnimationId: 0,
  animating: false,

  // hover
  hoverNode: null,

  // layout map
  nodeLayoutMap: new Map(),
  // cached orders for performance
  pickOrder: [],  // nodes sorted by level for picking (deepest first)
  visibleNodes: [], // nodes drawn in the last frame (populated by the renderer for fast picking)

  // layout change tracking
  layoutChanged: false,

  // data loading state
  loadMode: 'eager', // 'eager' only now
};

// Collect all nodes in a (data) tree, depth-first. Replaces the per-node
// .descendants() methods that the old hierarchy wrapper attached to every node.
function descendants(root) {
  const result = [];
  if (!root) return result;
  const stack = [root];
  while (stack.length) {
    const n = stack.pop();
    result.push(n);
    const ch = n.children;
    if (ch) {
      for (let i = ch.length - 1; i >= 0; i--) stack.push(ch[i]);
    }
  }
  return result;
}

export function rebuildNodeMap() {
  state.nodeLayoutMap.clear();
  state.maxNodeRadius = 0;
  state.minNodeRadius = Number.POSITIVE_INFINITY;
  if (!state.layout?.root) return;
  const desc = descendants(state.layout.root);
  desc.forEach(d => {
    let labelTopSpaceWorld = d._vr * 2;
    const children = d.children || [];
    if (children.length > 0) {
      const parentTop = d._vy - d._vr;
      let highestChildTop = d._vy + d._vr;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const childTop = child._vy - child._vr;
        if (childTop < highestChildTop) {
          highestChildTop = childTop;
        }
      }
      labelTopSpaceWorld = Math.max(0, highestChildTop - parentTop);
    }

    d._labelTopSpaceWorld = labelTopSpaceWorld;
    state.nodeLayoutMap.set(d._id, d);
    if (typeof d._vr === 'number' && d._vr > state.maxNodeRadius) {
      state.maxNodeRadius = d._vr;
    }
    if (typeof d._vr === 'number' && d._vr > 0 && d._vr < state.minNodeRadius) {
      state.minNodeRadius = d._vr;
    }
  });
  if (!Number.isFinite(state.minNodeRadius)) {
    state.minNodeRadius = 0;
  }
  // Precompute pick order: deepest nodes first for accurate picking
  state.pickOrder = desc.slice().sort((a, b) => (b.level || 0) - (a.level || 0));
}
