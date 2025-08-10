/* Taxonomy Explorer (Modular) */
/* -------------------- Constants -------------------- */
const LEVELS = ["Life","Domain","Kingdom","Phylum","Class","Order","Family","Genus","Species"];
const PALETTE = d3.scaleOrdinal().domain(LEVELS).range([
  "#7aa2ff","#6df0c9","#ffc857","#b892ff","#ff8777",
  "#77d1ff","#ffd670","#84fab0","#b8f2e6"
]);

/* -------------------- DOM -------------------- */
const canvas = document.getElementById('view');
const stage = document.getElementById('stage');
const ttip = document.getElementById('tooltip');
const tName = ttip.querySelector('.name');
const tMeta = ttip.querySelector('.meta');
const bigPreview = document.getElementById('bigPreview');
const bigPreviewImg = document.getElementById('bigPreviewImg');
const bigPreviewCap = document.getElementById('bigPreviewCap');
const helpModal = document.getElementById('helpModal');
const helpCloseBtn = document.getElementById('helpCloseBtn');
const providerSelect = document.getElementById('providerSelect');
const providerSearchBtn = document.getElementById('providerSearchBtn');
const breadcrumbsEl = document.getElementById('breadcrumbs');
const loadingEl = document.getElementById('loading');
const progressFill = document.getElementById('progressFill');
const progressLabel = document.getElementById('progressLabel');
const progressPct = document.getElementById('progressPct');

// Tiny Circles slider removed

const jsonModal = document.getElementById('jsonModal');
const loadBtn = document.getElementById('loadBtn');
const demoBtn = document.getElementById('demoBtn');
const cancelLoadBtn = document.getElementById('cancelLoadBtn');
const applyLoadBtn = document.getElementById('applyLoadBtn');
const insertSampleBtn = document.getElementById('insertSampleBtn');
const fileInput = document.getElementById('fileInput');
const jsonText = document.getElementById('jsonText');
const loadError = document.getElementById('loadError');

