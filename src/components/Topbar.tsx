import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Show, SignInButton, UserButton } from '@clerk/react'
import { processSearchResults } from '../modules/search'
import { performSearch, handleSingleSearchResult, handleSearchResultClick } from '../modules/search-handler'
import { translate, type AppLanguage } from '../modules/i18n'

interface TaxonomyNode {
  _id: number
  name: string
  level: number
  children?: TaxonomyNode[]
  parent?: TaxonomyNode | null
  _leaves?: number
  _vx?: number
  _vy?: number
  _vr?: number
}

interface TopbarProps {
  language: AppLanguage
  authEnabled: boolean
  onBackToMenu: () => void
  onCopyLink: () => void
  onLanguage: () => void
  onSettings: () => void
  onHelp: () => void
  onUpdateBreadcrumbs: (node: TaxonomyNode) => void
  onShowToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error', duration?: number) => string
}

interface SearchResult {
  _id: number
  name: string
  path: string
  node: any
}

function highlightMatchJSX(text: string, query: string): (string | ReactNode)[] {
  if (!query) return [text]
  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()
  const index = textLower.indexOf(queryLower)

  if (index === -1) {
    const parts: (string | ReactNode)[] = []
    let lastIdx = 0
    let queryIdx = 0

    for (let i = 0; i < text.length && queryIdx < query.length; i++) {
      if (textLower[i] === queryLower[queryIdx]) {
        if (i > lastIdx) {
          parts.push(text.slice(lastIdx, i))
        }
        parts.push(<mark key={`${i}-${queryIdx}`}>{text[i]}</mark>)
        lastIdx = i + 1
        queryIdx++
      }
    }

    if (queryIdx === query.length && lastIdx < text.length) {
      parts.push(text.slice(lastIdx))
    }

    return queryIdx === query.length ? parts : [text]
  }

  const before = text.slice(0, index)
  const match = text.slice(index, index + query.length)
  const after = text.slice(index + query.length)
  return [before, <mark key="match">{match}</mark>, after]
}

function TopbarAuth({ language }: { language: AppLanguage }) {
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button className="btn topbar-auth-btn" title={translate('auth.signIn', undefined, language)}>
            <span className="topbar-auth-avatar" aria-hidden="true">C</span>
            <span className="topbar-auth-label">{translate('auth.signInShort', undefined, language)}</span>
          </button>
        </SignInButton>
      </Show>

      <Show when="signed-in">
        <div className="topbar-user-button" title={translate('auth.manageAccount', undefined, language)}>
          <UserButton showName />
        </div>
      </Show>
    </>
  )
}

export default function Topbar({
  language,
  authEnabled,
  onBackToMenu,
  onCopyLink,
  onLanguage,
  onSettings,
  onHelp,
  onUpdateBreadcrumbs,
  onShowToast,
}: TopbarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [activeResultIndex, setActiveResultIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const resultItemRefs = useRef<Array<HTMLDivElement | null>>([])
  const searchResultsId = useId()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const handleClear = () => {
    setSearchQuery('')
    setSearchResults([])
    setShowResults(false)
    setActiveResultIndex(-1)
  }

  useEffect(() => {
    if (!showResults || activeResultIndex < 0) {
      return
    }

    resultItemRefs.current[activeResultIndex]?.scrollIntoView({
      block: 'nearest',
    })
  }, [activeResultIndex, showResults])

  const selectSearchResult = (result: SearchResult) => {
    handleSearchResultClick(result.node)
    setShowResults(false)
    setSearchQuery('')
    setSearchResults([])
    setActiveResultIndex(-1)
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
  }, [showResults])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    const result = await performSearch(searchQuery, onShowToast)

    if (!result.hasResults) {
      setSearchResults([])
      setShowResults(false)
      setActiveResultIndex(-1)
      onShowToast(translate('topbar.noResults', undefined, language), 'warning')
      return
    }

    if (result.singleResult) {
      handleSingleSearchResult(result.matches[0], onUpdateBreadcrumbs)
      setShowResults(false)
      setSearchQuery('')
      setSearchResults([])
      setActiveResultIndex(-1)
    } else {
      const results: SearchResult[] = processSearchResults(result.matches, searchQuery)
      setSearchResults(results)
      setShowResults(true)
      setActiveResultIndex(results.length > 0 ? 0 : -1)
    }
  }

  const handleResultClick = (result: SearchResult) => {
    selectSearchResult(result)
  }

  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value)

    if (showResults || searchResults.length > 0) {
      setShowResults(false)
      setSearchResults([])
      setActiveResultIndex(-1)
    }
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
        selectSearchResult(searchResults[activeResultIndex])
        return
      }

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
        <div className="topbar-brand" onClick={onBackToMenu} title={translate('topbar.returnToMenu', undefined, language)} style={{ cursor: 'pointer' }}>
          <span>InfiniteSpecies</span>
        </div>
      </div>

      <div className="topbar-center">
        <div className="searchbar" ref={searchRef}>
          <input
            ref={searchInputRef}
            className="searchbar-input"
            type="search"
            dir="auto"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showResults}
            aria-controls={showResults ? searchResultsId : undefined}
            aria-activedescendant={
              showResults && activeResultIndex >= 0
                ? `${searchResultsId}-option-${searchResults[activeResultIndex]?._id}`
                : undefined
            }
            placeholder={translate('topbar.searchPlaceholder', undefined, language)}
            value={searchQuery}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) {
                setShowResults(true)
              }
            }}
            onKeyDown={handleSearchInputKeyDown}
          />
          <button className="searchbar-btn" onClick={handleSearch} title={translate('topbar.searchButton', undefined, language)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>

          {showResults && searchResults.length > 0 && (
            <div className="search-results" id={searchResultsId} role="listbox">
              {searchResults.map((result, index) => (
                <div
                  key={result._id}
                  id={`${searchResultsId}-option-${result._id}`}
                  ref={(element) => {
                    resultItemRefs.current[index] = element
                  }}
                  className={`search-result-item${index === activeResultIndex ? ' active' : ''}`}
                  role="option"
                  aria-selected={index === activeResultIndex}
                  onMouseEnter={() => setActiveResultIndex(index)}
                  onClick={() => handleResultClick(result)}
                >
                  <div className="search-result-name">{highlightMatchJSX(result.name, searchQuery)}</div>
                  {result.path && <div className="search-result-path">{highlightMatchJSX(result.path, searchQuery)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="topbar-right">
        {authEnabled && (
          <TopbarAuth language={language} />
        )}
        <button className="btn btn-icon" onClick={onLanguage} title={translate('common.language', undefined, language)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3a15 15 0 0 1 0 18" />
            <path d="M12 3a15 15 0 0 0 0 18" />
          </svg>
        </button>
        <button className="btn btn-icon" onClick={onCopyLink} title={translate('topbar.copyLink', undefined, language)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
        <button className="btn btn-icon" onClick={onHelp} title={translate('topbar.helpButton', undefined, language)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>
        <button className="btn btn-icon" onClick={onSettings} title={translate('topbar.settingsButton', undefined, language)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </header>
  )
}
