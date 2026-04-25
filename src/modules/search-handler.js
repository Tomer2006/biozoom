/**
 * Search handler module (vanilla JS)
 * 
 * Handles all search logic including scientific name lookup and result processing.
 * React components should only call these functions and update UI state.
 */

import { findAllByQuery, pulseAtNode } from './search.js';
import { updateNavigation, zoomToNode } from './navigation.js';
import { processSearchResults } from './search.js';
import { perf } from './settings.js';
import { ensureBackendViewport, loadBackendNodeById, searchBackendNodes } from './data-backend.js';
import { state } from './state.js';

/**
 * Perform search
 * @param {string} query - The search query
 * @param {Function} onToast - Callback to show toast messages (message, type, duration)
 * @returns {Promise<{matches: Array, hasResults: boolean, singleResult: boolean}>}
 */
export async function performSearch(query, onToast) {
  if (!query || !query.trim()) {
    return { matches: [], hasResults: false, singleResult: false };
  }

  const trimmedQuery = query.trim();
  let matches = state.loadMode === 'backend'
    ? await searchBackendNodes(trimmedQuery, perf.search.maxResults)
    : findAllByQuery(trimmedQuery, perf.search.maxResults);
  
  return {
    matches,
    hasResults: matches.length > 0,
    singleResult: matches.length === 1,
  };
}

/**
 * Handle single search result - navigate to it
 * @param {Object} node - The node to navigate to
 * @param {Function} onUpdateBreadcrumbs - Callback to update breadcrumbs
 */
export async function handleSingleSearchResult(node, onUpdateBreadcrumbs) {
  const readyNode = state.loadMode === 'backend'
    ? await loadBackendNodeById(node._id)
    : node;
  updateNavigation(readyNode, false);
  pulseAtNode(readyNode);
  if (onUpdateBreadcrumbs) {
    onUpdateBreadcrumbs(readyNode);
  }
}

/**
 * Handle search result click - zoom to node without changing navigation
 * @param {Object} node - The node to zoom to
 */
export async function handleSearchResultClick(node) {
  const readyNode = state.loadMode === 'backend'
    ? await loadBackendNodeById(node._id)
    : node;
  zoomToNode(readyNode);
  pulseAtNode(readyNode);
  if (state.loadMode === 'backend') {
    ensureBackendViewport({ force: true });
  }
}
