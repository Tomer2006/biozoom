#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { TaxonomySearchIndex, normalizeSearchQuery } from './search-index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const publicDir = path.join(repoRoot, 'public');
const distDir = path.join(repoRoot, 'dist');
const dataDir = path.join(publicDir, 'data');

const port = Number(process.env.PORT || 8787);
const defaultDepth = Number(process.env.SUBTREE_DEPTH || 2);
const maxDepth = Number(process.env.MAX_SUBTREE_DEPTH || 4);
const configuredSearchLimit = Number(process.env.MAX_SEARCH_LIMIT || 20);
const maxSearchLimit = Number.isFinite(configuredSearchLimit)
  ? Math.max(1, Math.min(configuredSearchLimit, 20))
  : 20;
const defaultViewportLimit = Number(process.env.VIEWPORT_NODE_LIMIT || 12000);
const spatialCellSize = Number(process.env.SPATIAL_CELL_SIZE || 8);

const index = loadIndex();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/health') {
      return sendJson(res, {
        ok: true,
        total_nodes: index.totalNodes,
        root_id: index.rootId,
      });
    }

    if (url.pathname === '/api/tree/root') {
      return sendJson(res, buildNodeResponse(index.rootId, readDepth(url)));
    }

    if (url.pathname === '/api/tree/viewport') {
      return sendJson(res, buildViewportResponse(url));
    }

    const nodeMatch = url.pathname.match(/^\/api\/tree\/node\/(\d+)$/);
    if (nodeMatch) {
      const id = Number(nodeMatch[1]);
      if (!index.nodeById[id]) return sendJson(res, { error: 'Node not found' }, 404);
      return sendJson(res, buildNodeResponse(id, readDepth(url)));
    }

    if (url.pathname === '/api/tree/path') {
      const pathValue = url.searchParams.get('path') || '';
      const id = findNodeByPath(pathValue);
      if (!id) return sendJson(res, { error: 'Path not found' }, 404);
      return sendJson(res, buildNodeResponse(id, readDepth(url)));
    }

    if (url.pathname === '/api/search') {
      const query = normalizeSearchQuery(url.searchParams.get('q'));
      const requestedLimit = Number(url.searchParams.get('limit') || 20);
      const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 20, maxSearchLimit));
      const searchStarted = performance.now();
      const body = query.length >= 2 ? searchNodes(query, limit) : { matches: [] };
      const durationMs = performance.now() - searchStarted;
      return sendJson(res, body, 200, {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        'Server-Timing': `search;dur=${durationMs.toFixed(1)}`,
      });
    }

    if (url.pathname === '/api/random') {
      const fromRaw = url.searchParams.get('from');
      const fromId = fromRaw != null && index.nodeById[Number(fromRaw)] ? Number(fromRaw) : index.rootId;
      return sendJson(res, buildNodeResponse(pickRandomLeaf(fromId), readDepth(url)));
    }

    return serveStatic(url.pathname, res);
  } catch (error) {
    console.error(error);
    return sendJson(res, { error: 'Internal server error' }, 500);
  }
});

server.listen(port, () => {
  console.log(`[taxonomy-server] Listening on http://localhost:${port}`);
  console.log(`[taxonomy-server] Loaded ${index.totalNodes.toLocaleString()} nodes`);
});

