import { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import LandingPage from './components/LandingPage'
import Topbar from './components/Topbar'
import Breadcrumbs from './components/Breadcrumbs'
import Stage from './components/Stage'
import LoadingOverlay from './components/LoadingOverlay'
import HelpModal from './components/HelpModal'
import AboutModal from './components/AboutModal'
import SettingsModal from './components/SettingsModal'
import ScreenshotPanel from './components/ScreenshotPanel'
import ToastContainer from './components/Toast'
import { useToast } from './hooks/useToast'

// Import the existing visualization modules
import { state } from './modules/state'
import { resizeCanvas, registerDrawCallback, tick } from './modules/canvas'
import { draw } from './modules/render'
import { loadEager } from './modules/data'
import { decodePath, findNodeByPath, getNodePath, updateDeepLinkFromNode } from './modules/deeplink'
import { updateNavigation, fitNodeInView, goToNode } from './modules/navigation'
import { openProviderSearch } from './modules/providers'

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

export default function App() {
  const [appState, setAppState] = useState<AppState>({
    isLanding: true,
    isLoading: false,
    loadingTitle: 'Loading…',
    loadingStage: 'Stage 1 of 1',
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

  // Initialize canvas and render
  useEffect(() => {
    resizeCanvas()
    registerDrawCallback(draw)
  }, [])

  // Handle deep links
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable

      // Handle Escape key - close modals or clear search
      if (e.key === 'Escape' || e.code === 'Escape') {
        // Allow Escape to work normally in text inputs
        if (isTyping && target.tagName === 'TEXTAREA') {
          return // Let textarea handle Escape normally
        }
        
        // Close modals in order of priority
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
      } else if (e.code === 'KeyS') {
        e.preventDefault()
        const target = state.hoverNode || state.current || state.DATA_ROOT
        if (target) {
          openProviderSearch(target)
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
  }, [helpOpen, aboutOpen])

  const updateBreadcrumbs = useCallback((node: any) => {
    if (!node) {
      // Clear breadcrumbs and URL when node is null
      setAppState((prev: AppState) => ({ ...prev, breadcrumbs: [], currentNode: null }))
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search)
      }
      // Update CSS variable for breadcrumbs height
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
    
    // Update URL hash when breadcrumbs change (only from mouse hover, not from clicks)
    updateDeepLinkFromNode(node)
  }, [])
  
  // Update CSS variable for breadcrumbs height when breadcrumbs change
  useEffect(() => {
    const updateBreadcrumbsHeight = () => {
      const breadcrumbsEl = document.querySelector('.breadcrumbs') as HTMLElement
      if (breadcrumbsEl) {
        const height = breadcrumbsEl.offsetHeight
        document.documentElement.style.setProperty('--breadcrumbs-height', `${height}px`)
      } else {
        document.documentElement.style.setProperty('--breadcrumbs-height', '0px')
      }
    }
    
    // Update immediately and after a short delay to account for rendering
    updateBreadcrumbsHeight()
    const timer = setTimeout(updateBreadcrumbsHeight, 100)
    
    // Also update on window resize
    window.addEventListener('resize', updateBreadcrumbsHeight)
    
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateBreadcrumbsHeight)
    }
  }, [appState.breadcrumbs])

  const showLoading = useCallback((title: string) => {
    loadingStartTime.current = performance.now()
    setAppState((prev: AppState) => ({
      ...prev,
      isLoading: true,
      loadingTitle: title,
      loadingProgress: 0,
      loadingPct: '0%',
      loadingTimer: '00:00',
    }))

    // Start timer
    timerInterval.current = window.setInterval(() => {
      const elapsed = Math.floor((performance.now() - loadingStartTime.current) / 1000)
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0')
      const secs = (elapsed % 60).toString().padStart(2, '0')
      setAppState((prev: AppState) => ({ ...prev, loadingTimer: `${mins}:${secs}` }))
    }, 1000)
  }, [])

  const hideLoading = useCallback(() => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
      timerInterval.current = null
    }
    setAppState((prev: AppState) => ({ ...prev, isLoading: false }))
  }, [])

  const updateProgress = useCallback((progress: number, label?: string, stage?: string) => {
    setAppState((prev: AppState) => ({
      ...prev,
      loadingProgress: progress,
      loadingPct: `${Math.round(progress)}%`,
      ...(label && { loadingTitle: label }),
      ...(stage && { loadingStage: stage }),
    }))
  }, [])

  // Override the loading module's functions
  useEffect(() => {
    // @ts-ignore
    window.__reactShowLoading = showLoading
    // @ts-ignore
    window.__reactHideLoading = hideLoading
    // @ts-ignore
    window.__reactUpdateProgress = updateProgress
  }, [showLoading, hideLoading, updateProgress])

  const handleStartExploration = async () => {
    setAppState((prev: AppState) => ({ ...prev, isLanding: false, showTopbar: true }))
    
    // Save the initial hash before loading (for deep linking)
    const initialHash = decodePath(location.hash.slice(1))
    
    // Wait for canvas to be ready
    await new Promise(resolve => setTimeout(resolve, 100))
    resizeCanvas()
    
    try {
      showLoading('Loading taxonomy data…')

      // Try to load default data - try both absolute and relative paths
      // Vite serves public/ folder from root, so both should work
      const candidates = ['/data/manifest.json', 'data/manifest.json']
      
      for (const url of candidates) {
        try {
          console.log(`Attempting to load data from: ${url}`)
          await loadEager(url)
          hideLoading()
          
          state.layoutChanged = true
          
          // Check if there's a deep link in the URL and navigate to it
          if (initialHash && state.DATA_ROOT) {
            const targetNode = await findNodeByPath(initialHash)
            if (targetNode && targetNode !== state.DATA_ROOT) {
              // Navigate to the deep linked node
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

      // All failed
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

    // Reset state
    if (state.DATA_ROOT) {
      await goToNode(state.DATA_ROOT, false)
    }

    // Clear URL hash
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
    const target = state.hoverNode || state.current || state.DATA_ROOT
    if (target) {
      fitNodeInView(target)
    }
  }

  const handleBreadcrumbClick = async (node: any) => {
    await goToNode(node, true)
    updateBreadcrumbs(node)
  }

  const handleCopyLink = async () => {
    const url = new URL(location.href)
    const path = state.current ? getNodePath(state.current).join('/') : ''
    url.hash = path ? `#${encodeURIComponent(path)}` : ''
    
    try {
      await navigator.clipboard.writeText(url.toString())
      toast.success('Link copied to clipboard')
    } catch {
      window.prompt('Copy link:', url.toString())
    }
  }

  const handleScreenshot = () => {
    setScreenshotOpen(true)
  }


  return (
    <div className="app">
      <AnimatePresence>
        {appState.isLanding && (
          <LandingPage
            onStart={handleStartExploration}
            onHelp={() => setHelpOpen(true)}
            onAbout={() => setAboutOpen(true)}
            onSettings={() => setSettingsOpen(true)}
          />
        )}
      </AnimatePresence>

      {appState.showTopbar && (
        <Topbar
          onBackToMenu={handleBackToMenu}
          onCopyLink={handleCopyLink}
          onScreenshot={handleScreenshot}
          onSettings={() => setSettingsOpen(true)}
          onHelp={() => setHelpOpen(true)}
          onUpdateBreadcrumbs={updateBreadcrumbs}
          onShowToast={toast.showToast}
        />
      )}

      {appState.showTopbar && appState.breadcrumbs.length > 0 && (
        <Breadcrumbs
          crumbs={appState.breadcrumbs}
          onCrumbClick={handleBreadcrumbClick}
        />
      )}

      <Stage
        isLoading={appState.isLoading}
        onUpdateBreadcrumbs={updateBreadcrumbs}
        hidden={appState.isLanding}
      />

      {appState.isLoading && (
        <LoadingOverlay
          title={appState.loadingTitle}
          stage={appState.loadingStage}
          progress={appState.loadingProgress}
          pct={appState.loadingPct}
          timer={appState.loadingTimer}
        />
      )}

      <AnimatePresence>
        {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      </AnimatePresence>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <ScreenshotPanel
        isOpen={screenshotOpen}
        onClose={() => setScreenshotOpen(false)}
        onShowToast={toast.showToast}
      />

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  )
}

