/**
 * HelpModal — Modal listing keyboard and mouse controls (zoom, pan, search, fit, etc.).
 */
import { motion } from 'framer-motion'

interface HelpModalProps {
  onClose: () => void
}

const controls = [
  { key: 'Left Click', description: 'Zoom into a group' },
  { key: 'Right Click ', description: 'Zoom out to parent' },
  { key: 'Mouse Wheel ', description: 'Smooth zoom in/out' },
  { key: 'Middle Drag ', description: 'Pan the view' },
  { key: 'Hover', description: 'Show image preview' },
  { key: 'Enter', description: 'Search and navigate' },
  { key: 'S', description: 'Web search current/hovered' },
  { key: 'R', description: 'Reset to root' },
  { key: 'F', description: 'Fit current node in view' },
  { key: '?', description: 'Toggle this help panel' },
]

export default function HelpModal({ onClose }: HelpModalProps) {
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        className="modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Keyboard Shortcuts & Controls</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="help-grid">
            {controls.map((control) => (
              <div key={control.key} className="help-item">
                <span className="help-key">{control.key}</span>
                <span className="help-description">{control.description}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

