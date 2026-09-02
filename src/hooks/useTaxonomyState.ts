import { useSyncExternalStore } from 'react'
import { getTaxonomySnapshot, subscribeTaxonomyState } from '../modules/state'

/** React adapter for the framework-independent taxonomy engine store. */
export function useTaxonomyState() {
  return useSyncExternalStore(subscribeTaxonomyState, getTaxonomySnapshot, getTaxonomySnapshot)
}
