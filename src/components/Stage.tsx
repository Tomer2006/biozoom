import { useEffect, useRef, useCallback } from 'react'
import { state } from '../modules/state'
import { requestRender, screenToWorld, resizeCanvas, tick, onCameraChange, W, H } from '../modules/canvas'
import { openProviderSearch } from '../modules/providers'
import { showBigFor, hideBigPreview as hidePreviewModule } from '../modules/preview'
import { updateCurrentNodeOnly } from '../modules/navigation'
import {
  handleWheelEvent,
  handleMouseMovePan,
  handleMouseMovePick,
  handleMouseLeaveEvent,
  handleMouseDown as handleMouseDownJS,
  validateHoverOnCameraChange,
} from '../modules/mouse-handler'
import { pickNodeAt } from '../modules/picking'
import { handleCameraPan, clampCameraZoom, stopCameraAnimation } from '../modules/camera'
import { ensureBackendViewport } from '../modules/data-backend'
import { formatNumber, translate, type AppLanguage } from '../modules/i18n'

interface TaxonomyNode {
  _id: number
  name: string
  level: number
  children?: TaxonomyNode[]
  parent?: TaxonomyNode | null
  _leaves?: number
  _vx?: number
  _vy?: number
  _vr?: number
}

interface StageProps {
  language: AppLanguage
  isLoading: boolean
  onUpdateBreadcrumbs: (node: TaxonomyNode) => void
  hidden?: boolean
}

