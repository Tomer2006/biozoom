import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { captureFullRenderPng } from '../modules/screenshot'

interface ScreenshotPanelProps {
  isOpen: boolean
  onClose: () => void
  onShowToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error', duration?: number) => string
}

export default function ScreenshotPanel({ isOpen, onClose, onShowToast }: ScreenshotPanelProps) {
  const [pixelsPerWorldUnit, setPixelsPerWorldUnit] = useState(1000)
  const [isCapturing, setIsCapturing] = useState(false)
  const [progress, setProgress] = useState({ completed: 0, total: 0, percent: 0 })

  const handleStartScreenshot = async () => {
    setIsCapturing(true)
    setProgress({ completed: 0, total: 0, percent: 0 })

    try {
      // Temporarily override PIXELS_PER_WORLD_UNIT in screenshot module
      // We'll need to pass this as a parameter to captureFullRenderPng
      const { width, height } = await captureFullRenderPng(
        pixelsPerWorldUnit,
        (completed, total, percent) => {
          setProgress({ completed, total, percent })
        }
      )
      
      setIsCapturing(false)
      onShowToast(`Saved PNG (${width}×${height})`, 'success')
      onClose()
    } catch (err) {
      console.error('Screenshot failed:', err)
      setIsCapturing(false)
      onShowToast('Screenshot failed', 'error')
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={!isCapturing ? onClose : undefined}
          style={{ cursor: isCapturing ? 'default' : 'pointer' }}
        >
          {/* Modal */}
          <motion.div
            className="modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ maxWidth: '500px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">Screenshot Settings</h2>
              {!isCapturing && (
                <button
                  className="modal-close"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            <div className="modal-content">
              <div className="settings-group">
                <label className="settings-label">
                  <span>Resolution (pixels per world unit)</span>
                  <span className="settings-hint">
                    Higher = more detail but larger file size
                  </span>
                </label>
                <input
                  type="number"
                  className="settings-input"
                  value={pixelsPerWorldUnit}
                  onChange={(e) => setPixelsPerWorldUnit(Math.max(100, Math.min(5000, parseInt(e.target.value) || 1000)))}
                  min={100}
                  max={5000}
                  step={100}
                  disabled={isCapturing}
                />
                <div className="settings-note">
                  Current: {pixelsPerWorldUnit} px/unit (recommended: 300-2000)
                </div>
              </div>

              {isCapturing && (
                <div className="screenshot-progress">
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <div className="progress-text">
                    Rendering screenshot... {progress.percent}% ({progress.completed}/{progress.total} tiles)
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={handleStartScreenshot}
                disabled={isCapturing}
              >
                {isCapturing ? 'Capturing...' : 'Start Screenshot'}
              </button>
              {!isCapturing && (
                <button
                  className="btn btn-ghost"
                  onClick={onClose}
                >
                  Cancel
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
