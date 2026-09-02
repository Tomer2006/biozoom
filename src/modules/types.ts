/** Shared domain types for the framework-independent taxonomy engine. */

export type LoadMode = 'eager' | 'backend'

export interface Point {
  x: number
  y: number
}

export interface Camera extends Point {
  k: number
}

export interface TaxonomyNode {
  _id: number
  name: string
  level: number | string
  children: TaxonomyNode[]
  parent: TaxonomyNode | null
  _vx: number
  _vy: number
  _vr: number
  _leaves: number
  _hasChildren?: boolean
  _loadedDepth?: number
  _labelTopSpaceWorld?: number
  _searchPath?: string
}

export interface TaxonomyLayout {
  root: TaxonomyNode
  diameter: number
}

export interface TaxonomyState {
  DATA_ROOT: TaxonomyNode | null
  current: TaxonomyNode | null
  layout: TaxonomyLayout | null
  rootLayout: TaxonomyLayout | null
  globalId: number
  maxNodeRadius: number
  minNodeRadius: number
  camera: Camera
  targetCam: Camera
  cameraAnimationId: number
  animating: boolean
  hoverNode: TaxonomyNode | null
  nodeLayoutMap: Map<number, TaxonomyNode>
  pickOrder: TaxonomyNode[]
  visibleNodes: TaxonomyNode[]
  layoutChanged: boolean
  loadMode: LoadMode
  backendApiBase: string
  useBakedLayout: boolean
}

export interface SearchResult {
  _id: number
  name: string
  path: string
  node: TaxonomyNode
}