function loadIndex() {
  const started = Date.now();
  const manifestPath = path.join(dataDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const nodeById = [];
  const childrenByParent = new Map();
  const ids = [];
  const largeSpatialIds = [];
  const smallSpatialGrid = new Map();
  const radiusBuckets = new Map();
  const maxRadiusByLevel = [];
  const searchIndex = new TaxonomySearchIndex({ maxCacheEntries: 500 });
  let rootId = null;
  let maxId = 0;

  for (const file of manifest.files || []) {
    const filePath = path.join(dataDir, file.filename);
    console.log(`[taxonomy-server] Reading ${file.filename}`);
    const nodes = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    for (const raw of nodes) {
      const node = {
        id: raw.id,
        parent_id: raw.parent_id ?? null,
        name: String(raw.name || 'Unnamed'),
        level: Number(raw.level || 0),
        x: Number(raw.x || 0),
        y: Number(raw.y || 0),
        r: Number(raw.r || 0),
      };

      nodeById[node.id] = node;
      ids.push(node.id);
      searchIndex.add(node.id, node.name);
      maxRadiusByLevel[node.level] = Math.max(maxRadiusByLevel[node.level] || 0, node.r);
      if (node.id > maxId) maxId = node.id;

      if (node.parent_id == null) {
        rootId = node.id;
      } else {
        let children = childrenByParent.get(node.parent_id);
        if (!children) {
          children = [];
          childrenByParent.set(node.parent_id, children);
        }
        children.push(node.id);
      }

      if (node.r >= spatialCellSize) {
        largeSpatialIds.push(node.id);
      } else {
        const key = spatialKey(node.x, node.y);
        let bucket = smallSpatialGrid.get(key);
        if (!bucket) {
          bucket = [];
          smallSpatialGrid.set(key, bucket);
        }
        bucket.push(node.id);
      }

      const radiusKey = Math.floor(node.r * 10);
      let radiusBucket = radiusBuckets.get(radiusKey);
      if (!radiusBucket) {
        radiusBucket = [];
        radiusBuckets.set(radiusKey, radiusBucket);
      }
      radiusBucket.push(node.id);
    }
  }

  searchIndex.finalize();

  const leaves = new Uint32Array(maxId + 1);
  for (let i = ids.length - 1; i >= 0; i--) {
    const id = ids[i];
    const children = childrenByParent.get(id);
    if (!children || children.length === 0) {
      leaves[id] = 1;
      continue;
    }

    let sum = 0;
    for (const childId of children) sum += leaves[childId] || 1;
    leaves[id] = sum || 1;
  }

  const radiusBucketKeysDesc = Array.from(radiusBuckets.keys()).sort((a, b) => b - a);

  console.log(`[taxonomy-server] Indexed in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return {
    manifest,
    nodeById,
    childrenByParent,
    leaves,
    ids,
    largeSpatialIds,
    smallSpatialGrid,
    radiusBuckets,
    radiusBucketKeysDesc,
    maxRadiusByLevel,
    searchIndex,
    rootId,
    totalNodes: ids.length,
  };
}

function readDepth(url) {
  const rawDepth = Number(url.searchParams.get('depth') || defaultDepth);
  if (!Number.isFinite(rawDepth)) return defaultDepth;
  return Math.max(0, Math.min(maxDepth, Math.floor(rawDepth)));
}

function buildNodeResponse(id, depth) {
  const included = new Set();
  const expanded = new Set();
  const stack = [{ id, depthLeft: depth }];

  for (const ancestorId of ancestorIds(id)) included.add(ancestorId);

  while (stack.length) {
    const current = stack.pop();
    included.add(current.id);
    if (current.depthLeft <= 0) continue;

    const children = index.childrenByParent.get(current.id) || [];
    expanded.add(current.id);
    for (const childId of children) {
      included.add(childId);
      stack.push({ id: childId, depthLeft: current.depthLeft - 1 });
    }
  }

  const nodes = Array.from(included)
    .map(nodeId => serializeNode(nodeId))
    .filter(Boolean);

  const response = {
    root_id: index.rootId,
    requested_id: id,
    depth,
    path: ancestorIds(id).map(ancestorId => serializeNode(ancestorId)),
    expanded_ids: Array.from(expanded),
    nodes,
  };
  if (id === index.rootId) response.level_max_radii = index.maxRadiusByLevel;
  return response;
}

function buildViewportResponse(url) {
  const cameraX = Number(url.searchParams.get('x') || 0);
  const cameraY = Number(url.searchParams.get('y') || 0);
  const cameraK = Number(url.searchParams.get('k') || 1);
  const width = Number(url.searchParams.get('w') || 1200);
  const height = Number(url.searchParams.get('h') || 800);
  const minPxRadius = Number(url.searchParams.get('minPxRadius') || 7);
  const padPx = Number(url.searchParams.get('padPx') || 100);
  const limit = Math.max(100, Math.min(Number(url.searchParams.get('limit') || defaultViewportLimit), 50000));
  const currentId = Number(url.searchParams.get('currentId') || index.rootId);

  const safeK = Number.isFinite(cameraK) && cameraK > 0 ? cameraK : 1;
  const halfW = width / (2 * safeK);
  const halfH = height / (2 * safeK);
  const padWorld = padPx / safeK;
  const minX = cameraX - halfW - padWorld;
  const maxX = cameraX + halfW + padWorld;
  const minY = cameraY - halfH - padWorld;
  const maxY = cameraY + halfH + padWorld;
  const minWorldRadius = minPxRadius / safeK;

  const visibleIds = [];
  let candidateCount = 0;
  let truncated = false;

  const candidateIds = viewportCandidateIds(minX, maxX, minY, maxY, minWorldRadius);
  for (const id of candidateIds) {
    const node = index.nodeById[id];
    if (!node || node.r < minWorldRadius) continue;
    if (!circleIntersectsRect(node.x, node.y, node.r, minX, maxX, minY, maxY)) continue;

    candidateCount++;
    visibleIds.push(id);
    if (visibleIds.length >= limit) {
      truncated = true;
      break;
    }
  }

  const included = new Set();
  for (const id of ancestorIds(currentId || index.rootId)) included.add(id);
  for (const id of visibleIds) {
    for (const ancestorId of ancestorIds(id)) included.add(ancestorId);
    included.add(id);
  }

  return {
    root_id: index.rootId,
    requested_id: currentId || index.rootId,
    viewport: {
      x: cameraX,
      y: cameraY,
      k: safeK,
      w: width,
      h: height,
      minPxRadius,
      padPx,
      candidate_count: candidateCount,
      returned_visible_count: visibleIds.length,
      truncated,
    },
    visible_ids: visibleIds,
    nodes: Array.from(included).map(nodeId => serializeNode(nodeId)).filter(Boolean),
  };
}

function viewportCandidateIds(minX, maxX, minY, maxY, minWorldRadius) {
  if (minWorldRadius >= spatialCellSize) {
    return radiusFilteredBucketIds(minWorldRadius);
  }

  const candidates = [];

  for (const id of index.largeSpatialIds) {
    if (index.nodeById[id].r < minWorldRadius) continue;
    candidates.push(id);
  }

  const gridMinX = Math.floor((minX - spatialCellSize) / spatialCellSize);
  const gridMaxX = Math.floor((maxX + spatialCellSize) / spatialCellSize);
  const gridMinY = Math.floor((minY - spatialCellSize) / spatialCellSize);
  const gridMaxY = Math.floor((maxY + spatialCellSize) / spatialCellSize);

  for (let gx = gridMinX; gx <= gridMaxX; gx++) {
    for (let gy = gridMinY; gy <= gridMaxY; gy++) {
      const bucket = index.smallSpatialGrid.get(`${gx},${gy}`);
      if (!bucket) continue;
      for (const id of bucket) candidates.push(id);
    }
  }

  return candidates;
}

function radiusFilteredBucketIds(minWorldRadius) {
  const result = [];
  const minKey = Math.floor(minWorldRadius * 10);
  for (const key of index.radiusBucketKeysDesc) {
    if (key < minKey) break;
    const bucket = index.radiusBuckets.get(key) || [];
    for (const id of bucket) {
      if (index.nodeById[id].r >= minWorldRadius) result.push(id);
    }
  }
  return result;
}

function spatialKey(x, y) {
  return `${Math.floor(x / spatialCellSize)},${Math.floor(y / spatialCellSize)}`;
}

function circleIntersectsRect(cx, cy, r, minX, maxX, minY, maxY) {
  if (cx + r < minX || cx - r > maxX || cy + r < minY || cy - r > maxY) return false;
  const closestX = Math.max(minX, Math.min(cx, maxX));
  const closestY = Math.max(minY, Math.min(cy, maxY));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= r * r;
}

function serializeNode(id) {
  const node = index.nodeById[id];
  if (!node) return null;
  const children = index.childrenByParent.get(id);
  return {
    id: node.id,
    parent_id: node.parent_id,
    name: node.name,
    level: node.level,
    x: node.x,
    y: node.y,
    r: node.r,
    leaves: index.leaves[id] || 1,
    has_children: Boolean(children && children.length),
  };
}

function ancestorIds(id) {
  const ids = [];
  let node = index.nodeById[id];
  while (node) {
    ids.unshift(node.id);
    node = node.parent_id == null ? null : index.nodeById[node.parent_id];
  }
  return ids;
}

function findNodeByPath(pathValue) {
  const parts = decodeURIComponent(pathValue || '').split('/').filter(Boolean);
  if (!parts.length) return index.rootId;

  let currentId = index.rootId;
  const root = index.nodeById[currentId];
  let partIndex = parts[0] === root?.name ? 1 : 0;

  for (; partIndex < parts.length; partIndex++) {
    const part = parts[partIndex];
    const children = index.childrenByParent.get(currentId) || [];
    const nextId = children.find(childId => index.nodeById[childId]?.name === part);
    if (!nextId) return currentId;
    currentId = nextId;
  }

  return currentId;
}

function pickRandomLeaf(fromId) {
  let id = index.nodeById[fromId] ? fromId : index.rootId;

  // Weighted random descent by leaf counts, mirroring the client-side surprise walk.
  // targetIndex is uniform over all leaves under `id`, so every leaf is equally likely.
  let targetIndex = Math.floor(Math.random() * (index.leaves[id] || 1));
  let guard = 0;
  while (guard++ < 100000) {
    const children = index.childrenByParent.get(id);
    if (!children || children.length === 0) break;

    let chosen = children[children.length - 1];
    for (const childId of children) {
      const weight = index.leaves[childId] || 1;
      if (targetIndex < weight) {
        chosen = childId;
        break;
      }
      targetIndex -= weight;
    }
    id = chosen;
  }

  return id;
}

function searchNodes(query, limit) {
  return {
    matches: index.searchIndex.search(query, limit).map(({ id, score }) => {
      return {
        ...serializeNode(id),
        score,
        path: ancestorIds(id).map(ancestorId => index.nodeById[ancestorId].name).join(' / '),
      };
    }),
  };
}

function sendJson(res, body, status = 200, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(payload);
}

function serveStatic(pathname, res) {
  const baseDir = fs.existsSync(distDir) ? distDir : publicDir;
  const cleanPath = pathname === '/' ? '/index.html' : pathname;
  const targetPath = path.resolve(baseDir, `.${decodeURIComponent(cleanPath)}`);

  if (!targetPath.startsWith(baseDir)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  const filePath = fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()
    ? targetPath
    : path.join(baseDir, 'index.html');

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not found');
  }

  res.writeHead(200, {
    'Content-Type': contentType(filePath),
    'Cache-Control': filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=3600',
  });
  fs.createReadStream(filePath).pipe(res);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'text/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.svg': return 'image/svg+xml';
    case '.webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}
