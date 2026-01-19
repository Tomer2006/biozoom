
---

# 🧬 InfiniteSpecies

**InfiniteSpecies** is a high-performance, interactive visualization of the biological Tree of Life. It utilizes a hybrid **React + HTML5 Canvas** engine to render millions of organisms in a zoomable "circle-packing" layout, allowing users to navigate seamlessly from high-level domains down to individual species.

![Timeline 1 - FPS (1) - CROP - Videobolt net](https://github.com/user-attachments/assets/b832fd34-a71e-4fb2-bf48-864efe5e9bf2)

 
## ✨ Key Features

* 
**🔭 Deep Zoom Exploration:** Navigate through millions of nodes with smooth, hardware-accelerated zooming and panning.


* 
**⚡ Hybrid Rendering Engine:** Uses D3.js for layout math and HTML5 Canvas for rendering to achieve 60FPS performance on large datasets.


* 
**🔎 Smart Search:** Fuzzy search functionality to find organisms by scientific name, with visual "pulse" guidance to the result.


* 
**📖 Integrated Knowledge:** Hover over nodes to see Wikipedia thumbnails and summaries, or deep-link to external databases (GBIF, NCBI, iNaturalist).


* **🔗 Deep Linking:** Every view state is URL-shareable. Send a link to a specific species, and the app restores the exact zoom level and position.


* 
**📱 Mobile Ready:** Fully responsive with touch gestures for pinch-zoom and panning.



## 🎮 Controls

| Action | Desktop | Mobile/Touch |
| --- | --- | --- |
| **Zoom In** | Scroll Up / Left Click (on group) | Pinch Out |
| **Zoom Out** | Scroll Down / Right Click | Pinch In / Long Press |
| **Pan View** | Middle Click Drag / Drag | Drag |
| **Fit Node** | `F` Key | Double Tap |
| **Search** | `S` Key | Button in UI |
| **Reset** | `R` Key | Menu > Reset |

See the full control list in the app by pressing `?` or `F1`.

## 🛠️ Installation & Setup

### Prerequisites

* Node.js 18+
* npm

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/infinitespecies.git
cd infinitespecies

```


2. **Install dependencies**
```bash
npm install

```


3. **Start the development server**
```bash
npm run dev

```


Open `http://localhost:3000` to view it in the browser.



### Production Build

```bash
npm run build
npm run preview

```

## 🏗️ Architecture

This project uses a specialized architecture to handle the visualization of millions of nodes:

* 
**Data Pipeline (`/tools`)**: Raw taxonomy dumps (from OpenTree or NCBI) are processed, "baked" into a D3 packing layout offline, and split into sharded JSON chunks.


* 
**Core Engine (`/src/modules`)**: A vanilla JS engine handles the render loop, spatial indexing (`picking.js`), and camera physics (`camera.js`) to avoid React render cycle overhead.


* 
**UI Layer (`/src/components`)**: React handles the HUD, modals, search state, and URL routing, overlaying the canvas.



## 🧬 Data Sources

The visualization is compatible with:

* 
**Open Tree of Life:** The default dataset.


* 
**NCBI Taxonomy:** Tools provided to convert NCBI dumps.


* 
**Custom JSON:** You can load your own hierarchy via the "Load JSON" feature in the app.



## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

 See `package.json` for more information.

---

<div align="center">
<p>Built with ❤️ using React, D3, and Biology</p>
</div>
