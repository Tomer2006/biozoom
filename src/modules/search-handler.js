/**
 * Search handler module (vanilla JS)
 * 
 * Handles all search logic including scientific name lookup and result processing.
 * React components should only call these functions and update UI state.
 */

import { findAllByQuery, pulseAtNode } from './search.js';
import { zoomToNode } from './navigation.js';
import { perf } from './settings.js';
import { ensureBackendViewport, loadBackendNodeById, prefetchBackendNodeById, searchBackendNodes } from './data-backend.js';
import { state } from './state.js';

const MAX_QUERY_LENGTH = 100;
const MAX_CACHE_ENTRIES = 100;
const searchCache = new Map();

/**
 * Perform search
 * @param {string} query - The search query
 * @returns {Promise<{matches: Array, hasResults: boolean, singleResult: boolean}>}
 */
export async function performSearch(query, options = {}) {
  const trimmedQuery = String(query || '').trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY_LENGTH);
  if (trimmedQuery.length < 2) {
    return { matches: [], hasResults: false, singleResult: false };
  }

  const cacheKey = `${state.loadMode}:${trimmedQuery.toLowerCase()}`;
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey);
    searchCache.delete(cacheKey);
    searchCache.set(cacheKey, cached);
    return cached;
  }

  let matches = state.loadMode === 'backend'
    ? await searchBackendNodes(trimmedQuery, perf.search.maxResults, options.signal)
    : findAllByQuery(trimmedQuery, perf.search.maxResults);

  const result = {
    matches,
    hasResults: matches.length > 0,
    singleResult: matches.length === 1,
  };

  searchCache.set(cacheKey, result);
  if (searchCache.size > MAX_CACHE_ENTRIES) searchCache.delete(searchCache.keys().next().value);
  return result;
}

export function supportsLiveSearch() {
  return state.loadMode === 'backend';
}

export function prefetchSearchResult(node) {
  if (state.loadMode !== 'backend' || !node?._id) return Promise.resolve(node);
  return prefetchBackendNodeById(node._id);
}

/**
 * Handle search result click - zoom to node without changing navigation
 * @param {Object} node - The node to zoom to
 */
export async function handleSearchResultClick(node) {
  const readyNode = state.loadMode === 'backend'
    ? await loadBackendNodeById(node._id)
    : node;
  zoomToNode(readyNode, perf.search.navigationAnimationMs);
  pulseAtNode(readyNode);
  if (state.loadMode === 'backend') {
    void ensureBackendViewport({ force: true });
  }
}
