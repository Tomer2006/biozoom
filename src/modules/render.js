/**
 * Main rendering engine module
 *
 * Handles the core visualization rendering using HTML5 Canvas 2D API.
 * Implements level-of-detail rendering, text measurement caching, viewport
 * culling, and optimized batch rendering for smooth performance with
 * millions of taxonomy nodes.
 */

import { getContext, getCircleBuffer, W, H } from './canvas.js';
import { state } from './state.js';
import { perf } from './settings.js';

// Optimized text measurement cache with size limits and hit tracking
const measureCache = new Map();
const MAX_CACHE_SIZE = perf.memory.maxTextCacheSize;
const CACHE_CLEANUP_THRESHOLD = perf.memory.cacheCleanupThreshold;
const labelCandidates = [];

function touchMeasureCacheEntry(key, metrics) {
  // Refresh insertion order so the oldest entry remains the least recently used.
  measureCache.delete(key);
  measureCache.set(key, metrics);
}

function evictMeasureCacheEntries(targetSize) {
  while (measureCache.size > targetSize) {
    const oldestKey = measureCache.keys().next().value;
    if (oldestKey === undefined) break;
    measureCache.delete(oldestKey);
  }
}

function getCachedTextMetrics(ctx, key, text, font) {
  const cached = measureCache.get(key);
  if (cached) {
    touchMeasureCacheEntry(key, cached);
    return cached;
  }

  ctx.font = font;
  const metrics = { width: ctx.measureText(text).width };

  if (measureCache.size >= MAX_CACHE_SIZE) {
    evictMeasureCacheEntries(CACHE_CLEANUP_THRESHOLD - 1);
  }

  measureCache.set(key, metrics);
  return metrics;
}

// Memory management: progressive cleanup
let lastMemoryCheck = 0;
const MEMORY_CHECK_INTERVAL = perf.memory.gcHintInterval;

function performMemoryCleanup() {
  const now = performance.now();
  if (now - lastMemoryCheck > MEMORY_CHECK_INTERVAL) {
    lastMemoryCheck = now;

    // Cleanup text cache if needed
    if (measureCache.size > CACHE_CLEANUP_THRESHOLD) {
      const cleanupSize = Math.min(perf.memory.progressiveCleanupBatch,
        measureCache.size - CACHE_CLEANUP_THRESHOLD);
      evictMeasureCacheEntries(measureCache.size - cleanupSize);
    }
  }
}

// Cached grid pattern for the background
let gridPattern = null;
let cachedGridSettings = null;
function getGridPattern(ctx) {
  // Check if grid settings changed - if so, regenerate pattern
  const p = perf.rendering;
  if (gridPattern && cachedGridSettings &&
    cachedGridSettings.tileSize === p.gridTileSize &&
    cachedGridSettings.color === p.gridColor &&
    cachedGridSettings.alpha === p.gridAlpha &&
    cachedGridSettings.lineWidth === p.gridLineWidth) {
    return gridPattern;
  }

  // Regenerate grid pattern with current settings
  const tileSize = perf.rendering.gridTileSize;
  const tile = document.createElement('canvas');
  tile.width = tileSize;
  tile.height = tileSize;
  const tctx = tile.getContext('2d');
  tctx.strokeStyle = perf.rendering.gridColor;
  tctx.globalAlpha = perf.rendering.gridAlpha;
  tctx.lineWidth = perf.rendering.gridLineWidth;
  tctx.beginPath();
  // vertical line at x=0
  tctx.moveTo(0, 0);
  tctx.lineTo(0, tileSize);
  // horizontal line at y=0
  tctx.moveTo(0, 0);
  tctx.lineTo(tileSize, 0);
  tctx.stroke();
  gridPattern = ctx.createPattern(tile, 'repeat');
  cachedGridSettings = {
    tileSize: perf.rendering.gridTileSize,
    color: perf.rendering.gridColor,
    alpha: perf.rendering.gridAlpha,
    lineWidth: perf.rendering.gridLineWidth
  };
  return gridPattern;
}

export function draw(options = {}) {
  return drawWithOptions(options);
}

