import { state, registerNode } from './state.js';
import { setProgress, showLoading, hideLoading } from './loading.js';

function inferChildLevel(parentLevel, parentDepth = 0) {
  // Use depth-based naming to avoid hardcoded ranks
  const parentLevelNum = typeof parentDepth === 'number' ? parentDepth : 0;
  return `Level ${parentLevelNum + 1}`;
}

function attachChildren(parent, children) {
  if (!Array.isArray(children)) children = children ? [].concat(children) : [];
  parent.children = children;
  let childDepth = 0;
  if (typeof parent.level === 'string' && /^Level\s+(\d+)/i.test(parent.level)) {
    const m = parent.level.match(/^Level\s+(\d+)/i);
    childDepth = m ? parseInt(m[1], 10) + 1 : 0;
  }
  for (const child of parent.children) {
    child.name = String(child.name ?? 'Unnamed');
    child.level = child.level || inferChildLevel(parent.level, childDepth);
    child.parent = parent;
    if (child._id == null) child._id = state.globalId++;
    registerNode(child);
  }
}

export async function loadChildrenIfNeeded(node) {
  if (!node) return;
  if (node._childrenLoaded) return;
  if (Array.isArray(node.children) && node.children.length) {
    node._childrenLoaded = true;
    return;
  }
  if (!node.childrenUrl) return; // nothing to load
  try {
    showLoading(`Loading ${node.name}…`);
    setProgress(0.2, 'Fetching children…');
    const res = await fetch(node.childrenUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setProgress(0.6, 'Processing…');
    if (Array.isArray(data)) {
      attachChildren(node, data);
    } else if (data && typeof data === 'object') {
      // Accept either { children: [...] } or full node
      if (Array.isArray(data.children)) {
        attachChildren(node, data.children);
      } else {
        // full node: merge fields, but prefer existing parent linkage
        attachChildren(node, data.children || []);
      }
    } else {
      throw new Error('Unexpected data format');
    }
    node._childrenLoaded = true;
  } finally {
    hideLoading();
  }
}


