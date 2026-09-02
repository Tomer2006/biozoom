/** Data-only preview service. React owns rendering and image lifecycle. */
import { getNodePath } from './deeplink'
import { logError, logWarn } from './logger'
import { perf } from './settings'
import type { TaxonomyNode } from './types'

export interface PreviewData {
  node: TaxonomyNode
  caption: string
  path: string
  thumbnail: string | null
  description: string | null
}

interface WikipediaPreview {
  thumbnail: string | null
  taxonomicRank: string | null
  description: string | null
}

interface WikipediaPage {
  missing?: unknown
  thumbnail?: { source?: string }
  extract?: string
  pageprops?: { wikibase_item?: string }
}

interface WikipediaResponse {
  query?: { pages?: Record<string, WikipediaPage> }
}

interface WikidataResponse {
  results?: { bindings?: Array<{ rankLabel?: { value?: string } }> }
}

const thumbnailCache = new Map<string, Promise<WikipediaPreview | null> | WikipediaPreview | null>()

function remember(key: string, value: Promise<WikipediaPreview | null> | WikipediaPreview | null) {
  thumbnailCache.delete(key)
  thumbnailCache.set(key, value)
  while (thumbnailCache.size > perf.preview.maxThumbnails) {
    const oldest = thumbnailCache.keys().next().value as string | undefined
    if (oldest === undefined) break
    thumbnailCache.delete(oldest)
  }
}

async function getTaxonomicRank(wikidataId?: string): Promise<string | null> {
  if (!wikidataId) return null
  try {
    const query = `SELECT ?rank ?rankLabel WHERE { wd:${wikidataId} wdt:P105 ?rank . ?rank rdfs:label ?rankLabel . FILTER(LANG(?rankLabel) = "en") }`
    const response = await fetch(
      `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`,
      { headers: { Accept: 'application/json' } },
    )
    if (!response.ok) return null
    const data = await response.json() as WikidataResponse
    return data.results?.bindings?.[0]?.rankLabel?.value ?? null
  } catch (error) {
    logWarn('Error fetching Wikidata rank', error)
    return null
  }
}

async function fetchWikipediaPreview(title: string): Promise<WikipediaPreview | null> {
  const key = title.toLocaleLowerCase()
  const cached = thumbnailCache.get(key)
  if (cached !== undefined) {
    remember(key, cached)
    return cached
  }

  const pending = (async (): Promise<WikipediaPreview | null> => {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages|extracts|pageprops&titles=${encodeURIComponent(title)}&piprop=thumbnail&pithumbsize=500&exintro=1&explaintext=1&redirects=1`
      const response = await fetch(url)
      if (!response.ok) return null
      const data = await response.json() as WikipediaResponse
      const pages = data.query?.pages
      if (!pages) return null
      const [pageId] = Object.keys(pages)
      const page = pageId ? pages[pageId] : undefined
      if (!page || pageId === '-1' || page.missing) return null
      return {
        thumbnail: page.thumbnail?.source ?? null,
        taxonomicRank: await getTaxonomicRank(page.pageprops?.wikibase_item),
        description: page.extract ?? null,
      }
    } catch (error) {
      logError('Error fetching Wikipedia data', error)
      return null
    }
  })()

  remember(key, pending)
  const result = await pending
  remember(key, result)
  return result
}

export async function loadPreview(node: TaxonomyNode): Promise<PreviewData> {
  const result = await fetchWikipediaPreview(node.name)
  const rank = result?.taxonomicRank
  return {
    node,
    caption: rank ? `${node.name} (${rank})` : node.name,
    path: getNodePath(node).join(' > '),
    thumbnail: result?.thumbnail && /^https?:\/\//i.test(result.thumbnail) ? result.thumbnail : null,
    description: result?.description ?? null,
  }
}
