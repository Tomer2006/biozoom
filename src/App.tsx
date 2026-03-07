/**
 * App.tsx - Root React component for InfiniteSpecies.
 * Composes landing, topbar, breadcrumbs, canvas stage, loading overlay, first-run language modal,
 * settings/help/about dialogs, screenshot panel, and toast notifications.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import LandingPage from './components/LandingPage'
import Topbar from './components/Topbar'
import Breadcrumbs from './components/Breadcrumbs'
import Stage from './components/Stage'
import LoadingOverlay from './components/LoadingOverlay'
import LanguageModal from './components/LanguageModal'
import OnboardingModal from './components/OnboardingModal'
import HelpModal from './components/HelpModal'
import AboutModal from './components/AboutModal'
import SettingsModal from './components/SettingsModal'
import ScreenshotPanel from './components/ScreenshotPanel'
import ToastContainer from './components/Toast'
import { useToast } from './hooks/useToast'

import { state } from './modules/state'
import { resizeCanvas, registerDrawCallback, tick } from './modules/canvas'
import { draw } from './modules/render'
import { loadEager } from './modules/data'
import { decodePath, findNodeByPath, getNodePath, updateDeepLinkFromNode } from './modules/deeplink'
import { updateNavigation, fitNodeInView, goToNode, zoomToNode } from './modules/navigation'
import { openProviderSearch } from './modules/providers'
import {
  getCurrentLanguage,
  getStoredLanguage,
  setCurrentLanguage,
  translate,
  type AppLanguage,
} from './modules/i18n'

export interface AppState {
  isLanding: boolean
  isLoading: boolean
  loadingTitle: string
  loadingStage: string
  loadingProgress: number
  loadingPct: string
  loadingTimer: string
  showTopbar: boolean
  breadcrumbs: Array<{ id: number; name: string; node: any }>
  currentNode: any
  hoverNode: any
}

const ONBOARDING_STORAGE_KEY = 'infinitespecies_onboardingSeen'

export default function App() {
  const hasStoredLanguage = getStoredLanguage() !== null
  const hasSeenOnboarding = () => localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true'
  const [language, setLanguage] = useState<AppLanguage>(() => getCurrentLanguage())
  const [languageModalOpen, setLanguageModalOpen] = useState(() => !hasStoredLanguage)
  const [onboardingOpen, setOnboardingOpen] = useState(() => hasStoredLanguage && !hasSeenOnboarding())
  const [appState, setAppState] = useState<AppState>({
    isLanding: true,
    isLoading: false,
    loadingTitle: translate('loading.defaultTitle', undefined, getCurrentLanguage()),
    loadingStage: translate('loading.stage', { current: 1, total: 1 }, getCurrentLanguage()),
    loadingProgress: 0,
    loadingPct: '0%',
    loadingTimer: '00:00',
    showTopbar: false,
    breadcrumbs: [],
    currentNode: null,
    hoverNode: null,
  })

  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [screenshotOpen, setScreenshotOpen] = useState(false)

  const toast = useToast()

  const loadingStartTime = useRef<number>(0)
  const timerInterval = useRef<number | null>(null)

  useEffect(() => {
    resizeCanvas()
    registerDrawCallback(draw)
  }, [])

  useEffect(() => {
    const handleHashChange = async () => {
      const hash = decodePath(location.hash.slice(1))
      if (!hash || !state.DATA_ROOT) return
      const node = await findNodeByPath(hash)
      if (node) {
        updateNavigation(node, true)
        updateBreadcrumbs(node)
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (languageModalOpen) return

      const target = e.target as HTMLElement
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable

      if (e.key === 'Escape' || e.code === 'Escape') {
        if (onboardingOpen) {
          e.preventDefault()
          dismissOnboarding()
          return
        }

        if (isTyping && target.tagName === 'TEXTAREA') {
          return
        }

        if (helpOpen) {
          e.preventDefault()
          setHelpOpen(false)
        } else if (aboutOpen) {
          e.preventDefault()
          setAboutOpen(false)
        }
        return
      }

      if (isTyping) return

      if (e.code === 'Slash' || e.key === '?' || e.code === 'F1') {
        e.preventDefault()
        setHelpOpen((prev: boolean) => !prev)
      } else if (e.code === 'KeyW') {
        e.preventDefault()
        const hoveredNode = state.hoverNode
        if (hoveredNode) {
          openProviderSearch(hoveredNode)
        } else {
          toast.info(translate('app.hoverToWebSearch', undefined, language))
        }
      } else if (e.code === 'KeyR') {
        e.preventDefault()
        handleReset()
      } else if (e.code === 'KeyF') {
        e.preventDefault()
        handleFit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [aboutOpen, helpOpen, language, languageModalOpen, onboardingOpen, toast])

  const updateBreadcrumbs = useCallback((node: any) => {
    if (!node) {
      setAppState((prev: AppState) => ({ ...prev, breadcrumbs: [], currentNode: null }))
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search)
      }
      document.documentElement.style.setProperty('--breadcrumbs-height', '0px')
      return
    }

    const crumbs: Array<{ id: number; name: string; node: any }> = []
    let current = node
    while (current) {
      crumbs.unshift({
        id: current._id,
        name: current.name,
        node: current,
      })
      current = current.parent
    }

    setAppState((prev: AppState) => ({ ...prev, breadcrumbs: crumbs, currentNode: node }))
    updateDeepLinkFromNode(node)
  }, [])

  useEffect(() => {
    const updateBreadcrumbsHeight = () => {
      const breadcrumbsEl = document.querySelector('.breadcrumbs') as HTMLElement | null
      if (breadcrumbsEl) {
        document.documentElement.style.setProperty('--breadcrumbs-height', `${breadcrumbsEl.offsetHeight}px`)
      } else {
        document.documentElement.style.setProperty('--breadcrumbs-height', '0px')
      }
    }

    updateBreadcrumbsHeight()
    const timer = setTimeout(updateBreadcrumbsHeight, 100)

    window.addEventListener('resize', updateBreadcrumbsHeight)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateBreadcrumbsHeight)
    }
  }, [appState.breadcrumbs])

  useEffect(() => {
    if (!appState.isLoading) {
      setAppState((prev: AppState) => ({
        ...prev,
        loadingTitle: translate('loading.defaultTitle', undefined, language),
        loadingStage: translate('loading.stage', { current: 1, total: 1 }, language),
      }))
    }
  }, [appState.isLoading, language])

  const showLoading = useCallback((title?: string) => {
    loadingStartTime.current = performance.now()
    setAppState((prev: AppState) => ({
      ...prev,
      isLoading: true,
      loadingTitle: title ?? translate('loading.defaultTitle', undefined, language),
      loadingStage: translate('loading.stage', { current: 1, total: 1 }, language),
      loadingProgress: 0,
      loadingPct: '0%',
      loadingTimer: '00:00',
    }))

    timerInterval.current = window.setInterval(() => {
      const elapsed = Math.floor((performance.now() - loadingStartTime.current) / 1000)
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0')
      const secs = (elapsed % 60).toString().padStart(2, '0')
      setAppState((prev: AppState) => ({ ...prev, loadingTimer: `${mins}:${secs}` }))
    }, 1000)
  }, [language])

  const hideLoading = useCallback(() => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
      timerInterval.current = null
    }
    setAppState((prev: AppState) => ({ ...prev, isLoading: false }))
  }, [])

  const updateProgress = useCallback((progress: number, label?: string, currentStage = 1, totalStages = 1) => {
    setAppState((prev: AppState) => ({
      ...prev,
      loadingProgress: progress,
      loadingPct: `${Math.round(progress)}%`,
      loadingStage: translate('loading.stage', { current: currentStage, total: totalStages }, language),
      ...(label && { loadingTitle: label }),
    }))
  }, [language])

  useEffect(() => {
    // @ts-ignore
    window.__reactShowLoading = showLoading
    // @ts-ignore
    window.__reactHideLoading = hideLoading
    // @ts-ignore
    window.__reactUpdateProgress = updateProgress
  }, [hideLoading, showLoading, updateProgress])

  const handleStartExploration = async () => {
    setAppState((prev: AppState) => ({ ...prev, isLanding: false, showTopbar: true }))

    const initialHash = decodePath(location.hash.slice(1))

    await new Promise((resolve) => setTimeout(resolve, 100))
    resizeCanvas()

    try {
      showLoading(translate('loading.loadingTaxonomy', undefined, language))

      const candidates = ['/data/manifest.json', 'data/manifest.json']

      for (const url of candidates) {
        try {
          console.log(`Attempting to load data from: ${url}`)
          await loadEager(url)
          hideLoading()

          state.layoutChanged = true

          if (initialHash && state.DATA_ROOT) {
            const targetNode = await findNodeByPath(initialHash)
            if (targetNode && targetNode !== state.DATA_ROOT) {
              await goToNode(targetNode, true)
              updateBreadcrumbs(targetNode)
            } else {
              fitNodeInView(state.DATA_ROOT)
              updateBreadcrumbs(state.DATA_ROOT)
            }
          } else if (state.DATA_ROOT) {
            fitNodeInView(state.DATA_ROOT)
            updateBreadcrumbs(state.DATA_ROOT)
          }

          tick()
          return
        } catch (err) {
          console.error(`Failed to load ${url}:`, err)
        }
      }

      hideLoading()
      console.error('Failed to load data from all candidates')
    } catch (err) {
      hideLoading()
      console.error('Error starting exploration:', err)
    }
  }

  const handleBackToMenu = async () => {
    setAppState((prev: AppState) => ({
      ...prev,
      isLanding: true,
      showTopbar: false,
      breadcrumbs: [],
    }))

    if (state.DATA_ROOT) {
      await goToNode(state.DATA_ROOT, false)
    }

    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }

  const handleReset = async () => {
    if (state.DATA_ROOT) {
      await goToNode(state.DATA_ROOT, true)
      updateBreadcrumbs(state.DATA_ROOT)
    }
  }

  const handleFit = () => {
    const targetNode = state.hoverNode || state.current || state.DATA_ROOT
    if (targetNode) {
      fitNodeInView(targetNode)
    }
  }

  const handleBreadcrumbClick = async (node: any) => {
    await goToNode(node, true)
    updateBreadcrumbs(node)
  }

  const handleBreadcrumbRandom = (rootNode: any) => {
    if (!rootNode?.children?.length) {
      toast.info(translate('breadcrumbs.noDeeperBranch', undefined, language))
      return
    }

    let node = rootNode
    let targetIndex = Math.floor(Math.random() * (node._leaves || 1))

    while (node.children && node.children.length > 0) {
      let nextNode = node.children[0]

      for (const child of node.children) {
        const weight = child._leaves || 1
        if (targetIndex < weight) {
          nextNode = child
          break
        }
        targetIndex -= weight
      }

      node = nextNode
    }

    if (node && node !== rootNode) {
      zoomToNode(node)
    }
  }

  const handleCopyLink = async () => {
    const url = new URL(location.href)
    const path = state.current ? getNodePath(state.current).join('/') : ''
    url.hash = path ? `#${encodeURIComponent(path)}` : ''

    try {
      await navigator.clipboard.writeText(url.toString())
      toast.success(translate('app.linkCopied', undefined, language))
    } catch {
      window.prompt(translate('app.copyLinkPrompt', undefined, language), url.toString())
    }
  }

  const handleLanguageSelect = (nextLanguage: AppLanguage) => {
    setCurrentLanguage(nextLanguage)
    setLanguage(nextLanguage)
    setLanguageModalOpen(false)
    if (!hasSeenOnboarding()) {
      setOnboardingOpen(true)
    }
  }

  const handleLanguageModalClose = () => {
    setLanguageModalOpen(false)
    if (!hasSeenOnboarding()) {
      setOnboardingOpen(true)
    }
  }

  const dismissOnboarding = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
    setOnboardingOpen(false)
  }

  return (
    <div className="app">
      <OnboardingModal
        isOpen={onboardingOpen}
        language={language}
        onClose={dismissOnboarding}
      />

      <LanguageModal
        isOpen={languageModalOpen}
        onSelect={handleLanguageSelect}
        onClose={handleLanguageModalClose}
      />

      <AnimatePresence>
        {appState.isLanding && (
          <LandingPage
            language={language}
            onStart={handleStartExploration}
            onLanguage={() => setLanguageModalOpen(true)}
            onHelp={() => setHelpOpen(true)}
            onAbout={() => setAboutOpen(true)}
            onSettings={() => setSettingsOpen(true)}
          />
        )}
      </AnimatePresence>

      {appState.showTopbar && (
      <Topbar
        language={language}
        onBackToMenu={handleBackToMenu}
        onCopyLink={handleCopyLink}
        onLanguage={() => setLanguageModalOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onHelp={() => setHelpOpen(true)}
          onUpdateBreadcrumbs={updateBreadcrumbs}
          onShowToast={toast.showToast}
        />
      )}

      {appState.showTopbar && appState.breadcrumbs.length > 0 && (
        <Breadcrumbs
          language={language}
          crumbs={appState.breadcrumbs}
          onCrumbClick={handleBreadcrumbClick}
          onRandomClick={handleBreadcrumbRandom}
        />
      )}

      <Stage
        language={language}
        isLoading={appState.isLoading}
        onUpdateBreadcrumbs={updateBreadcrumbs}
        hidden={appState.isLanding}
      />

      {appState.isLoading && (
        <LoadingOverlay
          language={language}
          title={appState.loadingTitle}
          stage={appState.loadingStage}
          progress={appState.loadingProgress}
          pct={appState.loadingPct}
          timer={appState.loadingTimer}
        />
      )}

      <AnimatePresence>
        {helpOpen && <HelpModal language={language} onClose={() => setHelpOpen(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {aboutOpen && <AboutModal language={language} onClose={() => setAboutOpen(false)} />}
      </AnimatePresence>

      <SettingsModal
        isOpen={settingsOpen}
        language={language}
        onLanguageChange={handleLanguageSelect}
        onClose={() => setSettingsOpen(false)}
      />

      <ScreenshotPanel
        language={language}
        isOpen={screenshotOpen}
        onClose={() => setScreenshotOpen(false)}
        onShowToast={toast.showToast}
      />

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  )
}
