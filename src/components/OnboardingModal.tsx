import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { translate, type AppLanguage } from '../modules/i18n'

interface OnboardingModalProps {
  isOpen: boolean
  language: AppLanguage
  onClose: () => void
}

const totalSteps = 3

export default function OnboardingModal({ isOpen, language, onClose }: OnboardingModalProps) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (isOpen) {
      setStep(0)
    }
  }, [isOpen])

  const steps = [
    {
      title: translate('onboarding.introTitle', undefined, language),
      body: translate('onboarding.introBody', undefined, language),
      points: [
        translate('onboarding.introPoint1', undefined, language),
        translate('onboarding.introPoint2', undefined, language),
        translate('onboarding.introPoint3', undefined, language),
      ],
    },
    {
      title: translate('onboarding.navigateTitle', undefined, language),
      body: translate('onboarding.navigateBody', undefined, language),
      points: [
        translate('onboarding.navigatePoint1', undefined, language),
        translate('onboarding.navigatePoint2', undefined, language),
        translate('onboarding.navigatePoint3', undefined, language),
        translate('onboarding.navigatePoint4', undefined, language),
      ],
    },
    {
      title: translate('onboarding.toolsTitle', undefined, language),
      body: translate('onboarding.toolsBody', undefined, language),
      points: [
        translate('onboarding.toolsPoint1', undefined, language),
        translate('onboarding.toolsPoint2', undefined, language),
        translate('onboarding.toolsPoint3', undefined, language),
      ],
    },
  ]

  const current = steps[step]
  const isLastStep = step === steps.length - 1

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-backdrop onboarding-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal onboarding-modal"
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="onboarding-header-copy">
                <div className="onboarding-step">{translate('onboarding.step', { current: step + 1, total: totalSteps }, language)}</div>
                <h2>{translate('onboarding.title', undefined, language)}</h2>
              </div>
              <button className="modal-close" onClick={onClose} aria-label={translate('common.close', undefined, language)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modal-body onboarding-body">
              <div className="onboarding-card">
                <h3 className="onboarding-card-title">{current.title}</h3>
                <p className="onboarding-card-body">{current.body}</p>
                <div className="onboarding-points">
                  {current.points.map((point) => (
                    <div key={point} className="onboarding-point">
                      <span className="onboarding-point-dot" aria-hidden="true" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={onClose}>
                {translate('common.skip', undefined, language)}
              </button>
              <div className="onboarding-actions">
                {step > 0 && (
                  <button className="btn btn-ghost" onClick={() => setStep((currentStep) => currentStep - 1)}>
                    {translate('common.back', undefined, language)}
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (isLastStep) {
                      onClose()
                    } else {
                      setStep((currentStep) => currentStep + 1)
                    }
                  }}
                >
                  {isLastStep ? translate('common.done', undefined, language) : translate('common.next', undefined, language)}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
