## Taxonomy Explorer (BioZoom)

Interactive circle‑packing explorer for biological taxonomy powered by D3.

### Live demo
- Visit the live site: [biozoom.netlify.app](https://biozoom.netlify.app/)

### Features
- **Zoomable circles**: Explore from `Life` down to `Species`.
- **Local search** with highlight pulses.
- **Web search** integration (Google, Wikipedia, GBIF, NCBI, CoL, iNaturalist).
- **Custom JSON loading** via modal (paste or file).
- **Demo data** generator for instant play.
- **Deep links**: URL hash tracks the current path; use Copy Link to share the exact view.
- **PNG export**: Snapshot the current view. (Planned)
 

### Quick start
- Fastest: open `index.html` directly (demo data loads if `fetch` is blocked on `file://`).
- Recommended: serve the folder to enable loading `tree.json` and external JSON.
  - Python 3: `python -m http.server 8080`
  - Node: `npx http-server -p 8080`
  - Then visit `http://localhost:8080/`

### Controls
- **Left Click**: Zoom into a group
- **Right Click**: Zoom to parent
- **Mouse Wheel**: Smooth zoom
- **Middle Drag**: Pan
- **Keyboard S**: Web search hovered/current node
- **Keyboard R**: Reset to root
- **Keyboard F**: Fit hovered/current node in view
- **Keyboard P**: Pin/unpin image preview
- **Keyboard ? / F1**: Toggle help

### UI overview
- **Top bar**:
  - `Load JSON`: paste or upload a JSON file
  - `Demo Data`: build a synthetic tree
  - Provider select + `Web Search`: open selected provider for hovered/current node
  - Search field: find by name (supports partial matches)
  - `Surprise Me`: jump to a random deepest leaf
  - `Fit`: fit hovered/current node into view
  - `Copy Link`: copy a deep link to the current view (URL hash)
  - `Export PNG`: snapshot the canvas
  - `Reset`: back to root
- **Breadcrumbs**: click any crumb to navigate up (also updates the URL hash for deep linking)

### Data loading
On startup, the app tries (in order):
1) URL query `?data=...` (absolute or relative)
2) `tree.json`
3) `taxonomy.json`
4) `data.json`

If none are loaded (e.g., `file://` CORS), it falls back to demo data.

#### Supported JSON schemas
1) Structured nodes (preferred):
```json
{ "name": "Life", "level": "Life", "children": [ { "name": "Eukarya", "children": [...] } ] }
```
2) Nested key map (auto-transformed):
```json
{ "Life": { "Eukarya": { "Animalia": { "Chordata": { "Mammalia": { "Primates": { "Hominidae": { "Homo sapiens": {} }}}}}}} }
```

Notes:
- `level` is optional; it will be inferred by depth (`Life → Domain → Kingdom → …`).
- Leaves can be empty objects or nodes without `children`.

#### Load custom JSON
- Click `Load JSON` → paste JSON or choose a `.json` file → `Parse & Load`.
- Or host your JSON and use `index.html?data=https%3A%2F%2Fexample.com%2Ftaxonomy.json`.

### How it works
- D3 `pack()` produces circle positions/sizes; circle size ≈ number of descendant leaves.
- Label placement prioritizes larger labels and avoids overlap.
- Camera supports smooth pan/zoom with easing.

### Project layout
- `index.html`: UI skeleton and includes D3; loads `app-modular.js` (ES modules)
- `styles.css`: theme and layout
- `app-modular.js`: entry that wires modules and initializes the app
- `modules/`: modular source files
  - `constants.js`: levels, palette, render thresholds
  - `dom.js`: references to DOM elements
  - `state.js`: shared app state and indexes
  - `canvas.js`: canvas/context sizing, transforms, RAF
  - `layout.js`: D3 pack layout and coordinate prep
  - `camera.js`: pan/zoom animations
  - `picking.js`: hit testing and visibility checks
  - `render.js`: draw circles, labels, and highlight
  - `deeplink.js`: encode/decode/update URL hash, find by path
  - `navigation.js`: breadcrumbs, go-to-node, fit-in-view
  - `providers.js`: external provider URLs, open search
  - `preview.js`: Wikipedia thumbs, big preview show/hide
  - `tooltip.js`: tooltip and hover preview trigger
  - `search.js`: local search and pulse highlight
  - `loading.js`: loading overlay and progress helpers
  - `events.js`: mouse, wheel, keyboard, buttons, modals
- `tree.json`: sample nested-key dataset

### Deep links and sharing
- The URL hash encodes the path to the current node (e.g., `#/Life/Eukarya/Animalia/...`).
- Use `Copy Link` to copy a URL you can share; opening it restores the same view.

### Troubleshooting
- **CORS / fetch errors**: run a local server (see Quick start). Opening via `file://` will load demo data only.
- **Large datasets feel slow**: zoom in; labels only render for sufficiently large circles.
- **Invalid JSON**: the loader will show the parse error in the modal.

### Large datasets (lazy loading)
- The app can lazy-load subtrees per node using `childrenUrl` to avoid loading huge files at once.
- Use the provided splitter to convert a large `big.json` into chunked files:
  - Place your file at project root as `big.json`.
  - Run: `npm run split` (requires Node 18+). This generates `data/` with a `root.json` and many chunk files.
  - Deploy the `data/` folder to Netlify with your site.
  - Open with query: `?data=/data/root.json` (e.g., `https://your-site.netlify.app/?data=%2Fdata%2Froot.json`).
  - As you click or zoom into nodes that have `childrenUrl`, the app fetches those subtrees on demand.

### License
MIT 