function drawWithOptions(options = {}) {
  const {
    ctx: ctxOverride,
    width,
    height,
    camera,
    renderingOverrides = {},
    disableCulling = false,
    renderAllLabels = false
  } = options;

  const mainCtx = ctxOverride || getContext();
  if (!mainCtx || !state.layout) {
    return;
  }

  // Circles are flat fills that barely benefit from extra resolution, so draw
  // them into a cheaper low-DPR buffer and upscale, reserving the full-res main
  // canvas for crisp text. Offscreen renders (ctxOverride) use a single ctx.
  const circleBuffer = ctxOverride ? null : getCircleBuffer();
  const ctx = circleBuffer ? circleBuffer.ctx : mainCtx;  // circle-drawing target
  const lctx = mainCtx;                                    // label-drawing target

  const viewW = typeof width === 'number' ? width : W;
  const viewH = typeof height === 'number' ? height : H;

  // Destructure performance settings once at the top
  const { k: camK, x: camX, y: camY } = camera || state.camera;

  // Avoid a per-frame object spread on the common path (no overrides).
  const hasRenderingOverrides = renderingOverrides && Object.keys(renderingOverrides).length > 0;
  const rendering = hasRenderingOverrides ? { ...perf.rendering, ...renderingOverrides } : perf.rendering;

  const {
    minPxRadius,
    nodeFadePx,
    labelMinPxRadius,
    maxNodesPerFrame,
    verticalPadPx,
    gridTileSize,
    strokeColorWithChildren,
    strokeColorLeaf,
    strokeLineWidthMin,
    strokeLineWidthMax,
    strokeLineWidthBase,
    strokeLineWidthMinRatio,
    strokeColorWithChildrenDetail,
    strokeColorLeafDetail,
    labelFontSizeMax,
    labelFontSizeMin,
    labelFontSizeDivisor,
    labelMinFontPx,
    labelFadeFontPx,
    labelFontWeight,
    labelFontFamily,
    maxLabels,
    labelGridCellPx,
    labelStrokeWidthMin,
    labelStrokeWidthMax,
    labelLargeFontThreshold,
    labelStrokeColorLarge,
    labelStrokeColor,
    labelFillColor,
    labelAlpha,
    showGrid,
    depthRenderEnabled,
    depthRenderBase,
    depthRenderFalloff
  } = rendering;

  // Calculate current node's level for depth-based rendering
  const currentLevel = state.current ? (state.current.level || 0) : 0;

  // Node colors: read the palette once per frame (cheap and preset-safe).
  const palette = perf.colors.palette;
  const paletteLen = palette.length;

  // Collect the nodes actually drawn this frame so picking can scan only the
  // visible set instead of the whole tree. Only for the main on-screen render.
  const collectPickList = !ctxOverride;
  const visibleNodes = collectPickList ? [] : null;

  // Periodic memory cleanup
  performMemoryCleanup();

  // Clear once per frame
  ctx.clearRect(0, 0, viewW, viewH);
  // Ensure a known alpha at the start of every frame (labels may leave it changed).
  ctx.globalAlpha = 1;

  // Batch rendering operations to minimize state changes
  let currentFillStyle = null;
  let currentStrokeStyle = null;
  let currentLineWidth = null;
  let currentGlobalAlpha = 1;

  // Optimized canvas state management
  const setFillStyle = (style) => {
    if (currentFillStyle !== style) {
      ctx.fillStyle = style;
      currentFillStyle = style;
    }
  };

  const setStrokeStyle = (style) => {
    if (currentStrokeStyle !== style) {
      ctx.strokeStyle = style;
      currentStrokeStyle = style;
    }
  };

  const setLineWidth = (width) => {
    if (currentLineWidth !== width) {
      ctx.lineWidth = width;
      currentLineWidth = width;
    }
  };

  const setGlobalAlpha = (alpha) => {
    if (currentGlobalAlpha !== alpha) {
      ctx.globalAlpha = alpha;
      currentGlobalAlpha = alpha;
    }
  };

  // Grid via cached pattern fill (toggleable) - optimized
  if (showGrid) {
    ctx.save();
    const pat = getGridPattern(ctx);
    const offX = Math.floor((viewW / 2 - camX * camK) % gridTileSize);
    const offY = Math.floor((viewH / 2 - camY * camK) % gridTileSize);
    ctx.translate(offX, offY);
    ctx.fillStyle = pat;
    ctx.fillRect(-offX, -offY, viewW + gridTileSize, viewH + gridTileSize);
    ctx.restore();
  }

  labelCandidates.length = 0;

  let drawn = 0;
  const maxNodes = maxNodesPerFrame || Infinity;

  // Pre-compute viewport bounds for efficient culling
  const padWorld = verticalPadPx / camK;
  const halfW = viewW / (2 * camK);
  const halfH = viewH / (2 * camK);
  const minX = camX - halfW - padWorld;
  const maxX = camX + halfW + padWorld;
  const minY = camY - halfH - padWorld;
  const maxY = camY + halfH + padWorld;

  // Optimized viewport culling using pre-computed bounds
  const isInViewport = (cx, cy, r) => {
    // Fast AABB (Axis-Aligned Bounding Box) check first
    const left = cx - r;
    const right = cx + r;
    const top = cy - r;
    const bottom = cy + r;

    // Check if circle's AABB intersects viewport AABB
    if (right < minX || left > maxX || bottom < minY || top > maxY) {
      return false;
    }

    // More precise check: check if circle intersects viewport rectangle
    const closestX = Math.max(minX, Math.min(cx, maxX));
    const closestY = Math.max(minY, Math.min(cy, maxY));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy <= r * r;
  };

  function visit(d) {
    if (drawn >= maxNodes) return;
    
    // Optimized viewport culling
    if (!disableCulling && !isInViewport(d._vx, d._vy, d._vr)) return;
    const sr = d._vr * camK;
    // If this node is too small on screen, its children are even smaller (packed layout) → prune subtree
    if (sr < minPxRadius) return;
    
    // Depth-based render distance culling
    if (depthRenderEnabled) {
      const nodeLevel = d.level || 0;
      const depthFromCurrent = nodeLevel - currentLevel;
      if (depthFromCurrent > 0) {
        // Calculate max render distance for this depth
        const maxRenderDistance = depthRenderBase * Math.pow(depthRenderFalloff, depthFromCurrent);
        // Skip if screen radius is too small for this depth level
        if (sr < minPxRadius * (1 + depthFromCurrent * 0.5) && depthFromCurrent > maxRenderDistance) {
          return;
        }
      }
    }

    const sx = viewW / 2 + (d._vx - camX) * camK;
    const sy = viewH / 2 + (d._vy - camY) * camK;

    // Fade nodes in across a small band above the cull threshold so newly
    // revealed detail eases in instead of popping as you zoom.
    const nodeAlpha = nodeFadePx > 0
      ? Math.min(1, (sr - minPxRadius) / nodeFadePx)
      : 1;

    // Render circle with full detail
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    setFillStyle(palette[(d.level || 0) % paletteLen]);
    setGlobalAlpha(nodeAlpha);
    ctx.fill();
    const lineWidth = Math.max(strokeLineWidthMin, Math.min(strokeLineWidthMax, strokeLineWidthBase * Math.sqrt(Math.max(sr / gridTileSize, strokeLineWidthMinRatio))));
    setLineWidth(lineWidth);
    setStrokeStyle(d.children && d.children.length ? strokeColorWithChildrenDetail : strokeColorLeafDetail);
    ctx.stroke();

    drawn++;
    if (visibleNodes) visibleNodes.push(d);
    if (drawn >= maxNodes) return;

    if (sr > labelMinPxRadius) {
      const text = d.name;
      const fontSize = Math.min(labelFontSizeMax, Math.max(labelFontSizeMin, sr / labelFontSizeDivisor));
      let textWidth, textHeight, pad;
      let shouldRenderLabel = false;

      if (fontSize >= labelMinFontPx) {
        shouldRenderLabel = true;
        const key = fontSize + '|' + text;
        const metrics = getCachedTextMetrics(
          ctx,
          key,
          text,
          `${labelFontWeight} ${fontSize}px ${labelFontFamily}`
        );
        textWidth = metrics.width;
        textHeight = fontSize;
        pad = 2;
      }
      
      if (shouldRenderLabel) {
        const availableSpace = (d._labelTopSpaceWorld ?? (d._vr * 2)) * camK;

        // Only show label if there's enough space for text (need text height + padding)
        const requiredSpace = textHeight + 4;
        if (availableSpace >= requiredSpace) {
          // Position text center in the middle of available space
          const textCenterOffset = availableSpace / 2;
          const textY = sy - sr + textCenterOffset;
          const rect = {
            x1: sx - textWidth / 2 - pad,
            y1: textY - textHeight / 2 - pad,
            x2: sx + textWidth / 2 + pad,
            y2: textY + textHeight / 2 + pad
          };
          // Fade labels in across a small band above the font-size gate.
          const labelFade = labelFadeFontPx > 0
            ? Math.min(1, (fontSize - labelMinFontPx) / labelFadeFontPx)
            : 1;
          labelCandidates.push({ sx, sy, sr, textY, fontSize, text, rect, alpha: labelAlpha * labelFade });
        }
      }
    }

    const ch = d.children || [];
    for (let i = 0; i < ch.length; i++) {
      if (drawn >= maxNodes) break;
      visit(ch[i]);
    }
  }

  // Determine which node to start rendering from
  // If there's a current node, start from its layout node; otherwise, start from root
  const startNode = state.current
    ? state.nodeLayoutMap.get(state.current._id) || state.layout.root
    : state.layout.root;

  visit(startNode);

  // Publish the drawn set for picking (deepest/last-drawn is topmost).
  if (collectPickList) state.visibleNodes = visibleNodes;

  // Composite the low-res circle layer onto the full-resolution main canvas.
  // The opaque blit also overwrites last frame's labels, so no separate clear.
  if (circleBuffer) {
    lctx.globalAlpha = 1;
    lctx.imageSmoothingEnabled = true;
    lctx.imageSmoothingQuality = 'high';
    lctx.drawImage(circleBuffer.canvas, 0, 0, viewW, viewH);
  }

  // Optimized label placement with early rejection and reduced computation
  if (labelCandidates.length) {
    // Sort by size (largest first) and apply stricter limits based on zoom level
    labelCandidates.sort((a, b) => b.fontSize - a.fontSize);

    // Dynamic label limit based on zoom level - fewer labels when zoomed out
    const zoomFactor = Math.max(0.1, Math.min(1, camK));
    const dynamicMaxLabels = Number.isFinite(maxLabels)
      ? Math.floor(maxLabels * zoomFactor)
      : Infinity;
    const capped = labelCandidates.slice(0, Math.min(dynamicMaxLabels, labelCandidates.length));

    if (capped.length > 0) {
      // Invariant text-rendering state — set once for every label this frame.
      lctx.imageSmoothingEnabled = true;
      lctx.imageSmoothingQuality = 'high';
      lctx.textAlign = 'center';
      lctx.textBaseline = 'middle';
      lctx.lineJoin = 'round';
      lctx.miterLimit = 2;
      lctx.fillStyle = labelFillColor;

      const drawLabel = (cand) => {
        lctx.globalAlpha = cand.alpha;
        lctx.font = `${labelFontWeight} ${cand.fontSize}px ${labelFontFamily}`;
        lctx.lineWidth = Math.max(labelStrokeWidthMin, Math.min(labelStrokeWidthMax, cand.fontSize / labelFontSizeDivisor));
        lctx.strokeStyle = cand.fontSize > labelLargeFontThreshold ? labelStrokeColorLarge : labelStrokeColor;
        lctx.strokeText(cand.text, cand.sx, cand.textY);
        lctx.fillText(cand.text, cand.sx, cand.textY);
      };

      if (renderAllLabels) {
        for (const cand of capped) drawLabel(cand);
        return;
      }

      const grid = new Map();
      const cell = labelGridCellPx;

      // Pre-compute integer cell keys to avoid per-label string allocation.
      const cellsForRect = r => {
        const cells = [];
        const x1 = Math.floor(r.x1 / cell);
        const y1 = Math.floor(r.y1 / cell);
        const x2 = Math.floor(r.x2 / cell);
        const y2 = Math.floor(r.y2 / cell);
        for (let gx = x1; gx <= x2; gx++) {
          for (let gy = y1; gy <= y2; gy++) {
            cells.push(gx * 1000003 + gy);
          }
        }
        return cells;
      };

      const overlaps = (a, b) => !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);

      // Early rejection: check against already-placed labels via the spatial grid.
      for (const cand of capped) {
        const nearbyKeys = cellsForRect(cand.rect);
        let hit = false;

        for (const k of nearbyKeys) {
          const arr = grid.get(k);
          if (!arr) continue;
          for (const r of arr) {
            if (overlaps(cand.rect, r)) {
              hit = true;
              break;
            }
          }
          if (hit) break;
        }

        if (hit) continue;

        drawLabel(cand);

        // Update spatial index
        for (const k of nearbyKeys) {
          let arr = grid.get(k);
          if (!arr) {
            arr = [];
            grid.set(k, arr);
          }
          arr.push(cand.rect);
        }
      }
    }
  }
}


