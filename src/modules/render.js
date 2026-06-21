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
const circleFadeStates = new Map();
const labelFadeStates = new Map();
const FADE_EPSILON = 0.001;

function stepVisibility(entry, target, now, durationMs) {
  const elapsed = Math.max(0, now - entry.updatedAt);
  const step = durationMs > 0 ? elapsed / durationMs : 1;
  entry.opacity = target > entry.opacity
    ? Math.min(target, entry.opacity + step)
    : Math.max(target, entry.opacity - step);
  entry.target = target;
  entry.updatedAt = now;
  return entry.opacity;
}

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
  const fadeDurationMs = Math.max(0, Number(perf.animation.visibilityFadeMs) || 0);
  const fadesEnabled = !ctxOverride && fadeDurationMs > 0;
  const transitionNow = fadesEnabled ? performance.now() : 0;
  let hasActiveTransitions = false;

  if (fadesEnabled) {
    for (const entry of circleFadeStates.values()) entry.seen = false;
    for (const entry of labelFadeStates.values()) entry.seen = false;
  } else if (!ctxOverride) {
    circleFadeStates.clear();
    labelFadeStates.clear();
  }

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

  const drawCircle = (d, opacity) => {
    if (opacity <= FADE_EPSILON) return;

    const sr = d._vr * camK;
    const sx = viewW / 2 + (d._vx - camX) * camK;
    const sy = viewH / 2 + (d._vy - camY) * camK;

    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    setFillStyle(palette[(d.level || 0) % paletteLen]);
    setGlobalAlpha(opacity);
    ctx.fill();
    const lineWidth = Math.max(strokeLineWidthMin, Math.min(strokeLineWidthMax, strokeLineWidthBase * Math.sqrt(Math.max(sr / gridTileSize, strokeLineWidthMinRatio))));
    setLineWidth(lineWidth);
    setStrokeStyle(d.children && d.children.length ? strokeColorWithChildrenDetail : strokeColorLeafDetail);
    ctx.stroke();
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

    let circleOpacity = 1;
    if (fadesEnabled) {
      let entry = circleFadeStates.get(d._id);
      if (!entry) {
        entry = { node: d, opacity: 0, target: 1, updatedAt: transitionNow, seen: true };
        circleFadeStates.set(d._id, entry);
      } else {
        entry.node = d;
        entry.seen = true;
        circleOpacity = stepVisibility(entry, 1, transitionNow, fadeDurationMs);
      }
      circleOpacity = entry.opacity;
      if (circleOpacity < 1 - FADE_EPSILON) hasActiveTransitions = true;
    }

    drawCircle(d, circleOpacity);

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
          labelCandidates.push({ node: d, sx, sy, sr, textY, fontSize, text, rect });
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

  if (fadesEnabled) {
    for (const [id, entry] of circleFadeStates) {
      if (entry.seen) continue;

      const opacity = stepVisibility(entry, 0, transitionNow, fadeDurationMs);
      if (opacity <= FADE_EPSILON) {
        circleFadeStates.delete(id);
        continue;
      }

      hasActiveTransitions = true;
      drawCircle(entry.node, opacity);
    }
  }

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

  const placedLabels = [];

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
      if (renderAllLabels) {
        placedLabels.push(...capped);
      } else {
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

          placedLabels.push(cand);

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

  const drawLabel = (cand, opacity) => {
    if (opacity <= FADE_EPSILON) return;
    lctx.globalAlpha = labelAlpha * opacity;
    lctx.font = `${labelFontWeight} ${cand.fontSize}px ${labelFontFamily}`;
    lctx.lineWidth = Math.max(labelStrokeWidthMin, Math.min(labelStrokeWidthMax, cand.fontSize / labelFontSizeDivisor));
    lctx.strokeStyle = cand.fontSize > labelLargeFontThreshold ? labelStrokeColorLarge : labelStrokeColor;
    lctx.strokeText(cand.text, cand.sx, cand.textY);
    lctx.fillText(cand.text, cand.sx, cand.textY);
  };

  if (!fadesEnabled) {
    for (const cand of placedLabels) drawLabel(cand, 1);
    return false;
  }

  const fadingOutLabels = [];
  const currentLabels = [];

  for (const cand of placedLabels) {
    const id = cand.node._id;
    let entry = labelFadeStates.get(id);
    if (!entry) {
      entry = { candidate: cand, opacity: 0, target: 1, updatedAt: transitionNow, seen: true };
      labelFadeStates.set(id, entry);
    } else {
      entry.candidate = cand;
      entry.seen = true;
      stepVisibility(entry, 1, transitionNow, fadeDurationMs);
    }

    if (entry.opacity < 1 - FADE_EPSILON) hasActiveTransitions = true;
    currentLabels.push({ candidate: cand, opacity: entry.opacity });
  }

  for (const [id, entry] of labelFadeStates) {
    if (entry.seen) continue;

    const opacity = stepVisibility(entry, 0, transitionNow, fadeDurationMs);
    if (opacity <= FADE_EPSILON) {
      labelFadeStates.delete(id);
      continue;
    }

    const cand = entry.candidate;
    const d = cand.node;
    const sr = d._vr * camK;
    const availableSpace = (d._labelTopSpaceWorld ?? (d._vr * 2)) * camK;
    const projected = {
      ...cand,
      sx: viewW / 2 + (d._vx - camX) * camK,
      sy: viewH / 2 + (d._vy - camY) * camK,
      sr,
      fontSize: Math.min(labelFontSizeMax, Math.max(labelFontSizeMin, sr / labelFontSizeDivisor)),
      textY: viewH / 2 + (d._vy - camY) * camK - sr + availableSpace / 2
    };
    entry.candidate = projected;
    fadingOutLabels.push({ candidate: projected, opacity });
    hasActiveTransitions = true;
  }

  // Departing labels go first so newly appearing labels remain legible on top.
  for (const item of fadingOutLabels) drawLabel(item.candidate, item.opacity);
  for (const item of currentLabels) drawLabel(item.candidate, item.opacity);

  lctx.globalAlpha = 1;
  return hasActiveTransitions;
}


