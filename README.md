# InfiniteSpecies

**InfiniteSpecies** is a high-performance, interactive visualization of the biological Tree of Life. It uses a hybrid React + HTML5 Canvas engine to render millions of organisms in a zoomable circle-packing layout, allowing users to navigate from high-level domains down to individual species.

![Timeline 1 - FPS (1) - CROP - Videobolt net](https://github.com/user-attachments/assets/b832fd34-a71e-4fb2-bf48-864efe5e9bf2)

Live on https://infinitespecies.com

## Key Features

**Deep Zoom Exploration:** Navigate through millions of nodes with smooth, hardware-accelerated zooming and panning.

**Hybrid Rendering Engine:** Uses D3.js for layout math and HTML5 Canvas for rendering to achieve 60 FPS performance on large datasets.

**Smart Search:** Fuzzy search functionality to find organisms by scientific name, with visual guidance to the result.

**Integrated Knowledge:** Hover over nodes to see Wikipedia thumbnails and summaries, or deep-link to external databases such as GBIF, NCBI, and iNaturalist.

**Deep Linking:** Every view state is URL-shareable. Send a link to a specific species, and the app restores the exact zoom level and position.

**Mobile Ready:** Fully responsive with touch gestures for pinch-zoom and panning.

## Controls

| Action | Desktop | Mobile/Touch |
| --- | --- | --- |
| **Zoom In** | Scroll Up / Left Click (on group) | Pinch Out |
| **Zoom Out** | Scroll Down / Right Click | Pinch In / Long Press |
| **Pan View** | Middle Click Drag / Drag | Drag |
| **Fit Node** | `F` Key | Double Tap |
| **Search** | `S` Key | Button in UI |
| **Reset** | `R` Key | Menu > Reset |

See the full control list in the app by pressing `?` or `F1`.

## Architecture

**Data Pipeline (`/tools`)**: Raw OpenTree taxonomy dumps are processed, baked into a D3 packing layout offline, and split into sharded JSON chunks.

**Core Engine (`/src/modules`)**: A vanilla JS engine handles the render loop, spatial indexing (`picking.js`), and camera physics (`camera.js`) to avoid React render-cycle overhead.

**UI Layer (`/src/components`)**: React handles the HUD, modals, search state, and URL routing on top of the canvas.

## Data Sources

The visualization is compatible with:

**Open Tree of Life:** The default dataset.

## Clerk Auth

This app uses Clerk for authentication.

1. Create or open a Clerk application.
2. Copy your Clerk publishable key into a local `.env.local` file.
3. Restart `vite` after adding the env var.
4. If you want Google login, enable the Google social connection in the Clerk dashboard.

Required env vars:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_...
```

Optional for localhost/dev:

```bash
VITE_CLERK_DEV_PUBLISHABLE_KEY=pk_test_...
```

Use the live key only on `infinitespecies.com` and its subdomains. For `localhost`, use a Clerk test/development publishable key.

## License

Proprietary "All Rights Reserved"

Copyright (c) 2026 InfiniteSpecies

This software is proprietary and confidential. Unauthorized copying, modification, distribution, or use is strictly prohibited. See [LICENSE](LICENSE) for full terms.

---

<div align="center">
<p>Built with love using React, D3, and Biology</p>
</div>
