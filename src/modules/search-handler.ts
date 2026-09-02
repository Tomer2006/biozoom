/**
 * Framework-independent typed search orchestration.
 * 
 * Handles all search logic including scientific name lookup and result processing.
 * React components should only call these functions and update UI state.
 */

import { findAllByQuery } from './search';
import { zoomToNode } from './navigation';
import { perf } from './settings';
import { ensureBackendViewport, loadBackendNodeById, prefetchBackendNodeById, searchBackendNodes } from './data-backend';
import { state } from './state';
import { requestNodePulse } from './visual-events'
import type { TaxonomyNode } from './types'

const MAX_QUERY_LENGTH = 100;
const MAX_CACHE_ENTRIES = 100;
export interface SearchResponse {
  matches: TaxonomyNode[]
  hasResults: boolean
  singleResult: boolean
}
interface SearchOptions { signal?: AbortSignal }
const searchCache = new Map<string, SearchResponse>();

/**
 * Perform search
 * @param {string} query - The search query
 * @returns {Promise<{matches: Array, hasResults: boolean, singleResult: boolean}>}
 */
export async function performSearch(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
  const trimmedQuery = String(query || '').trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY_LENGTH);
  if (trimmedQuery.length < 2) {
    return { matches: [], hasResults: false, singleResult: false };
  }

  const cacheKey = `${state.loadMode}:${trimmedQuery.toLowerCase()}`;
  const cached = searchCache.get(cacheKey)
  if (cached) {
    searchCache.delete(cacheKey);
    searchCache.set(cacheKey, cached);
    return cached;
  }

  const matches = state.loadMode === 'backend'
    ? await searchBackendNodes(trimmedQuery, perf.search.maxResults, options.signal)
    : findAllByQuery(trimmedQuery, perf.search.maxResults);

  const result = {
    matches,
    hasResults: matches.length > 0,
    singleResult: matches.length === 1,
  };

  searchCache.set(cacheKey, result);
  if (searchCache.size > MAX_CACHE_ENTRIES) {
    const oldest = searchCache.keys().next().value as string | undefined
    if (oldest) searchCache.delete(oldest)
  }
  return result;
}

export function supportsLiveSearch() {
  return state.loadMode === 'backend';
}

export function prefetchSearchResult(node: TaxonomyNode): Promise<TaxonomyNode | null> {
  if (state.loadMode !== 'backend' || !node?._id) return Promise.resolve(node);
  return prefetchBackendNodeById(node._id);
}

/**
 * Handle search result click - zoom to node without changing navigation
 * @param {Object} node - The node to zoom to
 */
export async function handleSearchResultClick(node: TaxonomyNode): Promise<void> {
  const readyNode = state.loadMode === 'backend'
    ? await loadBackendNodeById(node._id)
    : node;
  if (!readyNode) throw new Error(`Unable to load taxonomy node ${node._id}`)
  zoomToNode(readyNode, perf.search.navigationAnimationMs);
  requestNodePulse(readyNode);
  if (state.loadMode === 'backend') {
    void ensureBackendViewport({ force: true });
  }
}
