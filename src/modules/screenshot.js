import { state } from './state.js';
import { drawWithOptions } from './render.js';
import JSZip from 'jszip';

const PADDING_RATIO = 0.06;
// Default scale factor: pixels per world unit. Higher = more detail but larger file size
// This ensures even small nodes are rendered at a reasonable size
const DEFAULT_PIXELS_PER_WORLD_UNIT = 1000;
// Tile size for progressive rendering - render in chunks to avoid memory issues
const TILE_SIZE = 2048;

function getRenderRoot() {
  if (state.current && state.nodeLayoutMap.has(state.current._id)) {
    return state.nodeLayoutMap.get(state.current._id);
  }
  return state.layout?.root || null;
}

function computeBounds(nodes) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const r = node._vr || 0;
    const x1 = node._vx - r;
    const x2 = node._vx + r;
    const y1 = node._vy - r;
    const y2 = node._vy + r;

    if (x1 < minX) minX = x1;
    if (x2 > maxX) maxX = x2;
    if (y1 < minY) minY = y1;
    if (y2 > maxY) maxY = y2;
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  return { minX, minY, maxX, maxY, width, height };
}

async function ensureFontsReady() {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (_e) {
      // Ignore font readiness issues and proceed with system fallbacks.
    }
  }
}

/**
 * Create a screenshot split into multiple chunks and zip them
 */
async function createSplitScreenshot(fullWidth, fullHeight, maxDimension, worldBounds, scale, onProgress) {
  // Calculate number of chunks needed
  const chunksX = Math.ceil(fullWidth / maxDimension);
  const chunksY = Math.ceil(fullHeight / maxDimension);
  const totalChunks = chunksX * chunksY;
  let completedChunks = 0;

  const zip = new JSZip();
  const timestamp = Date.now();

  // Render each chunk
  for (let cy = 0; cy < chunksY; cy++) {
    for (let cx = 0; cx < chunksX; cx++) {
      const chunkX = cx * maxDimension;
      const chunkY = cy * maxDimension;
      const chunkWidth = Math.min(maxDimension, fullWidth - chunkX);
      const chunkHeight = Math.min(maxDimension, fullHeight - chunkY);

      // Create canvas for this chunk
      const chunkCanvas = document.createElement('canvas');
      chunkCanvas.width = chunkWidth;
      chunkCanvas.height = chunkHeight;
      const chunkCtx = chunkCanvas.getContext('2d', { alpha: false });
      if (!chunkCtx) {
        throw new Error('Unable to create chunk canvas context');
      }

      // Fill with white background
      chunkCtx.fillStyle = '#ffffff';
      chunkCtx.fillRect(0, 0, chunkWidth, chunkHeight);

      // Calculate world bounds for this chunk
      const chunkWorldX = worldBounds.minX + (chunkX / scale);
      const chunkWorldY = worldBounds.minY + (chunkY / scale);
      const chunkWorldW = chunkWidth / scale;
      const chunkWorldH = chunkHeight / scale;

      const chunkWorldBounds = {
        minX: chunkWorldX,
        minY: chunkWorldY,
        maxX: chunkWorldX + chunkWorldW,
        maxY: chunkWorldY + chunkWorldH,
        width: chunkWorldW,
        height: chunkWorldH
      };

      // Render this chunk using tiles
      const tilesX = Math.ceil(chunkWidth / TILE_SIZE);
      const tilesY = Math.ceil(chunkHeight / TILE_SIZE);
      let chunkTilesCompleted = 0;
      const chunkTotalTiles = tilesX * tilesY;

      for (let ty = 0; ty < tilesY; ty++) {
        for (let tx = 0; tx < tilesX; tx++) {
          const tileX = tx * TILE_SIZE;
          const tileY = ty * TILE_SIZE;
          const tileWidth = Math.min(TILE_SIZE, chunkWidth - tileX);
          const tileHeight = Math.min(TILE_SIZE, chunkHeight - tileY);

          const tileCanvas = await renderTile(
            chunkX + tileX,
            chunkY + tileY,
            tileWidth,
            tileHeight,
            worldBounds,
            scale,
            () => {
              chunkTilesCompleted++;
              // Update progress after each tile
              if (onProgress) {
                const chunkProgress = chunkTilesCompleted / chunkTotalTiles;
                const overallProgress = (completedChunks + chunkProgress) / totalChunks;
                onProgress(
                  Math.floor(overallProgress * totalChunks),
                  totalChunks,
                  Math.round(overallProgress * 100)
                );
              }
            }
          );

          // Copy tile to chunk canvas
          chunkCtx.drawImage(tileCanvas, tileX, tileY);

          // Clean up
          tileCanvas.width = 0;
          tileCanvas.height = 0;
        }
      }

      // Mark chunk as completed
      completedChunks++;
      if (onProgress) {
        onProgress(completedChunks, totalChunks, Math.round((completedChunks / totalChunks) * 100));
      }

      // Convert chunk to blob and add to zip
      const chunkBlob = await new Promise((resolve, reject) => {
        chunkCanvas.toBlob((result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error('Failed to create chunk blob'));
          }
        }, 'image/webp', 0.95);
      });

      const chunkFileName = `infinitespecies-${timestamp}-part-${cy + 1}-${cx + 1}.webp`;
      zip.file(chunkFileName, chunkBlob);

      // Clean up chunk canvas
      chunkCanvas.width = 0;
      chunkCanvas.height = 0;

      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  // Generate zip file
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipFileName = `infinitespecies-${timestamp}.zip`;

  // Download zip file
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = zipFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);

  return { fileName: zipFileName, width: fullWidth, height: fullHeight, chunks: totalChunks };
}

