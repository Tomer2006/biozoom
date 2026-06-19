/**
 * DOM element references module (React-compatible)
 *
 * Provides getters for DOM elements that work with React's dynamic rendering.
 * Elements are looked up on-demand rather than cached at module load time.
 */

// Canvas and stage are accessed via getter functions for React compatibility
export const getCanvas = () => {
  // Prefer the React canvas reference if set
  if (window.__reactCanvas) return window.__reactCanvas;
  return document.getElementById('view');
};

export const getStage = () => {
  // Look for the stage element by class first (React uses className)
  const stage = document.querySelector('.stage');
  if (stage) return stage;
  return document.getElementById('stage');
};

// Tooltip element references (used by tooltip.js)
export const ttip = { get current() { return document.getElementById('tooltip'); } };
export const tName = { get current() { return document.querySelector('.tooltip .name'); } };
export const tMeta = { get current() { return document.querySelector('.tooltip .meta'); } };