export default function Stage({ language, isLoading, onUpdateBreadcrumbs, hidden = false }: StageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  // Tooltip is updated imperatively via refs (not React state) so hovering over
  // nodes doesn't re-render the whole Stage subtree ~60x/sec.
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipNameRef = useRef<HTMLDivElement>(null)
  const tooltipMetaRef = useRef<HTMLDivElement>(null)
  const isPanningRef = useRef(false)
  const lastPanRef = useRef<{ x: number; y: number } | null>(null)
  const pickingScheduledRef = useRef(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })
  const prevHoverIdRef = useRef<number | null>(null)
  const breadcrumbTimerRef = useRef<number | null>(null)

  const touchStateRef = useRef({
    isPanning: false,
    isZooming: false,
    multiTouch: false,
    lastTouch: null as { x: number; y: number } | null,
    initialDistance: 0,
    initialZoom: 1,
    initialCenter: null as { x: number; y: number } | null,
    lastTapTime: 0,
    longPressTimer: null as number | null,
    longPressFired: false,
  })

  useEffect(() => {
    if (canvasRef.current) {
      // @ts-ignore
      window.__reactCanvas = canvasRef.current
    }

    return () => {
      if (breadcrumbTimerRef.current !== null) {
        clearTimeout(breadcrumbTimerRef.current)
        breadcrumbTimerRef.current = null
      }
    }
  }, [onUpdateBreadcrumbs])

  useEffect(() => {
    if (!hidden && canvasRef.current) {
      const timer = setTimeout(() => {
        resizeCanvas()
        tick()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [hidden])

  const buildTooltipMeta = useCallback((node: any) => {
    const parts: string[] = []
    const isLeafNode = !node.children || node.children.length === 0

    if (isLeafNode && node._leaves === 1) {
      parts.push(translate('stage.oneSpecies', undefined, language))
    } else if (node._leaves && node._leaves > 1) {
      parts.push(translate('stage.speciesCount', { count: formatNumber(node._leaves, language) }, language))
    }

    return parts.join(' • ')
  }, [language])

  const hideTooltip = useCallback(() => {
    const el = tooltipRef.current
    if (el) el.style.opacity = '0'
  }, [])

  const showTooltip = useCallback((node: any, x: number, y: number) => {
    const el = tooltipRef.current
    if (!el) return
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    el.style.opacity = '1'
    if (tooltipNameRef.current) {
      tooltipNameRef.current.textContent = node.name || translate('stage.unknown', undefined, language)
    }
    if (tooltipMetaRef.current) {
      const meta = buildTooltipMeta(node)
      tooltipMetaRef.current.textContent = meta
      tooltipMetaRef.current.style.display = meta ? '' : 'none'
    }
  }, [language, buildTooltipMeta])

  const updateTooltipAndPreview = useCallback((node: any, x: number, y: number) => {
    if (!node) {
      hideTooltip()
      hidePreviewModule()
      return
    }

    const nodeId = node._id || 0
    const changedNode = nodeId !== prevHoverIdRef.current
    prevHoverIdRef.current = nodeId

    showTooltip(node, x, y)

    if (changedNode) {
      showBigFor(node)
    }
  }, [showTooltip, hideTooltip])

  useEffect(() => {
    const validateHover = () => {
      const { x, y } = lastMouseRef.current
      validateHoverOnCameraChange(x, y, (node: any, px: number, py: number) => {
        if (node) {
          updateTooltipAndPreview(node, px, py)
        } else {
          hideTooltip()
          hidePreviewModule()
          prevHoverIdRef.current = null
        }
      })
    }

    return onCameraChange(validateHover)
  }, [updateTooltipAndPreview])

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    lastMouseRef.current = { x, y }

    if (isPanningRef.current && lastPanRef.current) {
      const newPan = handleMouseMovePan(x, y, isPanningRef.current, lastPanRef.current) as { x: number; y: number } | null
      if (newPan) {
        lastPanRef.current = newPan
        hideTooltip()
        hidePreviewModule()
        return
      }
    }

    if (!pickingScheduledRef.current) {
      pickingScheduledRef.current = true
      requestAnimationFrame(() => {
        pickingScheduledRef.current = false
        const node = handleMouseMovePick(lastMouseRef.current.x, lastMouseRef.current.y)
        if (node) {
          updateTooltipAndPreview(node, lastMouseRef.current.x, lastMouseRef.current.y)
        } else {
          hideTooltip()
          hidePreviewModule()
          prevHoverIdRef.current = null
        }
      })
    }
  }

  const handleMouseLeave = () => {
    handleMouseLeaveEvent()
    hideTooltip()

    if (breadcrumbTimerRef.current !== null) {
      clearTimeout(breadcrumbTimerRef.current)
      breadcrumbTimerRef.current = null
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const result = handleMouseDownJS(1, x, y)
        if (result && typeof result === 'object' && 'x' in result && 'y' in result) {
          isPanningRef.current = true
          lastPanRef.current = { x: (result as { x: number; y: number }).x, y: (result as { x: number; y: number }).y }
        }
      }
      e.preventDefault()
    }
  }

  useEffect(() => {
    const handleMouseUp = () => {
      isPanningRef.current = false
      lastPanRef.current = null
    }

    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheelEventWrapper = (e: WheelEvent) => {
      handleWheelEvent(e, canvas)
    }

    canvas.addEventListener('wheel', handleWheelEventWrapper, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheelEventWrapper)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const touchState = touchStateRef.current

    const getTouchPos = (touch: Touch) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }
    }

    const getDistance = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    const getCenter = (t1: Touch, t2: Touch) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: (t1.clientX + t2.clientX) / 2 - rect.left,
        y: (t1.clientY + t2.clientY) / 2 - rect.top,
      }
    }

    const clearLongPress = () => {
      if (touchState.longPressTimer) {
        clearTimeout(touchState.longPressTimer)
        touchState.longPressTimer = null
      }
    }

    // Drill into a node — the touch equivalent of a desktop left-click: make it
    // the current node, update the breadcrumbs, and load its viewport data.
    const drillIntoNode = (node: TaxonomyNode | null) => {
      if (!node || isLoading) return
      const current = state.current as TaxonomyNode | null
      if (current && node._id === current._id) return
      updateCurrentNodeOnly(node as any)
      onUpdateBreadcrumbs(node)
      void ensureBackendViewport({ force: true })
    }

    // Go up one level — the touch equivalent of a desktop right-click.
    const goToParent = () => {
      const current = state.current as TaxonomyNode | null
      if (!current || !current.parent || isLoading) return
      updateCurrentNodeOnly(current.parent as any)
      onUpdateBreadcrumbs(current.parent as any)
      void ensureBackendViewport({ force: true })
      hideTooltip()
      hidePreviewModule()
      prevHoverIdRef.current = null
      // Brief dim so the "back" gesture feels responsive.
      canvas.style.opacity = '0.8'
      window.setTimeout(() => {
        canvas.style.opacity = '1'
      }, 150)
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const pos = getTouchPos(e.touches[0])
        touchState.lastTouch = pos
        touchState.isPanning = false
        touchState.longPressFired = false

        clearLongPress()
        touchState.longPressTimer = window.setTimeout(() => {
          touchState.longPressTimer = null
          touchState.longPressFired = true
          goToParent()
        }, 500)

        // A single tap acts like desktop hover: select the node and preview it.
        const node = pickNodeAt(pos.x, pos.y)
        state.hoverNode = node
        if (node) {
          updateTooltipAndPreview(node, pos.x, pos.y)
        } else {
          hideTooltip()
          hidePreviewModule()
          prevHoverIdRef.current = null
        }
      } else if (e.touches.length >= 2) {
        touchState.multiTouch = true
        touchState.isZooming = true
        touchState.isPanning = false
        touchState.initialDistance = getDistance(e.touches[0], e.touches[1])
        touchState.initialZoom = state.camera.k
        touchState.initialCenter = getCenter(e.touches[0], e.touches[1])
        clearLongPress()
        stopCameraAnimation()
        hideTooltip()
        hidePreviewModule()
      }
      e.preventDefault()
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && touchState.lastTouch && !touchState.isZooming) {
        const pos = getTouchPos(e.touches[0])

        if (!touchState.isPanning) {
          const dx = pos.x - touchState.lastTouch.x
          const dy = pos.y - touchState.lastTouch.y
          if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
            touchState.isPanning = true
            clearLongPress()
            hideTooltip()
            hidePreviewModule()
          }
        }

        if (touchState.isPanning) {
          const dx = pos.x - touchState.lastTouch.x
          const dy = pos.y - touchState.lastTouch.y
          handleCameraPan(dx, dy)
          touchState.lastTouch = pos
        }
      } else if (e.touches.length >= 2 && touchState.isZooming && touchState.initialDistance > 0) {
        const distance = getDistance(e.touches[0], e.touches[1])
        const scale = distance / touchState.initialDistance
        const newZoom = touchState.initialZoom * scale
        const center = getCenter(e.touches[0], e.touches[1])

        // Keep the world point under the pinch midpoint fixed as the zoom
        // changes (same anchoring as the wheel zoom in camera.js). Use the
        // canvas CSS size (W/H), NOT canvas.width/height — those are device
        // pixels and would be off by devicePixelRatio on phones.
        const [wx, wy] = screenToWorld(center.x, center.y)
        const k = clampCameraZoom(newZoom)
        state.camera.k = k
        state.camera.x = wx - (center.x - W / 2) / k
        state.camera.y = wy - (center.y - H / 2) / k
        requestRender()
      }
      e.preventDefault()
    }

    const resetTouchState = () => {
      touchState.isPanning = false
      touchState.isZooming = false
      touchState.multiTouch = false
      touchState.lastTouch = null
      touchState.initialDistance = 0
      touchState.initialCenter = null
    }

    const handleTouchEnd = (e: TouchEvent) => {
      clearLongPress()

      // The long-press already navigated; don't also treat the finger lift as
      // a tap.
      if (touchState.longPressFired) {
        touchState.longPressFired = false
        if (e.touches.length === 0) {
          resetTouchState()
          touchState.lastTapTime = 0
        }
        e.preventDefault()
        return
      }

      if (e.touches.length === 0) {
        const wasTap = !touchState.isPanning && !touchState.multiTouch && !!touchState.lastTouch

        if (wasTap) {
          const now = Date.now()
          const sinceLastTap = now - touchState.lastTapTime
          if (sinceLastTap > 0 && sinceLastTap < 300) {
            // Double tap drills into the tapped node (like a desktop left-click).
            drillIntoNode(state.hoverNode as TaxonomyNode | null)
            touchState.lastTapTime = 0
          } else {
            touchState.lastTapTime = now
          }
        }

        resetTouchState()
      } else if (e.touches.length === 1) {
        // Lifted one finger of a pinch — resume single-finger panning, but keep
        // multiTouch set so the final lift isn't mistaken for a tap.
        touchState.isZooming = false
        touchState.isPanning = false
        touchState.lastTouch = getTouchPos(e.touches[0])
      }

      e.preventDefault()
    }

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false })
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false })

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)
      canvas.removeEventListener('touchcancel', handleTouchEnd)
      clearLongPress()
    }
  }, [isLoading, onUpdateBreadcrumbs, updateTooltipAndPreview])

  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (isLoading) return

    const current = state.current as TaxonomyNode | null
    if (current && current.parent) {
      await ensureBackendViewport({ force: true })
      updateCurrentNodeOnly(current.parent as any)
      onUpdateBreadcrumbs(current.parent)
    }
  }

  const handleClick = async (e: React.MouseEvent) => {
    if (e.button !== 0 || isLoading) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const node = pickNodeAt(x, y)
    if (!node) return

    updateCurrentNodeOnly(node as any)
    onUpdateBreadcrumbs(node)
    await ensureBackendViewport({ force: true })
  }

  return (
    <div className={`stage ${hidden ? 'hidden' : ''}`} ref={stageRef}>
      <canvas
        id="view"
        ref={canvasRef}
        className={isLoading ? 'loading' : ''}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        onClick={handleClick}
      />

      <div className="tooltip" ref={tooltipRef}>
        <div className="tooltip-content">
          <div className="tooltip-name" ref={tooltipNameRef}></div>
          <div className="tooltip-meta" ref={tooltipMetaRef}></div>
        </div>
      </div>

      <div className="big-preview" id="bigPreview" aria-hidden="true">
        <div className="big-preview-header">
          <div className="big-preview-caption" id="bigPreviewCap"></div>
        </div>
        <img id="bigPreviewImg" alt="" decoding="async" />
        <div className="big-preview-empty" id="bigPreviewEmpty" aria-hidden="true">
          {translate('stage.noImage', undefined, language)}
        </div>
        <div className="big-preview-footer">
          <button
            className="btn btn-small"
            onClick={(e) => {
              e.stopPropagation()
              const targetNode = state.hoverNode || state.current
              if (targetNode) {
                openProviderSearch(targetNode)
              }
            }}
            title={translate('stage.webSearchTitle', undefined, language)}
          >
            {translate('stage.webSearch', undefined, language)}
          </button>
          <div className="big-preview-path" id="bigPreviewPath"></div>
        </div>
      </div>

      <div className="pulse" id="pulse" />

      <div className="stage-watermark">InfiniteSpecies.com</div>
    </div>
  )
}