/**
 * Render a single tile of the screenshot
 */
async function renderTile(tileX, tileY, tileWidth, tileHeight, worldBounds, scale, onProgress) {
  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = tileWidth;
  tileCanvas.height = tileHeight;
  const tileCtx = tileCanvas.getContext('2d', { alpha: false });
  if (!tileCtx) {
    throw new Error('Unable to create tile canvas context');
  }

  // Calculate world coordinates for this tile
  const worldMinX = worldBounds.minX + (tileX / scale);
  const worldMaxX = worldBounds.minX + ((tileX + tileWidth) / scale);
  const worldMinY = worldBounds.minY + (tileY / scale);
  const worldMaxY = worldBounds.minY + ((tileY + tileHeight) / scale);
  
  const worldCenterX = (worldMinX + worldMaxX) / 2;
  const worldCenterY = (worldMinY + worldMaxY) / 2;

  // Camera for this tile - centered on tile's world position
  const camera = {
    x: worldCenterX,
    y: worldCenterY,
    k: scale,
  };

  // Render this tile
  drawWithOptions({
    ctx: tileCtx,
    width: tileWidth,
    height: tileHeight,
    camera,
    disableCulling: true,
    renderAllLabels: false, // Use collision detection to prevent label overlap
    useTransformScaling: true, // Use canvas transform scaling for text (1:1 with circle size)
    renderingOverrides: {
      minPxRadius: 0,
      labelMinPxRadius: 0,
      labelMinFontPx: 0,
      maxNodesPerFrame: Infinity,
      maxLabels: Infinity, // No limit on number of labels, but collision detection will prevent overlap
      lodDetailThreshold: 0,
      lodMediumThreshold: 0,
      lodSimpleThreshold: 0,
      lodSkipThreshold: 0,
      depthRenderEnabled: false,
    },
  });

  // Yield to browser to prevent blocking
  await new Promise(resolve => setTimeout(resolve, 0));

  if (onProgress) {
    onProgress();
  }

  return tileCanvas;
}

