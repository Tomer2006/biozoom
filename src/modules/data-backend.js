import { state, rebuildNodeMap } from './state.js';
import { setProgress } from './loading.js';
import { updateNavigation } from './navigation.js';
import { decodePath } from './deeplink.js';
import { logInfo } from './logger.js';
import { W, H, onCameraChange, requestRender } from './canvas.js';
import { perf } from './settings.js';

const API_BASE = (import.meta.env.VITE_DATA_API_URL || '/api').replace(/\/$/, '');
const nodeCache = new Map();
const hydratedNodeIds = new Set();
const nodeLoadPromises = new Map();
const VIEWPORT_PAD_PX = 120;
const VIEWPORT_LIMIT = 12000;
const VIEWPORT_DEBOUNCE_MS = 160;
let viewportTimer = null;
let viewportLoadingRegistered = false;
let lastViewportKey = '';
let inFlightViewportKey = '';

export async function loadBackend(apiBase = API_BASE) {
  state.loadMode = 'backend';
  state.backendApiBase = apiBase.replace(/\/$/, '');
  setProgress(0.15, 'Loading taxonomy root from backend...', 1, 1);

  const response = await fetchJson(`${state.backendApiBase}/tree/root?depth=0`);
  stitchResponse(response);

  const root = nodeCache.get(response.root_id);
  if (!root) throw new Error('Backend did not return a root node');

  state.DATA_ROOT = root;
  state.useBakedLayout = true;
  refreshBackendLayout();

  const rawHash = location.hash ? location.hash.slice(1) : '';
  const decoded = decodePath(rawHash);
  if (decoded) {
    const node = await findBackendNodeByPath(decoded);
    if (node) {
      await updateNavigation(node, false);
    } else {
      await updateNavigation(root, false);
    }
  } else {
    await updateNavigation(root, false);
  }

  registerViewportLoader();
  scheduleBackendViewportLoad({ immediate: true, force: true });

  setProgress(1, 'Taxonomy ready', 1, 1);
  logInfo(`Backend taxonomy loaded with ${nodeCache.size.toLocaleString()} cached nodes`);
  return root;
}

export async function ensureBackendViewport(options = {}) {
  if (state.loadMode !== 'backend') return null;
  if (!(W > 0) || !(H > 0)) return null;

  const key = viewportKey();
  if (!options.force && (key === lastViewportKey || key === inFlightViewportKey)) {
    return null;
  }

  inFlightViewportKey = key;
  const params = new URLSearchParams({
    x: String(state.camera.x),
    y: String(state.camera.y),
    k: String(state.camera.k),
    w: String(W),
    h: String(H),
    minPxRadius: String(perf.rendering.minPxRadius),
    padPx: String(VIEWPORT_PAD_PX),
    limit: String(VIEWPORT_LIMIT),
    currentId: String(state.current?._id || state.DATA_ROOT?._id || 1),
  });

  try {
    const response = await fetchJson(`${state.backendApiBase}/tree/viewport?${params}`);
    stitchResponse(response);
    refreshBackendLayout();
    requestRender();
    lastViewportKey = key;
    return response;
  } finally {
    if (inFlightViewportKey === key) inFlightViewportKey = '';
  }
}

function scheduleBackendViewportLoad(options = {}) {
  if (state.loadMode !== 'backend') return;
  if (viewportTimer) {
    clearTimeout(viewportTimer);
    viewportTimer = null;
  }

  if (options.immediate) {
    void ensureBackendViewport({ force: options.force });
    return;
  }

  viewportTimer = setTimeout(() => {
    viewportTimer = null;
    void ensureBackendViewport({ force: options.force });
  }, VIEWPORT_DEBOUNCE_MS);
}

export async function loadBackendNodeById(id) {
  if (state.loadMode !== 'backend') return null;
  if (hydratedNodeIds.has(id)) return nodeCache.get(id) || null;
  if (nodeLoadPromises.has(id)) return nodeLoadPromises.get(id);

  const loadPromise = fetchJson(`${state.backendApiBase}/tree/node/${id}?depth=0`)
    .then(response => {
      stitchResponse(response);
      refreshBackendLayout();
      hydratedNodeIds.add(id);
      return nodeCache.get(id) || null;
    })
    .finally(() => nodeLoadPromises.delete(id));

  nodeLoadPromises.set(id, loadPromise);
  return loadPromise;
}

export function prefetchBackendNodeById(id) {
  if (state.loadMode !== 'backend' || hydratedNodeIds.has(id)) return Promise.resolve(nodeCache.get(id) || null);
  return loadBackendNodeById(id);
}

export async function randomBackendNode(fromId) {
  if (state.loadMode !== 'backend') return null;
  const params = new URLSearchParams({ depth: '0' });
  if (fromId != null) params.set('from', String(fromId));
  const response = await fetchJson(`${state.backendApiBase}/random?${params}`);
  stitchResponse(response);
  refreshBackendLayout();
  return nodeCache.get(response.requested_id) || null;
}

export async function findBackendNodeByPath(path) {
  if (state.loadMode !== 'backend') return null;
  const response = await fetchJson(`${state.backendApiBase}/tree/path?path=${encodeURIComponent(path)}&depth=0`);
  stitchResponse(response);
  refreshBackendLayout();
  return nodeCache.get(response.requested_id) || null;
}

