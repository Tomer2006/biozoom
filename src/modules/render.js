/**
 * Main rendering engine module
 *
 * Handles the core visualization rendering using HTML5 Canvas 2D API.
 * Implements level-of-detail rendering, text measurement caching, viewport
 * culling, and optimized batch rendering for smooth performance with
 * millions of taxonomy nodes.
 */

import { getContext, W, H } from './canvas.js';
import { state } from './state.js';
import { getNodeColor } from './constants.js';
import { perf } from './settings.js';

// Optimized text measurement cache with size limits and hit tracking
const measureCache = new Map();
const MAX_CACHE_SIZE = perf.memory.maxTextCacheSize;
const CACHE_CLEANUP_THRESHOLD = perf.memory.cacheCleanupThreshold;
let cacheAccessOrder = []; // Track access order for LRU-like behavior
const labelCandidates = [];

// Memory management: progressive cleanup
let lastMemoryCheck = 0;
const MEMORY_CHECK_INTERVAL = perf.memory.gcHintInterval;

function performMemoryCleanup() {
  const now = performance.now();
  if (now - lastMemoryCheck > MEMORY_CHECK_INTERVAL) {
    lastMemoryCheck = now;

    // Suggest garbage collection if available
    if (window.gc && typeof window.gc === 'function') {
      window.gc();
    }

    // Cleanup text cache if needed
    if (measureCache.size > CACHE_CLEANUP_THRESHOLD) {
      const cleanupSize = Math.min(perf.memory.progressiveCleanupBatch,
        measureCache.size - CACHE_CLEANUP_THRESHOLD);
      for (let i = 0; i < cleanupSize && cacheAccessOrder.length > 0; i++) {
        const lruKey = cacheAccessOrder.shift();
        measureCache.delete(lruKey);
      }
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

export function drawWithOptions(options = {}) {
  const {
    ctx: ctxOverride,
    width,
    height,
    camera,
    renderingOverrides = {},
    disableCulling = false,
    renderAllLabels = false,
    useTransformScaling = false  // Use canvas transform scaling for text (screenshot mode)
  } = options;

  const ctx = ctxOverride || getContext();
  if (!ctx || !state.layout) {
    return;
  }

  const viewW = typeof width === 'number' ? width : W;
  const viewH = typeof height === 'number' ? height : H;

  // Destructure performance settings once at the top
  const { k: camK, x: camX, y: camY } = camera || state.camera;

  const rendering = { ...perf.rendering, ...renderingOverrides };

  const {
    lodDetailThreshold,
    lodMediumThreshold,
    lodSimpleThreshold,
    lodSkipThreshold,
    minPxRadius,
    labelMinPxRadius,
    maxNodesPerFrame,
    verticalPadPx,
    gridTileSize,
    strokeColorWithChildren,
    strokeColorLeaf,
    strokeMinPxRadius,
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

  // Periodic memory cleanup
  performMemoryCleanup();

  // Clear once per frame
  ctx.clearRect(0, 0, viewW, viewH);

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
      const nodeLevel = d.data.level || 0;
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

    const [sx, sy] = [
      viewW / 2 + (d._vx - camX) * camK,
      viewH / 2 + (d._vy - camY) * camK
    ];

    // Render circle with full detail
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    setFillStyle(getNodeColor(d.data));
    setGlobalAlpha(1);
    ctx.fill();
    const lineWidth = Math.max(strokeLineWidthMin, Math.min(strokeLineWidthMax, strokeLineWidthBase * Math.sqrt(Math.max(sr / gridTileSize, strokeLineWidthMinRatio))));
    setLineWidth(lineWidth);
    setStrokeStyle(d.children && d.children.length ? strokeColorWithChildrenDetail : strokeColorLeafDetail);
    ctx.stroke();

    drawn++;
    if (drawn >= maxNodes) return;

    if (sr > labelMinPxRadius) {
      const text = d.data.name;
      let fontSize, textWidth, textHeight, pad, textScale, baseFontSize;
      let shouldRenderLabel = false;
      
      if (useTransformScaling) {
        // Screenshot mode: Use fixed base font size and scale with canvas transform
        baseFontSize = 14; // Fixed base font size in pixels
        textScale = sr / (baseFontSize * labelFontSizeDivisor); // Scale 1:1 with circle size
        fontSize = baseFontSize * textScale;
        
        if (fontSize >= labelMinFontPx) {
          shouldRenderLabel = true;
          const key = baseFontSize + '|' + text;
          let metrics = measureCache.get(key);

          // Track cache access for LRU behavior
          if (metrics) {
            // Move to end of access order (most recently used)
            const index = cacheAccessOrder.indexOf(key);
            if (index > -1) {
              cacheAccessOrder.splice(index, 1);
            }
            cacheAccessOrder.push(key);
          } else {
            // Cache miss - measure and store at base font size
            ctx.font = `${labelFontWeight} ${baseFontSize}px ${labelFontFamily}`;
            metrics = { width: ctx.measureText(text).width };

            // Cache management
            if (measureCache.size >= MAX_CACHE_SIZE) {
              // Remove least recently used items
              while (measureCache.size >= CACHE_CLEANUP_THRESHOLD && cacheAccessOrder.length > 0) {
                const lruKey = cacheAccessOrder.shift();
                measureCache.delete(lruKey);
              }
            }

            measureCache.set(key, metrics);
            cacheAccessOrder.push(key);
          }
          // Scale the measured width and height by the transform scale
          textWidth = metrics.width * textScale;
          textHeight = fontSize;
          pad = 2 * textScale;
        }
      } else {
        // Regular rendering: Use font size directly (round to integer for crisp rendering)
        fontSize = Math.round(Math.min(labelFontSizeMax, Math.max(labelFontSizeMin, sr / labelFontSizeDivisor)));
        
        if (fontSize >= labelMinFontPx) {
          shouldRenderLabel = true;
          const key = fontSize + '|' + text;
          let metrics = measureCache.get(key);

          // Track cache access for LRU behavior
          if (metrics) {
            // Move to end of access order (most recently used)
            const index = cacheAccessOrder.indexOf(key);
            if (index > -1) {
              cacheAccessOrder.splice(index, 1);
            }
            cacheAccessOrder.push(key);
          } else {
            // Cache miss - measure and store
            ctx.font = `${labelFontWeight} ${fontSize}px ${labelFontFamily}`;
            metrics = { width: ctx.measureText(text).width };

            // Cache management
            if (measureCache.size >= MAX_CACHE_SIZE) {
              // Remove least recently used items
              while (measureCache.size >= CACHE_CLEANUP_THRESHOLD && cacheAccessOrder.length > 0) {
                const lruKey = cacheAccessOrder.shift();
                measureCache.delete(lruKey);
              }
            }

            measureCache.set(key, metrics);
            cacheAccessOrder.push(key);
          }
          textWidth = metrics.width;
          textHeight = fontSize;
          pad = 2;
        }
      }
      
      if (shouldRenderLabel) {
        // Calculate available space at top of circle
        // Find the highest child (closest to top edge)
        const ch = d.children || [];
        let availableSpace = sr * 2; // default: full diameter if no children
        
        if (ch.length > 0) {
          // Find the child whose top edge is closest to parent's top
          const parentTop = d._vy - d._vr;
          let highestChildTop = d._vy + d._vr; // start at bottom
          
          for (const child of ch) {
            const childTop = child._vy - child._vr;
            if (childTop < highestChildTop) {
              highestChildTop = childTop;
            }
          }
          
          // Available space is from parent top to highest child top (in screen pixels)
          availableSpace = (highestChildTop - parentTop) * camK;
        }
        
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
          if (useTransformScaling) {
            labelCandidates.push({ sx, sy, sr, textY, textScale, baseFontSize, fontSize, text, rect });
          } else {
            labelCandidates.push({ sx, sy, sr, textY, fontSize, text, rect });
          }
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
      if (renderAllLabels) {
        for (const cand of capped) {
          ctx.save();
          if (useTransformScaling && cand.textScale) {
            // Screenshot mode: Use canvas transform for scaling
            ctx.translate(cand.sx, cand.textY);
            ctx.scale(cand.textScale, cand.textScale);
            ctx.font = `${labelFontWeight} ${cand.baseFontSize}px ${labelFontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const scaledFontSize = cand.baseFontSize * cand.textScale;
            ctx.lineWidth = Math.max(labelStrokeWidthMin, Math.min(labelStrokeWidthMax, scaledFontSize / labelFontSizeDivisor)) / cand.textScale;
            ctx.strokeStyle = scaledFontSize > labelLargeFontThreshold ? labelStrokeColorLarge : labelStrokeColor;
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.strokeText(cand.text, 0, 0);
            ctx.fillStyle = labelFillColor;
            ctx.globalAlpha = labelAlpha;
            ctx.fillText(cand.text, 0, 0);
          } else {
            // Regular rendering: Use font size directly
            // Round coordinates to integer pixels for crisp rendering
            const textX = Math.round(cand.sx);
            const textY = Math.round(cand.textY);
            // Ensure crisp text rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.font = `${labelFontWeight} ${cand.fontSize}px ${labelFontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = Math.max(labelStrokeWidthMin, Math.min(labelStrokeWidthMax, cand.fontSize / labelFontSizeDivisor));
            ctx.strokeStyle = cand.fontSize > labelLargeFontThreshold ? labelStrokeColorLarge : labelStrokeColor;
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.strokeText(cand.text, textX, textY);
            ctx.fillStyle = labelFillColor;
            ctx.globalAlpha = labelAlpha;
            ctx.fillText(cand.text, textX, textY);
          }
          ctx.restore();
        }
        return;
      }
      const placed = [];
      const grid = new Map();
      const cell = labelGridCellPx;

      // Pre-compute cell keys to avoid repeated calculations
      const cellsForRect = r => {
        const cells = [];
        const x1 = Math.floor(r.x1 / cell);
        const y1 = Math.floor(r.y1 / cell);
        const x2 = Math.floor(r.x2 / cell);
        const y2 = Math.floor(r.y2 / cell);
        for (let gx = x1; gx <= x2; gx++) {
          for (let gy = y1; gy <= y2; gy++) {
            cells.push(`${gx},${gy}`);
          }
        }
        return cells;
      };

      const overlaps = (a, b) => !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);

      // Early rejection: check against larger placed labels first
      for (const cand of capped) {
        const nearbyKeys = cellsForRect(cand.rect);
        let hit = false;

        // Check collision with existing labels
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

        // Render label at top of circle
        ctx.save();
        if (useTransformScaling && cand.textScale) {
          // Screenshot mode: Use canvas transform for scaling
          ctx.translate(cand.sx, cand.textY);
          ctx.scale(cand.textScale, cand.textScale);
          ctx.font = `${labelFontWeight} ${cand.baseFontSize}px ${labelFontFamily}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const scaledFontSize = cand.baseFontSize * cand.textScale;
          ctx.lineWidth = Math.max(labelStrokeWidthMin, Math.min(labelStrokeWidthMax, scaledFontSize / labelFontSizeDivisor)) / cand.textScale;
          ctx.strokeStyle = scaledFontSize > labelLargeFontThreshold ? labelStrokeColorLarge : labelStrokeColor;
          ctx.lineJoin = 'round';
          ctx.miterLimit = 2;
          ctx.strokeText(cand.text, 0, 0);
          ctx.fillStyle = labelFillColor;
          ctx.globalAlpha = labelAlpha;
          ctx.fillText(cand.text, 0, 0);
        } else {
          // Regular rendering: Use font size directly
          // Round coordinates to integer pixels for crisp rendering
          const textX = Math.round(cand.sx);
          const textY = Math.round(cand.textY);
          // Ensure crisp text rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.font = `${labelFontWeight} ${cand.fontSize}px ${labelFontFamily}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = Math.max(labelStrokeWidthMin, Math.min(labelStrokeWidthMax, cand.fontSize / labelFontSizeDivisor));
          ctx.strokeStyle = cand.fontSize > labelLargeFontThreshold ? labelStrokeColorLarge : labelStrokeColor;
          ctx.lineJoin = 'round';
          ctx.miterLimit = 2;
          ctx.strokeText(cand.text, textX, textY);
          ctx.fillStyle = labelFillColor;
          ctx.globalAlpha = labelAlpha;
          ctx.fillText(cand.text, textX, textY);
        }
        ctx.restore();

        // Update spatial index
        placed.push(cand.rect);
        for (const k of nearbyKeys) {
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(cand.rect);
        }
      }
    }
  }
}


