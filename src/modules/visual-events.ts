import type { TaxonomyNode } from './types'

type PulseListener = (node: TaxonomyNode) => void
const pulseListeners = new Set<PulseListener>()

export function subscribeToPulse(listener: PulseListener) {
  pulseListeners.add(listener)
  return () => { pulseListeners.delete(listener) }
}

export function requestNodePulse(node: TaxonomyNode) {
  pulseListeners.forEach((listener) => listener(node))
}