/* -------------------- Canvas -------------------- */
let ctx, W, H, DPR=1;
function resizeCanvas(){
  const bb = stage.getBoundingClientRect();
  DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  W = Math.floor(bb.width); H = Math.floor(bb.height);
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + "px"; canvas.style.height = H + "px";
  ctx = canvas.getContext('2d'); ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize', ()=>{ resizeCanvas(); requestRender(); });

/* -------------------- State -------------------- */
let DATA_ROOT = null;
let current = null;
let layout = null;
const allNodes = [];
const nameIndex = new Map();
let globalId = 1;

function clearIndex(){ allNodes.length=0; nameIndex.clear(); globalId=1; }
function registerNode(n){
  allNodes.push(n);
  const key = String(n.name ?? "").toLowerCase();
  if (!nameIndex.has(key)) nameIndex.set(key, []);
  nameIndex.get(key).push(n);
}

/* -------------------- Settings -------------------- */
const settings = {
  renderDistance: 1.0,
  minPxRadius: 4,
  labelMinPxRadius: 22,
  labelMinFontPx: 12,
  verticalPadPx: 100
};

/* -------------------- Loading Overlay -------------------- */
function showLoading(title="Loading…"){ document.getElementById('loadingTitle').textContent=title; loadingEl.style.display="flex"; document.getElementById('stage').setAttribute('aria-busy','true'); setProgress(0,"Starting…"); }
function hideLoading(){ loadingEl.style.display="none"; document.getElementById('stage').setAttribute('aria-busy','false'); }
function setProgress(ratio,label=""){ const pct=Math.max(0,Math.min(1,ratio)); progressFill.style.width=(pct*100).toFixed(1)+"%"; progressPct.textContent=Math.round(pct*100)+"%"; if(label) progressLabel.textContent=label; }

/* -------------------- Layout -------------------- */
const pack = d3.pack().padding(2);
function layoutFor(subtree){
  const h = d3.hierarchy(subtree)
    .sum(d => (d.children && d.children.length) ? 0 : 1)
    .sort((a,b) => b.value - a.value);
  const diameter = Math.min(W,H) - 40;
  pack.size([diameter, diameter])(h);
  const cx = diameter/2, cy = diameter/2;
  h.each(d => { d._vx = d.x - cx; d._vy = d.y - cy; d._vr = d.r; });
  return { root:h, diameter };
}

/* -------------------- Camera & Render -------------------- */
let needRender = true;
const camera = { x:0, y:0, k:1 };
const targetCam = { x:0, y:0, k:1 };
let animating = false;
// replaced later by on-demand loop
function lerp(a,b,t){ return a + (b-a)*t; }
function animateToCam(nx,ny,nk,dur=700){
  targetCam.x=nx; targetCam.y=ny; targetCam.k=nk;
  const sx=camera.x, sy=camera.y, sk=camera.k, start=performance.now(); animating=true;
  function step(now){
    const t=Math.min(1,(now-start)/dur), e=d3.easeCubicInOut(t);
    camera.x=lerp(sx,targetCam.x,e); camera.y=lerp(sy,targetCam.y,e); camera.k=lerp(sk,targetCam.k,e);
    requestRender(); if (t<1) requestAnimationFrame(step); else animating=false;
  }
  requestAnimationFrame(step);
}
function worldToScreen(x,y){ return [W/2 + (x - camera.x)*camera.k, H/2 + (y - camera.y)*camera.k]; }
function screenToWorld(px,py){ return [camera.x + (px - W/2)/camera.k, camera.y + (py - H/2)/camera.k]; }
function nodeInView(d){
  const viewR = Math.hypot(W, H) * 0.5 / camera.k * settings.renderDistance;
  const dx = d._vx - camera.x, dy = d._vy - camera.y;
  const r = viewR + d._vr;
  return (dx*dx + dy*dy) <= (r*r);
}
function nodeVertInView(d){
  const sy = H/2 + (d._vy - camera.y) * camera.k;
  const sr = d._vr * camera.k;
  const pad = settings.verticalPadPx;
  return (sy + sr) >= -pad && (sy - sr) <= (H + pad);
}

let hoverNode = null, highlightNode = null;
const nodeLayoutMap = new Map();
function rebuildNodeMap(){ nodeLayoutMap.clear(); layout.root.descendants().forEach(d => nodeLayoutMap.set(d.data._id, d)); }

/* -------------------- Deep link helpers -------------------- */
function getNodePath(node){
  const names=[]; let p=node; while(p){ names.unshift(String(p.name)); p=p.parent; }
  return names;
}
function encodePath(pathStr){ return encodeURIComponent(pathStr); }
function decodePath(hash){ try{ return decodeURIComponent(hash||''); }catch(_){ return hash||''; } }
function updateDeepLinkFromNode(node){
  const path = getNodePath(node).join('/');
  const newHash = path ? `#${encodePath(path)}` : '';
  if (location.hash !== newHash){ history.replaceState(null, '', newHash); }
}
function findNodeByPath(pathStr){
  const parts = pathStr.split('/').filter(Boolean);
  if (!parts.length || !DATA_ROOT) return DATA_ROOT;
  let node = DATA_ROOT;
  for (let i=1;i<parts.length;i++){ // skip root name
    const name = parts[i];
    const child = (node.children||[]).find(c => String(c.name) === name);
    if (!child) break; node = child;
  }
  return node;
}

function draw(){
  if (!needRender || !layout) return; needRender=false;
  ctx.clearRect(0,0,W,H);

  // Grid
  ctx.save(); ctx.globalAlpha=0.05;
  ctx.translate(Math.floor((W/2 - camera.x*camera.k)%40), Math.floor((H/2 - camera.y*camera.k)%40));
  ctx.beginPath();
  for(let x=-40;x<=W+40;x+=40){ ctx.moveTo(x,-40); ctx.lineTo(x,H+40); }
  for(let y=-40;y<=H+40;y+=40){ ctx.moveTo(-40,y); ctx.lineTo(W+40,y); }
  ctx.strokeStyle="#8aa1ff"; ctx.lineWidth=1; ctx.stroke(); ctx.restore();

  const nodes = layout.root.descendants().sort((a,b)=>a._vr-b._vr);
  const MIN_PX_R = settings.minPxRadius;
  const LABEL_MIN = settings.labelMinPxRadius;
  const labelCandidates = [];

  for (const d of nodes){
    if (!nodeVertInView(d)) continue;
    if (!nodeInView(d)) continue;
    const [sx,sy]=worldToScreen(d._vx,d._vy);
    const sr=d._vr*camera.k; if (sr < MIN_PX_R) continue;

    const level = d.data.level || "Life";
    ctx.beginPath(); ctx.arc(sx,sy,sr,0,Math.PI*2);
    ctx.fillStyle = PALETTE(level) || "#7aa2ff"; ctx.globalAlpha=.17; ctx.fill();
    ctx.globalAlpha=.9; ctx.lineWidth=Math.max(1, Math.min(3, 1.5*Math.sqrt(Math.max(sr/40,.25))));
    ctx.strokeStyle = d.children && d.children.length ? "#3a478e" : "#2b356f"; ctx.stroke();

    if (sr>LABEL_MIN){
      const fontSize = Math.min(18, Math.max(10, sr/3));
      if (fontSize >= settings.labelMinFontPx){
        ctx.save(); ctx.font = `600 ${fontSize}px ui-sans-serif`;
        const text = d.data.name; const metrics = ctx.measureText(text);
        ctx.restore();
        const textWidth = metrics.width, textHeight = fontSize, pad=2;
        const rect = { x1: sx - textWidth/2 - pad, y1: sy - textHeight/2 - pad, x2: sx + textWidth/2 + pad, y2: sy + textHeight/2 + pad };
        labelCandidates.push({ sx, sy, fontSize, text, rect });
      }
    }
  }

  // Label placement pass
  if (labelCandidates.length){
    const placed = [];
    const overlaps = (a,b)=> !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
    labelCandidates.sort((a,b)=> b.fontSize - a.fontSize);
    for (const cand of labelCandidates){
      let hit=false; for (const r of placed){ if (overlaps(cand.rect, r)){ hit=true; break; } }
      if (hit) continue;
      ctx.save();
      ctx.font = `600 ${cand.fontSize}px ui-sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(2, Math.min(6, cand.fontSize/3));
      ctx.strokeStyle = "rgba(0,0,0,0.9)";
      ctx.lineJoin = "round"; ctx.miterLimit = 2;
      ctx.strokeText(cand.text, cand.sx, cand.sy);
      ctx.fillStyle = "#e9eeff"; ctx.globalAlpha = .95;
      ctx.fillText(cand.text, cand.sx, cand.sy);
      ctx.restore();
      placed.push(cand.rect);
    }
  }

  if (highlightNode){
    const d = nodeLayoutMap.get(highlightNode._id);
    if (d && nodeVertInView(d) && nodeInView(d)){
      const [sx,sy]=worldToScreen(d._vx,d._vy); const sr=d._vr*camera.k;
      if (sr>4){ ctx.beginPath(); ctx.arc(sx,sy,sr+4,0,Math.PI*2); ctx.strokeStyle="rgba(255,255,255,.35)";
        ctx.lineWidth=2; ctx.setLineDash([6,6]); ctx.stroke(); ctx.setLineDash([]); }
    }
  }
}

/* -------------------- Picking -------------------- */
function screenToWorldHit(px,py){ return screenToWorld(px,py); }
function pickNodeAt(px,py){
  const nodes = layout.root.descendants().slice().sort((a,b)=>b.depth - a.depth);
  const [wx,wy]=screenToWorldHit(px,py);
  for (const d of nodes){
    if (!nodeInView(d)) continue;
    const dx=wx-d._vx, dy=wy-d._vy; if ((dx*dx + dy*dy) <= (d._vr*d._vr)) return d.data;
  }
  return null;
}

/* -------------------- Tooltip & provider search -------------------- */
let lastThumbShownForId = 0;
let thumbDelayTimer = null; // small delay before fetching/showing preview
function updateTooltip(n, px, py){
  if (!n){
    ttip.style.opacity=0;
    lastThumbShownForId = 0;
    if (thumbDelayTimer){ clearTimeout(thumbDelayTimer); thumbDelayTimer=null; }
    hideBigPreview();
    return;
  }
  const desc = n._leaves ?? 1;
  tName.textContent = n.name + (n.level ? ` (${n.level})` : "");
  tMeta.textContent = `${desc.toLocaleString()} descendant${desc===1?"":"s"}`;
  const m=10; ttip.style.left=Math.min(W-m,Math.max(m,px))+"px"; ttip.style.top=Math.min(H-m,Math.max(m,py))+"px";
  ttip.style.opacity=1;
  // If preview is pinned, do not change the big image based on hover
  if (isPreviewPinned) return;
  if (n._id !== lastThumbShownForId){
    lastThumbShownForId = n._id;
    if (thumbDelayTimer){ clearTimeout(thumbDelayTimer); }
    thumbDelayTimer = setTimeout(()=>{
      // still hovering the same node?
      if (hoverNode && hoverNode._id === n._id){ showBigFor(n); }
    }, 60);
  }
}
function providerUrl(provider, name){
  const q = encodeURIComponent(name);
  switch(provider){
    case 'google':     return `https://www.google.com/search?q=${q}`;
    case 'wikipedia':  return `https://en.wikipedia.org/wiki/Special:Search?search=${q}`;
    case 'gbif':       return `https://www.gbif.org/species/search?q=${q}`;
    case 'ncbi':       return `https://www.ncbi.nlm.nih.gov/taxonomy/?term=${q}`;
    case 'col':        return `https://www.catalogueoflife.org/data/search?q=${q}`;
    case 'inat':       return `https://www.inaturalist.org/search?q=${q}`;
    default:           return `https://www.google.com/search?q=${q}`;
  }
}
function getSearchTarget(){ return hoverNode || current || DATA_ROOT; }
function openProviderSearch(forNode){ if (!forNode) return; window.open(providerUrl(providerSelect.value||'google', forNode.name),'_blank','noopener,noreferrer'); }

/* -------------------- Image thumbnails (Wikipedia) -------------------- */
const thumbCache = new Map();
const THUMB_SIZE = 96; // px
async function fetchWikipediaThumb(title){
  const key = title.toLowerCase();
  const existing = thumbCache.get(key);
  if (existing) return existing; // may be Promise or string/null
  const p = (async ()=>{
    try{
      const encoded = encodeURIComponent(title.replace(/\s+/g, '_'));
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.thumbnail?.source || data?.originalimage?.source || null;
    }catch(_){ return null; }
  })();
  thumbCache.set(key, p);
  const src = await p;
  thumbCache.set(key, src);
  return src;
}

let lastThumbNodeId = null;
async function showBigFor(node){
  lastThumbNodeId = node._id;
  // Only attempt for leaf-ish or species-level names to reduce noise
  const isSpecific = (node.level === 'Species') || (!node.children || node.children.length === 0);
  const query = node.name;
  const src = await fetchWikipediaThumb(query);
  // Ensure still hovering same node
  if (!isPreviewPinned && lastThumbNodeId !== node._id) return;
  if (src && isProbablyImageAllowed(src)){
    showBigPreview(src, query, isSpecific ? `${node.name}` : `${node.name}`);
  } else {
    // When pinning, keep container visible with text even if image missing
    if (isPreviewPinned){
      bigPreviewCap.textContent = node.name;
      bigPreviewImg.removeAttribute('src');
      bigPreview.style.display = 'block';
      bigPreview.style.opacity = '1';
      bigPreview.setAttribute('aria-hidden','false');
    } else {
      hideBigPreview();
    }
  }
}
function isProbablyImageAllowed(src){
  // Basic guard against very large SVGs or data URIs; allow http(s) images
  return /^https?:\/\//i.test(src);
}

let previewReqToken = 0;
function showBigPreview(src, caption){
  if (!bigPreview) return;
  const myToken = ++previewReqToken;
  bigPreviewCap.textContent = caption || '';
  bigPreviewImg.alt = caption || '';
  bigPreviewImg.removeAttribute('src');
  bigPreview.style.display = 'block';
  bigPreview.style.opacity = '0';
  bigPreview.setAttribute('aria-hidden','false');
  const loader = new Image();
  loader.onload = () => {
    if (myToken !== previewReqToken) return; // superseded
    bigPreviewImg.src = src;
    // Force reflow then fade in
    // eslint-disable-next-line no-unused-expressions
    bigPreview.offsetHeight;
    bigPreview.style.opacity = '1';
  };
  loader.onerror = () => {
    if (myToken !== previewReqToken) return;
    if (!isPreviewPinned) hideBigPreview();
  };
  loader.referrerPolicy = 'no-referrer';
  loader.src = src;
  // If pinned, remember which node this belongs to
  if (isPreviewPinned && (hoverNode || current)){
    const n = hoverNode || current;
    pinnedNodeId = n._id;
  }
}
function hideBigPreview(){
  if (!bigPreview) return;
  previewReqToken++; // cancel in-flight load
  if (isPreviewPinned) return; // do not hide if pinned
  bigPreview.style.opacity = '0';
  setTimeout(()=>{ if (bigPreview.style.opacity==='0') bigPreview.style.display = 'none'; }, 60);
  bigPreview.setAttribute('aria-hidden','true');
  bigPreviewImg.src = '';
  bigPreviewImg.alt = '';
  bigPreviewCap.textContent = '';
}

/* -------------------- Pinning big preview -------------------- */
let isPreviewPinned = false;
let pinnedNodeId = null;
function pinPreviewFor(node){ isPreviewPinned = true; pinnedNodeId = node?._id ?? null; }
function unpinPreview(){ isPreviewPinned = false; pinnedNodeId = null; }

/* -------------------- Navigation -------------------- */
function setBreadcrumbs(node){
  breadcrumbsEl.innerHTML = "";
  const path=[]; let p=node; while(p){ path.unshift(p); p=p.parent; }
  path.forEach((n,i)=>{
    const el=document.createElement('div'); el.className='crumb'; el.textContent=n.name; el.title=`Go to ${n.name}`;
    el.addEventListener('click', ()=>goToNode(n,true));
    breadcrumbsEl.appendChild(el);
    if (i<path.length-1){ const sep=document.createElement('div'); sep.className='crumb sep'; sep.textContent='›'; sep.style.cursor='default'; breadcrumbsEl.appendChild(sep); }
  });
  // Update URL hash for deep link
  updateDeepLinkFromNode(node);
}
function fitNodeInView(node, frac=0.35){ const d=nodeLayoutMap.get(node._id); if (!d) return; const targetRadiusPx=Math.min(W,H)*frac; const k=targetRadiusPx/d._vr; animateToCam(d._vx,d._vy,k); }
function goToNode(node, animate=true){ current=node; layout=layoutFor(current); rebuildNodeMap(); setBreadcrumbs(current); if (animate){ const pad=20; const targetK=Math.min((W-pad)/layout.diameter,(H-pad)/layout.diameter); animateToCam(0,0,targetK); } else { camera.x=0; camera.y=0; camera.k=Math.min(W,H)/layout.diameter; } requestRender(); }

/* -------------------- Mouse/keyboard -------------------- */
let isMiddlePanning=false, lastPan=null;
canvas.addEventListener('mousemove',(ev)=>{
  const rect=canvas.getBoundingClientRect(); const x=ev.clientX-rect.left, y=ev.clientY-rect.top;
  if (isMiddlePanning && lastPan){
    const dx=x-lastPan.x, dy=y-lastPan.y; camera.x -= dx/camera.k; camera.y -= dy/camera.k; lastPan={x,y}; requestRender();
    ttip.style.opacity=0;
    if (thumbDelayTimer){ clearTimeout(thumbDelayTimer); thumbDelayTimer=null; }
    if (!isPreviewPinned) hideBigPreview();
    return;
  }
  const n=pickNodeAt(x,y); hoverNode=n; updateTooltip(n,x,y); requestRender();
});
canvas.addEventListener('mouseleave',()=>{ hoverNode=null; ttip.style.opacity=0; lastThumbShownForId=0; if (thumbDelayTimer){ clearTimeout(thumbDelayTimer); thumbDelayTimer=null; } if (!isPreviewPinned) hideBigPreview(); requestRender(); });
canvas.addEventListener('mousedown',(ev)=>{ if (ev.button===1){ isMiddlePanning=true; const rect=canvas.getBoundingClientRect(); lastPan={ x:ev.clientX-rect.left, y:ev.clientY-rect.top }; ev.preventDefault(); } });
window.addEventListener('mouseup',()=>{ isMiddlePanning=false; lastPan=null; });
canvas.addEventListener('contextmenu',(ev)=>{ ev.preventDefault(); if (current && current.parent) goToNode(current.parent,true); });
canvas.addEventListener('click',(ev)=>{ if (ev.button!==0) return; const rect=canvas.getBoundingClientRect(); const n=pickNodeAt(ev.clientX-rect.left, ev.clientY-rect.top); if (!n) return; if (n===current) fitNodeInView(n); else goToNode(n,true); });
canvas.addEventListener('wheel',(ev)=>{ const scale=Math.exp(-ev.deltaY*0.0015); const rect=canvas.getBoundingClientRect(); const mx=ev.clientX-rect.left, my=ev.clientY-rect.top; const [wx,wy]=screenToWorld(mx,my); camera.k*=scale; camera.x = wx - (mx - W/2)/camera.k; camera.y = wy - (my - H/2)/camera.k; requestRender(); ev.preventDefault(); },{passive:false});
window.addEventListener('keydown',(e)=>{
  const active = document.activeElement;
  const tag = (active && active.tagName) || '';
  const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (active && active.isContentEditable === true);
  if (isTyping) return;
  if (e.code === 'KeyS'){
    const target=getSearchTarget(); if (target){ openProviderSearch(target); }
    e.preventDefault();
  }
});
document.getElementById('tooltipSearchBtn').addEventListener('click',(e)=>{ e.stopPropagation(); const target = hoverNode || current; if (target){ openProviderSearch(target); } });
providerSearchBtn.addEventListener('click', ()=>{ const target = getSearchTarget(); if (target){ openProviderSearch(target); } });
const copyLinkBtn = document.getElementById('copyLinkBtn');
if (copyLinkBtn){
  copyLinkBtn.addEventListener('click', async ()=>{
    const url = new URL(location.href);
    const path = (current ? getNodePath(current) : []).join('/');
    url.hash = path ? `#${encodePath(path)}` : '';
    try{
      await navigator.clipboard.writeText(url.toString());
      progressLabel.textContent = 'Link copied';
      progressLabel.style.color = '';
      setTimeout(()=>{ if (progressLabel.textContent==='Link copied') progressLabel.textContent=''; }, 1200);
    }catch(_){
      // Fallback: select text via prompt
      window.prompt('Copy link:', url.toString());
    }
  });
}

/* -------------------- Keyboard: R / F / P / ? -------------------- */
function openHelp(){ if (!helpModal) return; helpModal.classList.add('open'); helpModal.setAttribute('aria-hidden','false'); }
function closeHelp(){ if (!helpModal) return; helpModal.classList.remove('open'); helpModal.setAttribute('aria-hidden','true'); }
if (helpCloseBtn) helpCloseBtn.addEventListener('click', closeHelp);

window.addEventListener('keydown',(e)=>{
  // Avoid interfering with text input
  const active = document.activeElement;
  const tag = (active && active.tagName) || '';
  const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (active && active.isContentEditable === true);
  if (isTyping) return;

  if (e.code === 'KeyR'){
    if (DATA_ROOT){ goToNode(DATA_ROOT,true); }
    e.preventDefault();
  } else if (e.code === 'KeyF'){
    const target = hoverNode || current;
    if (target){ fitNodeInView(target, 0.4); }
    e.preventDefault();
  } else if (e.code === 'KeyP'){
    const target = hoverNode || current;
    if (!isPreviewPinned){
      if (target){
        pinPreviewFor(target);
        // Ensure an image is visible; if not yet loaded, trigger it now
        showBigFor(target);
      }
    } else {
      unpinPreview(); if (!hoverNode) hideBigPreview();
    }
    e.preventDefault();
  } else if (e.code === 'Slash' || e.code === 'IntlRo' || e.key === 'F1' || e.code === 'F1'){
    // '?' often lives on the Slash key (Shift+/) or IntlRo on some layouts, also map F1 to Help
    const isOpen = helpModal && helpModal.classList.contains('open');
    if (isOpen) closeHelp(); else openHelp();
    e.preventDefault();
  }
});

/* -------------------- Search -------------------- */
function findByQuery(q){ if (!q) return null; q=q.trim().toLowerCase(); if (!q) return null; const exact=nameIndex.get(q); if (exact && exact.length) return exact[0]; for (const [k,arr] of nameIndex){ if (k.includes(q)) return arr[0]; } return null; }
function pulseAtNode(node){ const d=nodeLayoutMap.get(node._id); if (!d) return; const [sx,sy]=worldToScreen(d._vx,d._vy); const sr=d._vr*camera.k; if (sr<=2) return; const el=document.getElementById('pulse'); el.style.display="block"; el.style.left=(sx - sr*1.2) + "px"; el.style.top=(sy - sr*1.2) + "px"; el.style.width=(sr*2.4)+"px"; el.style.height=(sr*2.4)+"px"; el.style.boxShadow=`0 0 ${sr*.6}px ${sr*.3}px rgba(113,247,197,.3), inset 0 0 ${sr*.5}px ${sr*.25}px rgba(113,247,197,.25)`; el.style.border="2px solid rgba(113,247,197,.6)"; el.animate([{transform:'scale(0.9)',opacity:.0},{transform:'scale(1)',opacity:.7,offset:.2},{transform:'scale(1.2)',opacity:.0}],{duration:900,easing:'ease-out'}).onfinish=()=>{ el.style.display="none"; }; }
function handleSearch(){ const q=document.getElementById('searchInput').value; const node=findByQuery(q); if (!node){ progressLabel.textContent=`No match for “${q}”`; progressLabel.style.color='var(--warn)'; setTimeout(()=>{ progressLabel.textContent=""; progressLabel.style.color=""; },900); return; } current=node; layout=layoutFor(current); rebuildNodeMap(); setBreadcrumbs(current); animateToCam(0,0, Math.min(W,H)/layout.diameter); highlightNode=current; pulseAtNode(current); requestRender(); }
document.getElementById('searchBtn').addEventListener('click', handleSearch);
const searchInputEl = document.getElementById('searchInput');
if (searchInputEl){
  searchInputEl.addEventListener('keydown',(e)=>{ if (e.key === 'Enter'){ handleSearch(); e.preventDefault(); } });
}
document.getElementById('clearBtn').addEventListener('click', ()=>{ document.getElementById('searchInput').value=""; highlightNode=null; requestRender(); });
document.getElementById('resetBtn').addEventListener('click', ()=>{ if (DATA_ROOT) goToNode(DATA_ROOT,true); highlightNode=null; requestRender(); });
const fitBtn = document.getElementById('fitBtn');
if (fitBtn){
  fitBtn.addEventListener('click', ()=>{ const target = hoverNode || current; if (target){ fitNodeInView(target, 0.4); } });
}
document.getElementById('surpriseBtn').addEventListener('click', ()=>{ if (!allNodes.length) return; const leaves = allNodes.filter(n => !n.children || n.children.length === 0); if (!leaves.length) return; const pick = leaves[Math.floor(Math.random()*leaves.length)]; current = pick; layout = layoutFor(current); rebuildNodeMap(); setBreadcrumbs(current); animateToCam(0,0, Math.min(W,H)/layout.diameter); highlightNode = current; pulseAtNode(current); requestRender(); });

/* -------------------- JSON ingestion -------------------- */
function mapToChildren(obj){ const out = []; if (!obj || typeof obj !== 'object') return out; for (const [key, val] of Object.entries(obj)){ const node = { name: String(key) }; if (val && typeof val === 'object' && Object.keys(val).length){ node.children = mapToChildren(val); } else { node.children = []; } out.push(node); } return out; }
function normalizeTree(rootLike){ if (Array.isArray(rootLike)) return { name:"Life", level:"Life", children: rootLike }; if (typeof rootLike!=="object" || rootLike===null) throw new Error("Top-level JSON must be an object or an array."); const hasStructuredProps = Object.prototype.hasOwnProperty.call(rootLike, 'name') || Object.prototype.hasOwnProperty.call(rootLike, 'children'); if (!hasStructuredProps){ const keys = Object.keys(rootLike); if (keys.length === 1){ const rootName = keys[0]; return { name: String(rootName), children: mapToChildren(rootLike[rootName]) }; } return { name: "Life", level:"Life", children: mapToChildren(rootLike) }; } if (!Array.isArray(rootLike.children)) rootLike.children = rootLike.children ? [].concat(rootLike.children) : []; return rootLike; }
function inferLevelByDepth(depth){ return LEVELS[depth] || `Level ${depth}`; }
function countNodes(root){ let c=0, stack=[root]; while(stack.length){ const n=stack.pop(); c++; const ch=Array.isArray(n.children)?n.children:[]; for(let i=0;i<ch.length;i++) stack.push(ch[i]); } return c; }
function computeDescendantCounts(node){ if (!node.children || node.children.length===0){ node._leaves=1; return 1; } let t=0; for (const c of node.children){ t += computeDescendantCounts(c); } node._leaves=t; return t; }
async function indexTreeProgressive(root){ clearIndex(); let processed=0; const total=Math.max(1, countNodes(root)); const stack=[{node:root,parent:null,depth:0}]; while(stack.length){ const {node,parent,depth}=stack.pop(); if (node==null || typeof node!=='object') continue; node.name=String(node.name??"Unnamed"); node.level=node.level || inferLevelByDepth(depth); node.parent=parent; node._id=globalId++; if (!Array.isArray(node.children)) node.children = node.children ? [].concat(node.children):[]; registerNode(node); for (let i=node.children.length-1;i>=0;i--) stack.push({node:node.children[i], parent:node, depth:depth+1}); processed++; if (processed % 500 === 0){ setProgress(processed/total, `Indexing… ${processed.toLocaleString()}/${total.toLocaleString()}`); await new Promise(r=>setTimeout(r,0)); } } setProgress(.98,"Computing descendant counts…"); computeDescendantCounts(root); setProgress(1,"Done"); }
async function loadFromJSONText(text){ let parsed; try{ parsed=JSON.parse(text); }catch(e){ throw new Error("Invalid JSON: " + e.message); } const nroot=normalizeTree(parsed); await indexTreeProgressive(nroot); setDataRoot(nroot); }
async function loadFromUrl(url){ if (!url) throw new Error('No URL provided'); const res = await fetch(url, { cache: 'no-store' }); if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`); const text = await res.text(); await loadFromJSONText(text); }
function setDataRoot(root){ DATA_ROOT=root; current=DATA_ROOT; layout=layoutFor(current); rebuildNodeMap(); setBreadcrumbs(current); const pad=20; camera.k=Math.min((W-pad)/layout.diameter,(H-pad)/layout.diameter); camera.x=0; camera.y=0; requestRender(); }

/* -------------------- Demo data (optional) -------------------- */
function mulberry32(seed){ return function(){ let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; } }
const RNG = mulberry32(42);
const NAME_BANK = { Domain:["Bacteria","Archaea","Eukarya"], Kingdom:["Animalia","Plantae","Fungi","Protista","Chromista"], Phylum:["Chordata","Arthropoda","Mollusca","Nematoda","Echinodermata","Annelida","Bryophyta","Tracheophyta","Ascomycota","Basidiomycota","Ciliophora","Amoebozoa"], Class:["Mammalia","Aves","Reptilia","Amphibia","Actinopterygii","Insecta","Arachnida","Gastropoda","Bivalvia","Pinopsida","Magnoliopsida","Liliopsida","Saccharomycetes","Agaricomycetes"], Order:["Primates","Carnivora","Rodentia","Passeriformes","Coleoptera","Lepidoptera","Araneae","Anura","Squamata","Poales","Rosales","Fabales","Agaricales","Helotiales"], Family:["Hominidae","Felidae","Canidae","Muridae","Corvidae","Fringillidae","Poaceae","Rosaceae","Fabaceae","Agaricaceae","Psathyrellaceae","Salticidae","Lycosidae"], Genus:["Homo","Pan","Felis","Canis","Mus","Passer","Quercus","Rosa","Pisum","Agaricus","Coprinopsis","Salticus","Lupus","Helianthus","Apis","Drosophila","Formica","Carabus"], Species:["sapiens","familiaris","catus","musculus","domestica","vulgaris","officinalis","alba","niger","rubra","lutea","grandis","minor","major","elegans"] };
function pickName(level, idx){ const bag=NAME_BANK[level]||[]; if (!bag.length){ const syll=["al","be","ca","do","ex","fa","gi","ha","io","ju","ka","li","mo","nu","or","pi","qua","ri","su","ti","ur","vi","xa","yo","za"]; const mk=()=>Array.from({length:2+Math.floor(RNG()*2)},_=>syll[Math.floor(RNG()*syll.length)]).join(''); return level==="Species"?(mk()+" "+mk()):mk(); } return bag[idx % bag.length]; }
const PLAN_DEMO = [ { level:"Kingdom", min:4, max:6 }, { level:"Phylum", min:4, max:9 }, { level:"Class", min:4, max:8 }, { level:"Order", min:3, max:6 }, { level:"Family", min:3, max:5 }, { level:"Genus", min:2, max:4 }, { level:"Species", min:1, max:3 } ];
let globalIdDemo = 1;
async function buildDemoData(){
  const root = { name:"Life", level:"Life", children:[], parent:null, _id:0 };
  clearIndex(); registerNode(root);
  let frontier=[root]; showLoading("Preparing demo taxonomy…");
  for (let li=0; li<PLAN_DEMO.length; li++){
    const spec=PLAN_DEMO[li]; const next=[]; progressLabel.textContent = `Generating ${spec.level}…`;
    const total=frontier.length; let processed=0;
    for (const p of frontier){
      const count=spec.min + Math.floor(RNG()*(spec.max - spec.min + 1)); const arr=[];
      for (let i=0;i<count;i++){ const node={ name: pickName(spec.level,i), level: spec.level, children: [], parent:p, _id: ++globalIdDemo }; arr.push(node); registerNode(node); }
      p.children=arr; next.push(...arr); processed++;
      if (processed % Math.max(1, Math.floor(total/20)) === 0){ setProgress((li + processed/total)/PLAN_DEMO.length); await new Promise(r=>setTimeout(r,0)); }
    }
    frontier=next; setProgress((li+1)/PLAN_DEMO.length); await new Promise(r=>setTimeout(r,0));
  }
  computeDescendantCounts(root); setProgress(1,"Done"); setDataRoot(root); hideLoading();
}

/* -------------------- Modal wiring -------------------- */
function openModal(){ jsonModal.classList.add('open'); jsonModal.setAttribute('aria-hidden','false'); }
function closeModal(){ jsonModal.classList.remove('open'); jsonModal.setAttribute('aria-hidden','true'); loadError.textContent=""; }
loadBtn.addEventListener('click', ()=>openModal());
document.getElementById('cancelLoadBtn').addEventListener('click', ()=>closeModal());
document.getElementById('insertSampleBtn').addEventListener('click', ()=>{ jsonText.value = JSON.stringify({ name:"Life", children:[{ name:"Eukarya", children:[{ name:"Animalia", children:[{ name:"Chordata", children:[{ name:"Mammalia", children:[{ name:"Primates", children:[{ name:"Hominidae", children:[{ name:"Homo", children:[{ name:"Homo sapiens"}]}]}]}]}]}]}]}] }, null, 2); });
document.getElementById('fileInput').addEventListener('change', ()=>{ loadError.textContent=""; const f=fileInput.files && fileInput.files[0]; if (!f) return; const reader=new FileReader(); reader.onerror=()=>{ loadError.textContent="Failed to read file."; }; reader.onload=e=>{ jsonText.value=e.target.result; }; reader.readAsText(f); });
applyLoadBtn.addEventListener('click', async ()=>{ try{ loadError.textContent=""; const text=jsonText.value.trim(); if (!text){ loadError.textContent="Please paste JSON or choose a file."; return; } closeModal(); showLoading("Parsing custom JSON…"); await loadFromJSONText(text); hideLoading(); }catch(err){ hideLoading(); openModal(); loadError.textContent = err.message || String(err); } });
demoBtn.addEventListener('click', async ()=>{ await buildDemoData(); });

/* -------------------- Init -------------------- */
(function init(){
  resizeCanvas();
  const params = new URLSearchParams(location.search);
  const qUrl = params.get('data');
  const candidates = [ qUrl, 'tree.json', 'taxonomy.json', 'data.json' ].filter(Boolean);
  (async () => {
    for (const url of candidates){
      try{ showLoading(`Loading ${url}…`); await loadFromUrl(url); hideLoading(); tick(); return; }catch(err){ }
    }
    await buildDemoData(); tick();
  })();
  // After initial data load, if URL hash contains a path, navigate there
  window.addEventListener('hashchange', ()=>{
    const hash = decodePath(location.hash.slice(1));
    if (!hash || !DATA_ROOT) return;
    const node = findNodeByPath(hash);
    if (node){ goToNode(node, true); }
  });
  // On first load, apply hash if present (will be no-op until data set)
  setTimeout(()=>{
    const hash = decodePath(location.hash.slice(1));
    if (hash && DATA_ROOT){ const node = findNodeByPath(hash); if (node) goToNode(node, true); }
  }, 0);
})();

/* -------------------- Render loop (on-demand) -------------------- */
let rafId = null;
function ensureRAF(){ if (rafId==null){ rafId = requestAnimationFrame(loop); } }
function loop(){ rafId = null; draw(); if (needRender){ ensureRAF(); } }
// Overwrite requestRender to also schedule RAF lazily
function requestRender(){ needRender = true; ensureRAF(); }
function tick(){ needRender = true; ensureRAF(); }


