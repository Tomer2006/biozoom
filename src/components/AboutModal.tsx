import { motion } from 'framer-motion'
import { translate, type AppLanguage } from '../modules/i18n'

interface AboutModalProps {
  language: AppLanguage
  onClose: () => void
}

export default function AboutModal({ language, onClose }: AboutModalProps) {
  const features = [
    translate('about.feature1', undefined, language),
    translate('about.feature2', undefined, language),
    translate('about.feature3', undefined, language),
    translate('about.feature4', undefined, language),
    translate('about.feature5', undefined, language),
    translate('about.feature6', undefined, language),
    translate('about.feature7', undefined, language),
    translate('about.feature8', undefined, language),
  ]

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
          <h2>{translate('about.title', undefined, language)}</h2>
          <button className="modal-close" onClick={onClose} aria-label={translate('common.close', undefined, language)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <h4>{translate('about.appTitle', undefined, language)}</h4>
            <p>{translate('about.intro1', undefined, language)}</p>
            <p style={{ marginTop: '1rem' }}>{translate('about.intro2', undefined, language)}</p>
          </div>

          <div className="modal-section" style={{ marginTop: '1rem' }}>
            <h4>{translate('about.featuresTitle', undefined, language)}</h4>
            {features.map((feature) => (
              <p key={feature}>{feature}</p>
            ))}
          </div>

          <div className="modal-section" style={{ marginTop: '1rem', textAlign: 'center' }}>
            <p style={{ marginBottom: '1rem' }}>{translate('about.projectLinks', undefined, language)}</p>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <a
                href="https://github.com/Tomer2006/infinitespecies"
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                {translate('about.github', undefined, language)}
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