export async function searchBackendNodes(query, limit, signal) {
  if (state.loadMode !== 'backend') return null;
  const response = await fetchJson(
    `${state.backendApiBase}/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    { signal, cache: 'default' },
  );
  return (response.matches || []).map(match => {
    const cached = getOrCreateNode(match);
    cached._searchPath = match.path || '';
    cached._hasChildren = match.has_children;
    cached._leaves = match.leaves || 1;
    return cached;
  });
}

function stitchResponse(response) {
  const serverNodes = response.nodes || [];
  for (const serverNode of serverNodes) {
    getOrCreateNode(serverNode);
  }

  const childIdsByParent = new Map();
  for (const serverNode of serverNodes) {
    if (serverNode.parent_id == null) continue;
    if (!childIdsByParent.has(serverNode.parent_id)) childIdsByParent.set(serverNode.parent_id, []);
    childIdsByParent.get(serverNode.parent_id).push(serverNode.id);
  }

  // Note: check `.length`, not just presence — buildNodeResponse always sends an
  // `expanded_ids` array, and an empty one (e.g. a depth=0 node/random/path response)
  // is still truthy. Falling through to the else branch below append-wires the node's
  // ancestor path so the node is reachable from the root (required for zoomToNode).
  if (response.expanded_ids && response.expanded_ids.length) {
    for (const parentId of response.expanded_ids || []) {
      const parent = nodeCache.get(parentId);
      if (!parent) continue;

      const children = (childIdsByParent.get(parentId) || [])
        .map(childId => nodeCache.get(childId))
        .filter(Boolean);

      parent.children = children;
      for (const child of children) child.parent = parent;
    }
  } else {
    for (const [parentId, childIds] of childIdsByParent) {
      const parent = nodeCache.get(parentId);
      if (!parent) continue;
      for (const childId of childIds) {
        const child = nodeCache.get(childId);
        if (!child) continue;
        child.parent = parent;
        if (!parent.children.some(existing => existing._id === child._id)) {
          parent.children.push(child);
        }
      }
    }
  }

  for (const parentId of response.expanded_ids || []) {
    const parent = nodeCache.get(parentId);
    if (!parent) continue;
    parent._loadedDepth = Math.max(parent._loadedDepth || 0, response.depth || 0);
  }

  if (response.root_id && !state.DATA_ROOT) {
    state.DATA_ROOT = nodeCache.get(response.root_id) || null;
  }
}

function registerViewportLoader() {
  if (viewportLoadingRegistered) return;
  viewportLoadingRegistered = true;
  onCameraChange(() => scheduleBackendViewportLoad());
  window.addEventListener('resize', () => scheduleBackendViewportLoad({ force: true }));
}

function viewportKey() {
  const bucketWorld = 32 / Math.max(state.camera.k, 0.0001);
  return [
    Math.round(state.camera.x / bucketWorld),
    Math.round(state.camera.y / bucketWorld),
    Math.round(Math.log2(state.camera.k) * 8),
    W,
    H,
    perf.rendering.minPxRadius,
    state.current?._id || state.DATA_ROOT?._id || 1,
  ].join('|');
}

function getOrCreateNode(serverNode) {
  let node = nodeCache.get(serverNode.id);
  if (!node) {
    node = {
      children: [],
      parent: null,
      _loadedDepth: 0,
    };
    nodeCache.set(serverNode.id, node);
  }

  node.name = serverNode.name;
  node.level = serverNode.level;
  node._id = serverNode.id;
  node._vx = serverNode.x;
  node._vy = serverNode.y;
  node._vr = serverNode.r;
  node._leaves = serverNode.leaves || 1;
  node._hasChildren = Boolean(serverNode.has_children);

  const parent = serverNode.parent_id == null ? null : nodeCache.get(serverNode.parent_id);
  if (parent) node.parent = parent;

  return node;
}

function refreshBackendLayout() {
  const root = state.DATA_ROOT;
  if (!root) return;

  const hierarchyRoot = createHierarchyWrapper(root);
  state.layout = {
    root: hierarchyRoot,
    diameter: 4000,
  };
  state.rootLayout = state.layout;
  rebuildNodeMap();
  state.layoutChanged = true;
}

function createHierarchyWrapper(root) {
  let cachedDescendants = null;

  function wrapNode(dataNode, parent = null) {
    const wrapped = {
      data: dataNode,
      depth: dataNode.level,
      parent,
      children: null,
      _vx: dataNode._vx,
      _vy: dataNode._vy,
      _vr: dataNode._vr,
      value: dataNode._leaves || 1,
      height: 0,
    };

    if (dataNode.children && dataNode.children.length > 0) {
      wrapped.children = dataNode.children.map(child => wrapNode(child, wrapped));
    }

    wrapped.descendants = function descendants() {
      const result = [];
      const stack = [this];
      while (stack.length) {
        const node = stack.pop();
        result.push(node);
        if (node.children) {
          for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]);
        }
      }
      return result;
    };
    wrapped.each = function each(callback) {
      const nodes = this.descendants();
      for (const node of nodes) callback(node);
      return this;
    };

    return wrapped;
  }

  const hierarchyRoot = wrapNode(root);
  hierarchyRoot.descendants = function descendants() {
    if (!cachedDescendants) cachedDescendants = wrappedDescendants(this);
    return cachedDescendants;
  };
  return hierarchyRoot;
}

function wrappedDescendants(root) {
  const result = [];
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    result.push(node);
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]);
    }
  }
  return result;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  if (!response.ok) throw new Error(`Backend request failed: ${response.status} ${response.statusText}`);
  return response.json();
}
