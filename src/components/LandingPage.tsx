import { motion } from 'framer-motion'
import { Show, SignInButton, SignOutButton, useUser } from '@clerk/react'
import { translate, type AppLanguage } from '../modules/i18n'

interface LandingPageProps {
  language: AppLanguage
  colorPreset: string
  authEnabled: boolean
  authError: string | null
  onStart: () => void
  onLanguage: () => void
  onHelp: () => void
  onSettings: () => void
}

const landingTreeImages: Record<string, string> = {
  tableau10: '/landing-tree-bg.png',
  blueGradient: '/landing-tree-bg1.png',
}

function LandingSignedInStatus({ language }: { language: AppLanguage }) {
  const { user } = useUser()
  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || translate('auth.account', undefined, language)

  return <span>{translate('auth.signedInAs', { name: displayName }, language)}</span>
}

export default function LandingPage({
  language,
  colorPreset,
  authEnabled,
  authError,
  onStart,
  onLanguage,
  onHelp,
  onSettings,
}: LandingPageProps) {
  const landingTreeImage = landingTreeImages[colorPreset] || landingTreeImages.tableau10

  return (
    <motion.div
      className="landing-page"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="landing-art" aria-hidden="true">
        <img className="landing-art-image" src={landingTreeImage} alt="" />
      </div>

      <motion.div
        className="landing-header"
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="landing-title">InfiniteSpecies</h1>
        <p className="landing-tagline">
          {translate('landing.taglineLine1', undefined, language)}
          <br />
          {translate('landing.taglineLine2Prefix', undefined, language)}{' '}
          <span className="highlight">{translate('landing.taglineHighlight', undefined, language)}</span>
          {translate('landing.taglineLine2Suffix', undefined, language)}
        </p>
      </motion.div>

      <motion.div
        className="landing-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.button
          className="landing-start-btn"
          onClick={onStart}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="landing-start-text">{translate('landing.start', undefined, language)}</span>
          <span className="landing-start-hint">{translate('landing.startHint', undefined, language)}</span>
        </motion.button>

        <div className="landing-auth-panel">
          {authEnabled ? (
            <>
              <Show when="signed-in">
                <div className="landing-auth-status">
                  <LandingSignedInStatus language={language} />
                </div>
                <SignOutButton>
                  <motion.button
                    className="landing-google-btn"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span>{translate('auth.signOut', undefined, language)}</span>
                  </motion.button>
                </SignOutButton>
              </Show>

              <Show when="signed-out">
                <SignInButton mode="modal">
                  <motion.button
                    className="landing-google-btn"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span>{translate('auth.signIn', undefined, language)}</span>
                  </motion.button>
                </SignInButton>
              </Show>
            </>
          ) : (
            <p className="landing-auth-note">{authError ?? translate('auth.notConfigured', undefined, language)}</p>
          )}
        </div>
      </motion.div>

      <motion.div
        className="landing-footer-buttons"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <motion.button className="landing-footer-btn landing-footer-icon-btn" onClick={onLanguage} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} title={translate('common.language', undefined, language)}>
          <span aria-hidden="true">🌐</span>
        </motion.button>
        <motion.button className="landing-footer-btn" onClick={onSettings} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          {translate('common.settings', undefined, language)}
        </motion.button>
        <motion.button className="landing-footer-btn" onClick={onHelp} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          {translate('common.help', undefined, language)}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
