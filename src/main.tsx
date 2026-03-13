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

const appTree = hasClerkPublishableKey()
  ? (
      <ClerkProvider publishableKey={getClerkPublishableKey()} localization={clerkLocalization}>
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
