/**
 * Framework-independent typed pointer calculations used by the React stage.
 * 
 * Handles all mouse and touch interactions for canvas navigation.
 * React components should only bind these handlers to DOM events.
 */

import { setHoverNode, state } from './state';
import { screenToWorld } from './canvas';
import { pickNodeAt, isNodeInCurrentSubtree } from './picking';
import { handleCameraPan, handleWheelZoom } from './camera';
import { perf } from './settings';
import type { Point, TaxonomyNode } from './types'

function containsWorldPoint(node: TaxonomyNode | null, wx: number, wy: number) {
  if (!node || typeof node._vx !== 'number' || typeof node._vy !== 'number' || typeof node._vr !== 'number') {
    return false;
  }

  const dx = wx - node._vx;
  const dy = wy - node._vy;
  return dx * dx + dy * dy <= node._vr * node._vr;
}

function isNodeHoverableAtPoint(node: TaxonomyNode | null, wx: number, wy: number) {
  if (!node || !isNodeInCurrentSubtree(node)) return false;
  if (!containsWorldPoint(node, wx, wy)) return false;

  const screenR = node._vr * state.camera.k;
  const { pickMinPxRadius, minPxRadius } = perf.rendering;

  return screenR >= (pickMinPxRadius || 0) && screenR >= minPxRadius;
}

function resolveHoverNodeOnCameraChange(px: number, py: number): TaxonomyNode | null {
  const [wx, wy] = screenToWorld(px, py);

  let candidate = state.hoverNode || state.current || state.DATA_ROOT || null;

  while (candidate && (!isNodeInCurrentSubtree(candidate) || !containsWorldPoint(candidate, wx, wy))) {
    candidate = candidate.parent || null;
  }

  if (!candidate) {
    const root = state.current || state.DATA_ROOT || null;
    if (!root || !containsWorldPoint(root, wx, wy)) {
      return null;
    }
    candidate = root;
  }

  while (candidate && !isNodeHoverableAtPoint(candidate, wx, wy)) {
    candidate = candidate.parent || null;
  }

  if (!candidate) {
    return null;
  }

  let resolved = candidate;

  while (resolved?.children?.length) {
    let next = null;

    for (const child of resolved.children) {
      if (!isNodeHoverableAtPoint(child, wx, wy)) continue;
      if (!next || child._vr < next._vr) {
        next = child;
      }
    }

    if (!next) {
      break;
    }

    resolved = next;
  }

  return resolved;
}

/**
 * Handle mouse move event - panning logic
 * @param {number} x - Mouse X position relative to canvas
 * @param {number} y - Mouse Y position relative to canvas
 * @param {boolean} isPanning - Whether user is currently panning
 * @param {Object} lastPan - Last pan position {x, y} or null
 * @returns {Object|null} Updated pan state if panning, null otherwise
 */
export function handleMouseMovePan(x: number, y: number, isPanning: boolean, lastPan: Point | null): Point | null {
  if (isPanning && lastPan) {
    const dx = x - lastPan.x;
    const dy = y - lastPan.y;
    handleCameraPan(dx, dy);
    return { x, y };
  }
  return null;
}

/**
 * Handle hover/picking - returns the node under cursor
 * @param {number} x - Mouse X position relative to canvas
 * @param {number} y - Mouse Y position relative to canvas
 * @returns {Object|null} The node under cursor or null
 */
export function handleMouseMovePick(x: number, y: number): TaxonomyNode | null {
  const node = pickNodeAt(x, y);
  setHoverNode(node);
  return node;
}

/**
 * Handle mouse leave event
 */
export function handleMouseLeaveEvent() {
  setHoverNode(null);
}

/**
 * Handle mouse down event
 * @param {number} button - Mouse button (0=left, 1=middle, 2=right)
 * @param {number} x - Mouse X position relative to canvas
 * @param {number} y - Mouse Y position relative to canvas
 * @returns {Object|null} Pan state if middle button, null otherwise
 */
export function handleMouseDown(button: number, x: number, y: number): Point | null {
  if (button === 1) {
    // Middle mouse button - start panning
    return { x, y };
  }
  return null;
}

/**
 * Handle wheel zoom event
 * @param {WheelEvent} e - The wheel event
 * @param {HTMLElement} canvas - The canvas element
 */
export function handleWheelEvent(e: WheelEvent, canvas: HTMLCanvasElement) {
  handleWheelZoom(e, canvas);
}

/**
 * Validate hover when camera changes (O(1) check)
 * @param {number} x - Mouse X position
 * @param {number} y - Mouse Y position
 * @param {Function} onTooltipUpdate - Callback to update tooltip
 */
export function validateHoverOnCameraChange(
  x: number,
  y: number,
  onTooltipUpdate: (node: TaxonomyNode | null, x: number, y: number) => void,
) {
  if (x === 0 && y === 0) return; // No mouse position yet

  const nextHover = resolveHoverNodeOnCameraChange(x, y);
  const prevHoverId = state.hoverNode?._id ?? null;
  const nextHoverId = nextHover?._id ?? null;

  setHoverNode(nextHover);

  if (prevHoverId !== nextHoverId && onTooltipUpdate) {
    onTooltipUpdate(nextHover, x, y);
  } else if (!nextHover && onTooltipUpdate) {
    onTooltipUpdate(null, x, y);
  }
}
