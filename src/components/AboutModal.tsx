import { motion } from 'framer-motion'

interface AboutModalProps {
  onClose: () => void
}

export default function AboutModal({ onClose }: AboutModalProps) {
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
          <h2>About InfiniteSpecies</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <h4>InfiniteSpecies</h4>
            <p>
              InfiniteSpecies is an interactive web application for exploring the Tree of Life.
              It provides a zoomable, interactive visualization of taxonomic relationships
              across millions of organisms.
            </p>
            <p style={{ marginTop: '1rem' }}>
              Navigate through the hierarchy of life from the highest domains down to
              individual species. Use smooth zooming and panning to explore at any level
              of detail.
            </p>
          </div>

          <div className="modal-section" style={{ marginTop: '1rem' }}>
            <h4>Features</h4>
            <p>• Circle-packing visualization of taxonomic hierarchy</p>
            <p>• Smooth camera animations and transitions</p>
            <p>• Search functionality to find any organism</p>
            <p>• Integration with external databases (Wikipedia, GBIF, etc.)</p>
            <p>• Deep linking for sharing specific views</p>
            <p>• Keyboard shortcuts for power users</p>
          </div>

          <div className="modal-section" style={{ marginTop: '1rem', textAlign: 'center' }}>
            <a
              href="https://github.com/Tomer2006/infinitespecies"
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

