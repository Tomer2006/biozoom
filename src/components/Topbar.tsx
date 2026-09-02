import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { processSearchResults } from '../modules/search'
import { handleSearchResultClick, performSearch, prefetchSearchResult } from '../modules/search-handler'
import { translate, type AppLanguage } from '../modules/i18n'
import { isPerfLabSecretCode } from '../modules/runtimeSettings'
import { perf } from '../modules/settings'
import type { SearchResult } from '../modules/types'
import { useTaxonomyState } from '../hooks/useTaxonomyState'

interface TopbarProps {
  language: AppLanguage
  onBackToMenu: () => void
  onCopyLink: () => void
  onLanguage: () => void
  onSettings: () => void
  onSettingsLab: () => void
  onHelp: () => void
}

function LanguageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18" />
      <path d="M12 3a15 15 0 0 0 0 18" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function highlightMatchJSX(text: string, query: string): (string | ReactNode)[] {
  if (!query) return [text]
  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()
  const index = textLower.indexOf(queryLower)

  if (index === -1) return [text]

  const before = text.slice(0, index)
  const match = text.slice(index, index + query.length)
  const after = text.slice(index + query.length)
  return [before, <mark key="match">{match}</mark>, after]
}

function TopbarMenu({
  language,
  onLanguage,
  onSettings,
}: {
  language: AppLanguage
  onLanguage: () => void
  onSettings: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.code === 'Escape') {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <div className="topbar-menu" ref={menuRef}>
      <button
        className="btn btn-icon topbar-menu-btn"
        type="button"
        title={translate('topbar.settingsButton', undefined, language)}
        aria-label={translate('topbar.settingsButton', undefined, language)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((current) => !current)}
      >
        <SettingsIcon />
      </button>

      {menuOpen && (
        <div className="topbar-menu-dropdown" role="menu">
          <button
            className="topbar-menu-item"
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false)
              onLanguage()
            }}
          >
            <LanguageIcon />
            <span>{translate('common.language', undefined, language)}</span>
          </button>

          <button
            className="topbar-menu-item"
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false)
              onSettings()
            }}
          >
            <SettingsIcon />
            <span>{translate('topbar.settingsButton', undefined, language)}</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default function Topbar({
  language,
  onBackToMenu,
  onCopyLink,
  onLanguage,
  onSettings,
  onSettingsLab,
  onHelp,
}: TopbarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [activeResultIndex, setActiveResultIndex] = useState(-1)
  const [resultsQuery, setResultsQuery] = useState('')
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'results' | 'no-results' | 'error' | 'too-short'>('idle')
  const [navigatingResultId, setNavigatingResultId] = useState<number | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const resultItemRefs = useRef<Array<HTMLDivElement | null>>([])
  const searchControllerRef = useRef<AbortController | null>(null)
  const searchTimerRef = useRef<number | null>(null)
  const searchSequenceRef = useRef(0)
  const searchResultsId = useId()
  const { loadMode } = useTaxonomyState()
  const liveSearchEnabled = loadMode === 'backend'

  const handleClear = useCallback(() => {
    searchSequenceRef.current++
    searchControllerRef.current?.abort()
    searchControllerRef.current = null
    if (searchTimerRef.current !== null) window.clearTimeout(searchTimerRef.current)
    searchTimerRef.current = null
    setSearchQuery('')
    setSearchResults([])
    setResultsQuery('')
    setShowResults(false)
    setSearchStatus('idle')
    setActiveResultIndex(-1)
    setNavigatingResultId(null)
  }, [])

  const executeSearch = useCallback(async (rawQuery: string) => {
    const query = rawQuery.trim().replace(/\s+/g, ' ').slice(0, 100)
    if (query.length < 2) return

    const sequence = ++searchSequenceRef.current
    searchControllerRef.current?.abort()
    const controller = new AbortController()
    searchControllerRef.current = controller
    setSearchStatus('loading')
    setShowResults(true)

    try {
      const result = await performSearch(query, { signal: controller.signal })
      if (controller.signal.aborted || sequence !== searchSequenceRef.current) return

      const results: SearchResult[] = processSearchResults(result.matches, query)
      setSearchResults(results)
      setResultsQuery(query)
      setSearchStatus(results.length > 0 ? 'results' : 'no-results')
      setShowResults(true)
      setActiveResultIndex(results.length > 0 ? 0 : -1)
      if (results[0]) void prefetchSearchResult(results[0].node).catch(() => {})
    } catch (error) {
      if (controller.signal.aborted || sequence !== searchSequenceRef.current) return
      console.error('Search failed:', error)
      setSearchResults([])
      setResultsQuery(query)
      setSearchStatus('error')
      setShowResults(true)
      setActiveResultIndex(-1)
    } finally {
      if (sequence === searchSequenceRef.current) searchControllerRef.current = null
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  useEffect(() => () => {
    searchSequenceRef.current++
    searchControllerRef.current?.abort()
    if (searchTimerRef.current !== null) window.clearTimeout(searchTimerRef.current)
  }, [])

  useEffect(() => {
    if (!showResults || activeResultIndex < 0) {
      return
    }

    resultItemRefs.current[activeResultIndex]?.scrollIntoView({
      block: 'nearest',
    })
    const result = searchResults[activeResultIndex]
    if (result) void prefetchSearchResult(result.node).catch(() => {})
  }, [activeResultIndex, searchResults, showResults])

  const selectSearchResult = async (result: SearchResult) => {
    if (navigatingResultId !== null) return
    setNavigatingResultId(result._id)
    try {
      await handleSearchResultClick(result.node)
      handleClear()
    } catch (error) {
      console.error('Search navigation failed:', error)
      setNavigatingResultId(null)
      setSearchStatus('error')
      setShowResults(true)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isSearchFocused = document.activeElement === searchInputRef.current
      if ((e.key === 'Escape' || e.code === 'Escape') && (isSearchFocused || showResults)) {
        e.preventDefault()
        handleClear()
        searchInputRef.current?.blur()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleClear, showResults])

  useEffect(() => {
    if (!liveSearchEnabled) return
    if (searchTimerRef.current !== null) window.clearTimeout(searchTimerRef.current)

    const query = searchQuery.trim()
    if (query.length < 2 || isPerfLabSecretCode(query)) return

    searchTimerRef.current = window.setTimeout(() => {
      searchTimerRef.current = null
      void executeSearch(query)
    }, perf.timing.searchDebounceMs)

    return () => {
      if (searchTimerRef.current !== null) window.clearTimeout(searchTimerRef.current)
      searchTimerRef.current = null
    }
  }, [executeSearch, liveSearchEnabled, searchQuery])

  const handleSearch = () => {
    const query = searchQuery.trim()
    if (!query) return

    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current)
      searchTimerRef.current = null
    }

    if (isPerfLabSecretCode(query)) {
      handleClear()
      onSettingsLab()
      return
    }

    if (query.length < 2) {
      setSearchStatus('too-short')
      setShowResults(true)
      return
    }
    void executeSearch(query)
  }

  const handleResultClick = (result: SearchResult) => {
    void selectSearchResult(result)
  }

  const handleSearchInputChange = (value: string) => {
    const nextValue = value.slice(0, 100)
    searchSequenceRef.current++
    searchControllerRef.current?.abort()
    searchControllerRef.current = null
    setSearchQuery(nextValue)
    setSearchResults([])
    setResultsQuery('')
    setActiveResultIndex(-1)
    setNavigatingResultId(null)
    const shouldSearch = liveSearchEnabled && nextValue.trim().length >= 2 && !isPerfLabSecretCode(nextValue)
    setSearchStatus(shouldSearch ? 'loading' : 'idle')
    setShowResults(shouldSearch)
  }

  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && showResults && searchResults.length > 0) {
      e.preventDefault()
      setActiveResultIndex((currentIndex) => {
        if (currentIndex < 0) {
          return 0
        }
        return (currentIndex + 1) % searchResults.length
      })
      return
    }

    if (e.key === 'ArrowUp' && showResults && searchResults.length > 0) {
      e.preventDefault()
      setActiveResultIndex((currentIndex) => {
        if (currentIndex < 0) {
          return searchResults.length - 1
        }
        return (currentIndex - 1 + searchResults.length) % searchResults.length
      })
      return
    }

    if (e.key === 'Home' && showResults && searchResults.length > 0) {
      e.preventDefault()
      setActiveResultIndex(0)
      return
    }

    if (e.key === 'End' && showResults && searchResults.length > 0) {
      e.preventDefault()
      setActiveResultIndex(searchResults.length - 1)
      return
    }

    if (e.key === 'Enter') {
      if (showResults && activeResultIndex >= 0 && activeResultIndex < searchResults.length) {
        e.preventDefault()
        void selectSearchResult(searchResults[activeResultIndex])
        return
      }

      e.preventDefault()
      handleSearch()
      return
    }

    if (e.key === 'Escape') {
      handleClear()
      searchInputRef.current?.blur()
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="topbar-brand"
          type="button"
          onClick={onBackToMenu}
          title={translate('topbar.returnToMenu', undefined, language)}
        >
          <span>InfiniteSpecies</span>
        </button>
      </div>

      <div className="topbar-center">
        <div className="searchbar" ref={searchRef} aria-busy={searchStatus === 'loading' || navigatingResultId !== null}>
          <input
            ref={searchInputRef}
            className="searchbar-input"
            type="search"
            dir="auto"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showResults}
            aria-controls={showResults && searchStatus === 'results' ? searchResultsId : undefined}
            aria-activedescendant={
              showResults && activeResultIndex >= 0
                ? `${searchResultsId}-option-${searchResults[activeResultIndex]?._id}`
                : undefined
            }
            placeholder={translate('topbar.searchPlaceholder', undefined, language)}
            value={searchQuery}
            maxLength={100}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            onKeyDown={handleSearchInputKeyDown}
          />
          <button
            className={`searchbar-btn${searchStatus === 'loading' || navigatingResultId !== null ? ' is-loading' : ''}`}
            type="button"
            onClick={handleSearch}
            title={translate('topbar.searchButton', undefined, language)}
            aria-label={translate('topbar.searchButton', undefined, language)}
          >
            {searchStatus === 'loading' || navigatingResultId !== null ? (
              <span className="search-spinner" aria-hidden="true" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            )}
          </button>

          {showResults && searchStatus === 'loading' && (
            <div className="search-results search-results-message" role="status" aria-live="polite">
              <span className="search-spinner" aria-hidden="true" />
              <span>{translate('topbar.searching', undefined, language)}</span>
            </div>
          )}

          {showResults && searchStatus === 'no-results' && (
            <div className="search-results search-results-message" role="status" aria-live="polite">
              {translate('topbar.noResults', undefined, language)}
            </div>
          )}

          {showResults && searchStatus === 'error' && (
            <div className="search-results search-results-message search-results-error" role="alert">
              {translate('topbar.searchError', undefined, language)}
            </div>
          )}

          {showResults && searchStatus === 'too-short' && (
            <div className="search-results search-results-message" role="status" aria-live="polite">
              {translate('topbar.searchMinCharacters', undefined, language)}
            </div>
          )}

          {showResults && searchStatus === 'results' && searchResults.length > 0 && (
            <div className="search-results" id={searchResultsId} role="listbox">
              {searchResults.map((result, index) => (
                <div
                  key={result._id}
                  id={`${searchResultsId}-option-${result._id}`}
                  ref={(element) => {
                    resultItemRefs.current[index] = element
                  }}
                  className={`search-result-item${index === activeResultIndex ? ' active' : ''}${navigatingResultId === result._id ? ' is-navigating' : ''}`}
                  role="option"
                  aria-selected={index === activeResultIndex}
                  aria-busy={navigatingResultId === result._id}
                  onMouseEnter={() => {
                    setActiveResultIndex(index)
                    void prefetchSearchResult(result.node).catch(() => {})
                  }}
                  onClick={() => handleResultClick(result)}
                >
                  <div className="search-result-name">{highlightMatchJSX(result.name, resultsQuery)}</div>
                  {result.path && <div className="search-result-path">{highlightMatchJSX(result.path, resultsQuery)}</div>}
                  {navigatingResultId === result._id && <span className="search-spinner search-result-spinner" aria-hidden="true" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="topbar-right">
        <TopbarMenu
          language={language}
          onLanguage={onLanguage}
          onSettings={onSettings}
        />
        <button
          className="btn btn-icon"
          type="button"
          onClick={onCopyLink}
          title={translate('topbar.copyLink', undefined, language)}
          aria-label={translate('topbar.copyLink', undefined, language)}
        >
          <ShareIcon />
        </button>
        <button
          className="btn btn-icon"
          type="button"
          onClick={onHelp}
          title={translate('topbar.helpButton', undefined, language)}
          aria-label={translate('topbar.helpButton', undefined, language)}
        >
          <HelpIcon />
        </button>
      </div>
    </header>
  )
}
