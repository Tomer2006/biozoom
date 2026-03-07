import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { perf } from '../modules/settings'
import {
  getColorPresetLabel,
  getLanguageLabel,
  translate,
  type AppLanguage,
} from '../modules/i18n'

interface SettingsModalProps {
  isOpen: boolean
  language: AppLanguage
  onLanguageChange: (language: AppLanguage) => void
  onClose: () => void
}

export default function SettingsModal({ isOpen, language, onLanguageChange, onClose }: SettingsModalProps) {
  const fontSettings = perf.fonts && perf.fonts.presets && perf.fonts.currentPreset ? perf.fonts : null

  const getSavedFontPreset = () => {
    if (!fontSettings) return null
    const saved = localStorage.getItem('infinitespecies_fontPreset')
    if (saved && fontSettings.presets[saved as keyof typeof fontSettings.presets]) {
      return saved
    }
    return fontSettings.currentPreset
  }

  const getSavedColorPreset = () => {
    const saved = localStorage.getItem('infinitespecies_colorPreset')
    if (saved && perf.colors.presets[saved as keyof typeof perf.colors.presets]) {
      return saved
    }
    return perf.colors.currentPreset
  }

  const [currentColorPreset, setCurrentColorPreset] = useState(getSavedColorPreset)
  const [currentFontPreset, setCurrentFontPreset] = useState(getSavedFontPreset)

  const colorPresets = Object.keys(perf.colors.presets)
  const fontPresets = fontSettings ? Object.keys(fontSettings.presets) : []

  const handleColorChange = (preset: string) => {
    setCurrentColorPreset(preset)
    perf.colors.currentPreset = preset
    localStorage.setItem('infinitespecies_colorPreset', preset)
  }

  const handleFontChange = (preset: string) => {
    if (!fontSettings) return
    setCurrentFontPreset(preset)
    fontSettings.currentPreset = preset
    localStorage.setItem('infinitespecies_fontPreset', preset)

    const fontConfig = fontSettings.presets[preset as keyof typeof fontSettings.presets]
    if (fontConfig) {
      if (fontConfig.import) {
        const existingLink = document.querySelector(`link[href*="${fontConfig.import}"]`)
        if (!existingLink) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = `https://fonts.googleapis.com/css2?family=${fontConfig.import}&display=swap`
          document.head.appendChild(link)
        }
      }

      document.documentElement.style.setProperty('--font-sans', `'${fontConfig.name}', ui-sans-serif, system-ui, -apple-system, sans-serif`)
      document.documentElement.style.setProperty('--font-mono', `'${fontConfig.name}', ui-sans-serif, system-ui, -apple-system, sans-serif`)
      perf.rendering.labelFontFamily = `'${fontConfig.name}', ui-sans-serif, system-ui, sans-serif`
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal settings-modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{translate('settings.title', undefined, language)}</h2>
              <button className="modal-close" onClick={onClose} aria-label={translate('common.close', undefined, language)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modal-body settings-body">
              <div className="settings-section">
                <h3 className="settings-section-title">{translate('settings.languageSection', undefined, language)}</h3>
                <div className="settings-select-group">
                  <label htmlFor="language-select">{translate('settings.languageLabel', undefined, language)}</label>
                  <select
                    id="language-select"
                    className="settings-select"
                    value={language}
                    onChange={(e) => onLanguageChange(e.target.value as AppLanguage)}
                  >
                    <option value="en">{getLanguageLabel('en')}</option>
                    <option value="he">{getLanguageLabel('he')}</option>
                  </select>
                </div>
              </div>

              {fontSettings && currentFontPreset && (
                <div className="settings-section">
                  <h3 className="settings-section-title">{translate('settings.fontSection', undefined, language)}</h3>
                  <div className="settings-select-group">
                    <label htmlFor="font-select">{translate('settings.fontLabel', undefined, language)}</label>
                    <select id="font-select" className="settings-select" value={currentFontPreset} onChange={(e) => handleFontChange(e.target.value)}>
                      {fontPresets.map((preset) => (
                        <option key={preset} value={preset}>
                          {fontSettings.presets[preset as keyof typeof fontSettings.presets].name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="settings-section">
                <h3 className="settings-section-title">{translate('settings.colorSection', undefined, language)}</h3>
                <div className="settings-select-group">
                  <label htmlFor="color-select">{translate('settings.colorLabel', undefined, language)}</label>
                  <select id="color-select" className="settings-select" value={currentColorPreset} onChange={(e) => handleColorChange(e.target.value)}>
                    {colorPresets.map((preset) => (
                      <option key={preset} value={preset}>
                        {getColorPresetLabel(preset, language)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="settings-color-preview">
                  {(perf.colors.presets[currentColorPreset as keyof typeof perf.colors.presets] || []).slice(0, 10).map((color: string, index: number) => (
                    <div key={index} className="settings-color-swatch" style={{ backgroundColor: color }} title={color} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
