// Constants and tunables

// Dynamic palette by level name (domain grows as levels appear)
export const PALETTE = d3
  .scaleOrdinal()
  .range([
    '#7aa2ff',
    '#6df0c9',
    '#ffc857',
    '#b892ff',
    '#ff8777',
    '#77d1ff',
    '#ffd670',
    '#84fab0',
    '#b8f2e6'
  ])
  .unknown('#7aa2ff');

export const settings = {
  renderDistance: 1.0,
  minPxRadius: 4,
  labelMinPxRadius: 22,
  labelMinFontPx: 12,
  verticalPadPx: 100
};


