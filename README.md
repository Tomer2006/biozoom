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

### UI overview
- Top bar:
  - `Load JSON`: paste or upload a JSON file
  - `Demo Data`: build a synthetic tree
  - Provider select + `Web Search`: open selected provider for hovered/current node
  - `Tiny Circles`: culls tiny circles to keep rendering fast when zoomed out
  - Search field: find by name (supports partial matches)
  - `Surprise Me`: jump to a random deepest leaf
  - `Reset`: back to root
- Breadcrumbs: click any crumb to navigate up

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
- `index.html`: UI skeleton and includes D3
- `styles.css`: theme and layout
- `app.js`: rendering, input, data ingestion, navigation
- `tree.json`: sample nested-key dataset

### Troubleshooting
- **CORS / fetch errors**: run a local server (see Quick start). Opening via `file://` will load demo data only.
- **Large datasets feel slow**: zoom in; labels only render for sufficiently large circles.
- **Invalid JSON**: the loader will show the parse error in the modal.

### License
MIT 


