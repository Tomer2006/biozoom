import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { getPulsePresentation } from '../modules/search'
import type { TaxonomyNode } from '../modules/types'

interface PulseOverlayProps {
  node: TaxonomyNode | null
  sequence: number
  onFinish: () => void
}

export default function PulseOverlay({ node, sequence, onFinish }: PulseOverlayProps) {
  const ref = useRef<HTMLDivElement>(null)
  const onFinishRef = useRef(onFinish)
  const presentation = useMemo(
    () => (node ? getPulsePresentation(node) : null),
    [node, sequence],
  )

  useEffect(() => {
    onFinishRef.current = onFinish
  }, [onFinish])

  useEffect(() => {
    const element = ref.current
    if (!element || !presentation) return
    const animation = element.animate(presentation.keyframes, presentation.timing)
    animation.onfinish = () => onFinishRef.current()
    return () => animation.cancel()
  }, [presentation])

  if (!presentation) return null
  return <div ref={ref} className="pulse" style={presentation.style as CSSProperties} aria-hidden="true" />
}
