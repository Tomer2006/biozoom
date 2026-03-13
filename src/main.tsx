/**
 * main.tsx — Application entry point. Mounts React app, loads saved settings from localStorage
 * (font/color/search provider), applies fonts to CSS and canvas, then renders <App />.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import App from './App'
import './styles/index.css'
import { perf } from './modules/settings.js'
import { initializeLanguage } from './modules/i18n'
import { getClerkPublishableKey, hasClerkPublishableKey } from './modules/clerk'

initializeLanguage()

// Load saved settings from localStorage
const savedColorPreset = localStorage.getItem('infinitespecies_colorPreset')
const savedSearchProvider = localStorage.getItem('infinitespecies_searchProvider')

// Apply saved color preset if exists
if (savedColorPreset && perf.colors.presets[savedColorPreset as keyof typeof perf.colors.presets]) {
  perf.colors.currentPreset = savedColorPreset
}

// Apply saved search provider if exists
if (savedSearchProvider && perf.search.providers[savedSearchProvider as keyof typeof perf.search.providers]) {
  perf.search.currentProvider = savedSearchProvider
}

const robotoImport = 'Roboto:wght@300;400;500;700'
const robotoFontStack = `'Roboto', ui-sans-serif, system-ui, -apple-system, sans-serif`

const existingRobotoLink = document.querySelector(`link[href*="${robotoImport}"]`)
if (!existingRobotoLink) {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${robotoImport}&display=swap`
  document.head.appendChild(link)
}

document.documentElement.style.setProperty('--font-sans', robotoFontStack)
document.documentElement.style.setProperty('--font-mono', robotoFontStack)
perf.rendering.labelFontFamily = `'Roboto', ui-sans-serif, system-ui, sans-serif`

const clerkLocalization = {
  signIn: {
    start: {
      title: 'Sign in to infinitespecies',
      titleCombined: 'Sign in to infinitespecies',
    },
  },
}

const clerkAppearance = {
  variables: {
    colorPrimary: '#5bc4be',
    colorText: '#f4f7fb',
    colorTextSecondary: '#9db0c7',
    colorBackground: '#0d1220',
    colorInputBackground: '#131a2a',
    colorInputText: '#f4f7fb',
    colorDanger: '#ff6b6b',
    borderRadius: '12px',
    fontFamily: robotoFontStack,
  },
  elements: {
    card: {
      backgroundColor: 'rgba(10, 16, 27, 0.96)',
      border: '1px solid rgba(95, 120, 151, 0.45)',
      boxShadow: '0 24px 80px rgba(0, 0, 0, 0.5)',
    },
    modalBackdrop: {
      backgroundColor: 'rgba(4, 8, 14, 0.78)',
      backdropFilter: 'blur(10px)',
    },
    headerTitle: {
      color: '#f4f7fb',
    },
    headerSubtitle: {
      color: '#9db0c7',
    },
    socialButtonsBlockButton: {
      backgroundColor: '#131a2a',
      border: '1px solid rgba(95, 120, 151, 0.55)',
      color: '#f4f7fb',
    },
    socialButtonsBlockButtonText: {
      color: '#f4f7fb',
    },
    formFieldInput: {
      backgroundColor: '#131a2a',
      borderColor: 'rgba(95, 120, 151, 0.55)',
      color: '#f4f7fb',
    },
    formButtonPrimary: {
      backgroundColor: '#5bc4be',
      color: '#0a1628',
    },
    footerActionLink: {
      color: '#5bc4be',
    },
    dividerLine: {
      backgroundColor: 'rgba(95, 120, 151, 0.35)',
    },
    dividerText: {
      color: '#9db0c7',
    },
  },
}

const appTree = hasClerkPublishableKey()
  ? (
      <ClerkProvider
        publishableKey={getClerkPublishableKey()}
        localization={clerkLocalization}
        appearance={clerkAppearance}
      >
        <App />
      </ClerkProvider>
    )
  : (
      <App />
    )

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {appTree}
  </React.StrictMode>,
)