export async function captureFullRenderWebp(pixelsPerWorldUnit = DEFAULT_PIXELS_PER_WORLD_UNIT, onProgress) {
  if (!state.layout) {
    throw new Error('No layout available for screenshot');
  }

  const root = getRenderRoot();
  if (!root) {
    throw new Error('No render root available for screenshot');
  }

  const nodes = root.descendants ? root.descendants() : [];
  if (!nodes.length) {
    throw new Error('No nodes available for screenshot');
  }

  const bounds = computeBounds(nodes);
  if (!bounds) {
    throw new Error('Unable to compute screenshot bounds');
  }

  const padX = bounds.width * PADDING_RATIO;
  const padY = bounds.height * PADDING_RATIO;
  const minX = bounds.minX - padX;
  const maxX = bounds.maxX + padX;
  const minY = bounds.minY - padY;
  const maxY = bounds.maxY + padY;

  const worldW = Math.max(1, maxX - minX);
  const worldH = Math.max(1, maxY - minY);

  // Calculate dimensions based on content size with fixed scale factor
  const fullWidth = Math.max(1, Math.round(worldW * pixelsPerWorldUnit));
  const fullHeight = Math.max(1, Math.round(worldH * pixelsPerWorldUnit));

  const scale = pixelsPerWorldUnit;
  const worldBounds = { minX, minY, maxX, maxY, width: worldW, height: worldH };

  await ensureFontsReady();

  // Check if we need to split into chunks (browser canvas limit is 16,384px per dimension)
  const MAX_CANVAS_DIMENSION = 16384;
  const needsSplitting = fullWidth > MAX_CANVAS_DIMENSION || fullHeight > MAX_CANVAS_DIMENSION;

  if (needsSplitting) {
    // Split into chunks and create zip file
    return await createSplitScreenshot(fullWidth, fullHeight, MAX_CANVAS_DIMENSION, worldBounds, scale, onProgress);
  }

  // Normal single-image path
  const width = fullWidth;
  const height = fullHeight;

  // Calculate number of tiles needed
  const tilesX = Math.ceil(width / TILE_SIZE);
  const tilesY = Math.ceil(height / TILE_SIZE);
  const totalTiles = tilesX * tilesY;
  let completedTiles = 0;

  // Create main canvas for final image
  const mainCanvas = document.createElement('canvas');
  try {
    mainCanvas.width = width;
    mainCanvas.height = height;
  } catch (canvasError) {
    throw new Error(`Failed to create canvas (${width}×${height}px): ${canvasError.message}. The image may be too large. Try reducing the resolution.`);
  }
  
  const mainCtx = mainCanvas.getContext('2d', { alpha: false });
  if (!mainCtx) {
    throw new Error('Unable to create main canvas context');
  }

  // Fill with white background
  mainCtx.fillStyle = '#ffffff';
  mainCtx.fillRect(0, 0, width, height);

  // Progress callback wrapper
  const progressCallback = () => {
    completedTiles++;
    if (onProgress) {
      onProgress(completedTiles, totalTiles, Math.round((completedTiles / totalTiles) * 100));
    }
  };

  // Render tiles progressively
  try {
    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const tileX = tx * TILE_SIZE;
        const tileY = ty * TILE_SIZE;
        const tileWidth = Math.min(TILE_SIZE, width - tileX);
        const tileHeight = Math.min(TILE_SIZE, height - tileY);

        try {
          const tileCanvas = await renderTile(
            tileX,
            tileY,
            tileWidth,
            tileHeight,
            worldBounds,
            scale,
            progressCallback
          );

          // Copy tile to main canvas
          mainCtx.drawImage(tileCanvas, tileX, tileY);

          // Clean up tile canvas to free memory
          tileCanvas.width = 0;
          tileCanvas.height = 0;
        } catch (tileError) {
          console.error(`Error rendering tile ${tx},${ty}:`, tileError);
          // Continue with next tile instead of failing completely
          progressCallback();
        }

        // Add a small delay between tiles for very large screenshots to prevent browser hang
        if (totalTiles > 50) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    }
  } catch (renderError) {
    console.error('Error during tile rendering:', renderError);
    throw new Error(`Failed to render tiles: ${renderError.message}`);
  }

  // Convert to blob and download with retry logic
  let blob = null;
  let attempts = 0;
  const maxAttempts = 3;
  
  while (!blob && attempts < maxAttempts) {
    try {
      blob = await new Promise((resolve, reject) => {
        // Set a timeout for blob generation (30 seconds)
        const timeout = setTimeout(() => {
          reject(new Error('Blob generation timeout'));
        }, 30000);
        
        mainCanvas.toBlob((result) => {
          clearTimeout(timeout);
          if (result) {
            resolve(result);
          } else {
            reject(new Error('toBlob returned null'));
          }
        }, 'image/webp', 0.95);
      });
    } catch (blobError) {
      attempts++;
      console.warn(`Blob generation attempt ${attempts} failed:`, blobError);
      if (attempts >= maxAttempts) {
        // Clean up before throwing
        mainCanvas.width = 0;
        mainCanvas.height = 0;
        throw new Error(`Failed to generate WebP blob after ${maxAttempts} attempts: ${blobError.message}. The image may be too large (${width}×${height}px, ${totalTiles} tiles). Try reducing the resolution.`);
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (!blob) {
    mainCanvas.width = 0;
    mainCanvas.height = 0;
    throw new Error('Failed to generate WebP blob');
  }

  try {
    const fileName = `infinitespecies-${Date.now()}.webp`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Delay before revoking URL to ensure download starts
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (downloadError) {
    console.error('Error downloading file:', downloadError);
    // Clean up URL even if download fails
    URL.revokeObjectURL(URL.createObjectURL(blob));
    throw new Error(`Failed to download screenshot: ${downloadError.message}`);
  }

  // Clean up main canvas
  mainCanvas.width = 0;
  mainCanvas.height = 0;

  return { fileName: `infinitespecies-${Date.now()}.webp`, width, height };
}
