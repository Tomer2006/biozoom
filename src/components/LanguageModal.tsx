import { motion, AnimatePresence } from 'framer-motion'
import type { AppLanguage } from '../modules/i18n'
import { translate } from '../modules/i18n'

interface LanguageModalProps {
  isOpen: boolean
  onSelect: (language: AppLanguage) => void
  onClose: () => void
}

export default function LanguageModal({ isOpen, onSelect, onClose }: LanguageModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-backdrop language-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal language-modal"
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header language-modal-header">
              <h2>{translate('languageModal.title')}</h2>
              <button className="modal-close" onClick={onClose} aria-label={translate('common.close')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modal-body language-modal-body">
              <p className="language-modal-subtitle">{translate('languageModal.subtitle')}</p>

              <div className="language-modal-options">
                <button className="language-option" onClick={() => onSelect('en')}>
                  <span className="language-option-flag" aria-hidden="true">🇺🇸</span>
                  <span className="language-option-title">{translate('languageModal.englishTitle')}</span>
                  <span className="language-option-description">{translate('languageModal.englishDescription')}</span>
                </button>

                <button className="language-option" onClick={() => onSelect('he')}>
                  <span className="language-option-flag" aria-hidden="true">🇮🇱</span>
                  <span className="language-option-title">{translate('languageModal.hebrewTitle')}</span>
                  <span className="language-option-description">{translate('languageModal.hebrewDescription')}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
