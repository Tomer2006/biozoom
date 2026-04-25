import { useEffect, useRef, useState, useCallback } from 'react'
import { state } from '../modules/state'
import { requestRender, screenToWorld, resizeCanvas, tick, onCameraChange } from '../modules/canvas'
import { openProviderSearch } from '../modules/providers'
import { showBigFor, hideBigPreview as hidePreviewModule } from '../modules/preview'
import { updateCurrentNodeOnly, fitNodeInView } from '../modules/navigation'
import {
  handleWheelEvent,
  handleMouseMovePan,
  handleMouseMovePick,
  handleMouseLeaveEvent,
  handleMouseDown as handleMouseDownJS,
  validateHoverOnCameraChange,
} from '../modules/mouse-handler'
import { pickNodeAt } from '../modules/picking'
import { handleCameraPan, clampCameraZoom } from '../modules/camera'
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

interface TooltipState {
  visible: boolean
  x: number
  y: number
  name: string
  meta: string
}

export default function Stage({ language, isLoading, onUpdateBreadcrumbs, hidden = false }: StageProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    name: '',
    meta: '',
  })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const isPanningRef = useRef(false)
  const lastPanRef = useRef<{ x: number; y: number } | null>(null)
  const pickingScheduledRef = useRef(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })
  const prevHoverIdRef = useRef<number | null>(null)
  const breadcrumbTimerRef = useRef<number | null>(null)

  const touchStateRef = useRef({
    isPanning: false,
    isZooming: false,
    lastTouch: null as { x: number; y: number } | null,
    initialDistance: 0,
    initialZoom: 1,
    initialCenter: null as { x: number; y: number } | null,
    lastTapTime: 0,
    longPressTimer: null as number | null,
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

  const updateTooltipAndPreview = useCallback((node: any, x: number, y: number) => {
    if (!node) {
      setTooltip((prev) => ({ ...prev, visible: false }))
      hidePreviewModule()
      return
    }

    const nodeId = node._id || 0
    const changedNode = nodeId !== prevHoverIdRef.current
    prevHoverIdRef.current = nodeId

    setTooltip({
      visible: true,
      x,
      y,
      name: node.name || translate('stage.unknown', undefined, language),
      meta: buildTooltipMeta(node),
    })

    if (changedNode) {
      showBigFor(node)
    }
  }, [buildTooltipMeta])

  useEffect(() => {
    const validateHover = () => {
      const { x, y } = lastMouseRef.current
      validateHoverOnCameraChange(x, y, (node: any, px: number, py: number) => {
        if (node) {
          updateTooltipAndPreview(node, px, py)
        } else {
          setTooltip((prev) => ({ ...prev, visible: false }))
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
        setTooltip((prev) => ({ ...prev, visible: false }))
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
          setTooltip((prev) => ({ ...prev, visible: false }))
          hidePreviewModule()
          prevHoverIdRef.current = null
        }
      })
    }
  }

  const handleMouseLeave = () => {
    handleMouseLeaveEvent()
    setTooltip((prev) => ({ ...prev, visible: false }))

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

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        const pos = getTouchPos(touch)
        touchState.lastTouch = pos
        touchState.isPanning = false

        if (touchState.longPressTimer) {
          clearTimeout(touchState.longPressTimer)
          touchState.longPressTimer = null
        }

        touchState.longPressTimer = window.setTimeout(() => {
          const current = state.current as TaxonomyNode | null
          if (current && current.parent && !isLoading) {
            ensureBackendViewport({ force: true }).then(() => {
              updateCurrentNodeOnly(current.parent as any)
              onUpdateBreadcrumbs(current.parent as any)
            })
            canvas.style.opacity = '0.8'
            setTimeout(() => {
              canvas.style.opacity = '1'
            }, 200)
          }
          touchState.longPressTimer = null
        }, 500)

        const node = pickNodeAt(pos.x, pos.y)
        state.hoverNode = node
        if (node) {
          updateTooltipAndPreview(node, pos.x, pos.y)
        }
      } else if (e.touches.length === 2) {
        touchState.isZooming = true
        touchState.isPanning = false
        touchState.initialDistance = getDistance(e.touches[0], e.touches[1])
        touchState.initialZoom = state.camera.k
        touchState.initialCenter = getCenter(e.touches[0], e.touches[1])

        if (touchState.longPressTimer) {
          clearTimeout(touchState.longPressTimer)
          touchState.longPressTimer = null
        }
      }
      e.preventDefault()
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && touchState.lastTouch) {
        const touch = e.touches[0]
        const pos = getTouchPos(touch)

        if (touchState.longPressTimer) {
          clearTimeout(touchState.longPressTimer)
          touchState.longPressTimer = null
        }

        if (!touchState.isPanning) {
          const dx = pos.x - touchState.lastTouch.x
          const dy = pos.y - touchState.lastTouch.y
          if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            touchState.isPanning = true
            setTooltip((prev) => ({ ...prev, visible: false }))
            hidePreviewModule()
          }
        }

        if (touchState.isPanning) {
          const dx = pos.x - touchState.lastTouch.x
          const dy = pos.y - touchState.lastTouch.y
          handleCameraPan(dx, dy)
          touchState.lastTouch = pos
        }
      } else if (e.touches.length === 2 && touchState.isZooming) {
        const distance = getDistance(e.touches[0], e.touches[1])
        const scale = distance / touchState.initialDistance
        const newZoom = touchState.initialZoom * scale

        if (touchState.initialCenter) {
          const center = getCenter(e.touches[0], e.touches[1])
          const [wx, wy] = screenToWorld(center.x, center.y)

          state.camera.k = clampCameraZoom(newZoom)
          state.camera.x = wx - (center.x - canvas.width / 2) / state.camera.k
          state.camera.y = wy - (center.y - canvas.height / 2) / state.camera.k

          requestRender()
        }
      }
      e.preventDefault()
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchState.longPressTimer) {
        clearTimeout(touchState.longPressTimer)
        touchState.longPressTimer = null
      }

      if (e.touches.length === 0) {
        if (!touchState.isPanning && !touchState.isZooming && touchState.lastTouch) {
          const now = Date.now()
          const timeSinceLastTap = now - touchState.lastTapTime

          if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
            const targetNode = state.hoverNode || state.current || state.DATA_ROOT
            if (targetNode) {
              fitNodeInView(targetNode)
            }
          }

          touchState.lastTapTime = now
        }

        touchState.isPanning = false
        touchState.isZooming = false
        touchState.lastTouch = null
        touchState.initialDistance = 0
        touchState.initialCenter = null
      } else if (e.touches.length === 1) {
        touchState.isZooming = false
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
      if (touchState.longPressTimer) {
        clearTimeout(touchState.longPressTimer)
      }
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

      <div
        className="tooltip"
        style={{
          left: tooltip.x,
          top: tooltip.y,
          opacity: tooltip.visible ? 1 : 0,
        }}
      >
        <div className="tooltip-content">
          <div className="tooltip-name">{tooltip.name}</div>
          {tooltip.meta && <div className="tooltip-meta">{tooltip.meta}</div>}
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
