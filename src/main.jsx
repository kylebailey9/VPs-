import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import JSZip from 'jszip';
import {
  Aperture, Archive, ArrowDownToLine, ArrowLeft, ArrowRight, BadgeCheck, Camera, Check,
  ChevronDown, CircleHelp, Clock3, Crop, Download, Edit3, FileImage, FolderOpen, Grid2X2,
  ImagePlus, Images, LayoutGrid, Mail, Maximize2, Palette, Play, Plus, Printer, RotateCcw,
  Save, Search, Settings2, Share2, SlidersHorizontal, Sparkles, Tag, Trash2, Upload, Wand2, X
} from 'lucide-react';
import './styles.css';

const demo = [
  { id: 'p1', name: 'coastline-dawn.jpg', caption: 'Low tide, first light', date: '2025-08-18T06:42:00', size: '4.8 MB', url: './demo/photo-1.svg', tags: ['Travel', 'Favorites'], selected: true, favorite: true },
  { id: 'p2', name: 'market-stalls.jpg', caption: 'Saturday market', date: '2025-08-18T09:15:00', size: '3.2 MB', url: './demo/photo-2.svg', tags: ['Travel'], selected: true },
  { id: 'p3', name: 'old-town.jpg', caption: 'A walk through the old town', date: '2025-08-18T11:07:00', size: '5.1 MB', url: './demo/photo-3.svg', tags: ['Travel'], selected: false },
  { id: 'p4', name: 'late-lunch.jpg', caption: 'Late lunch in the shade', date: '2025-08-18T13:26:00', size: '3.9 MB', url: './demo/photo-4.svg', tags: ['Food'], selected: false },
  { id: 'p5', name: 'blue-hour.jpg', caption: 'The harbor after sunset', date: '2025-08-18T20:11:00', size: '4.4 MB', url: './demo/photo-5.svg', tags: ['Travel', 'Favorites'], selected: false, favorite: true },
  { id: 'p6', name: 'quiet-room.jpg', caption: 'The room before everyone arrived', date: '2025-08-19T08:02:00', size: '2.7 MB', url: './demo/photo-6.svg', tags: ['Work'], selected: false },
  { id: 'p7', name: 'greenhouse.jpg', caption: 'Glass, leaves, and morning light', date: '2025-08-19T10:36:00', size: '6.0 MB', url: './demo/photo-7.svg', tags: ['Favorites'], selected: false, favorite: true },
  { id: 'p8', name: 'rain-window.jpg', caption: 'Weather moved in', date: '2025-08-19T17:44:00', size: '3.4 MB', url: './demo/photo-8.svg', tags: ['Work'], selected: false }
];
const DB_NAME = 'frameflow-local';
const DB_VERSION = 2;
const STORE = 'photos';
const fmtDate = (d) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));
const fmtTime = (d) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(d));
const isImage = (f) => f && (f.type?.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name));
const openDb = () => new Promise((resolve, reject) => {
  if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const dbPut = async (record) => {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) { console.warn('Frameflow local save unavailable', e); }
};
const dbGetAll = async () => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => reject(request.error);
  });
};
const dbDelete = async (id) => {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) { console.warn('Frameflow local delete unavailable', e); }
};
const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});
const canvasBlob = (canvas, type = 'image/jpeg', quality = .9) => new Promise((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Could not export image')), type, quality));
const blobFromPhoto = async (photo) => {
  if (photo.blob) return photo.blob;
  const img = await loadImage(photo.url);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || 1200;
  canvas.height = img.naturalHeight || 800;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvasBlob(canvas, 'image/jpeg', .92);
};
const blobDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});
const saveBlob = async (blob, name) => {
  if (window.frameflowDesktop) {
    const result = await window.frameflowDesktop.saveFile({ name, bytes: new Uint8Array(await blob.arrayBuffer()) });
    return !result.canceled;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
};
const printDocument = () => window.frameflowDesktop?.print() || window.print();
const safeName = (name) => name.replace(/[^a-z0-9_-]/gi, '-').replace(/-+/g, '-').toLowerCase();
const cropRect = (w, h, crop) => {
  const ratios = { '4:3': 4 / 3, '3:2': 3 / 2, '1:1': 1, '16:9': 16 / 9 };
  const ratio = ratios[crop];
  if (!ratio) return { x: 0, y: 0, w, h };
  let cw = w; let ch = h;
  if (w / h > ratio) cw = h * ratio; else ch = w / ratio;
  return { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
};
async function editedBlob(photo, settings = {}, strokes = []) {
  const img = await loadImage(photo.url);
  const rect = cropRect(img.naturalWidth, img.naturalHeight, settings.crop);
  const scale = Math.min(1, Number(settings.width || 0) ? Number(settings.width) / rect.w : 2400 / Math.max(rect.w, rect.h));
  const outW = Math.max(1, Math.round(rect.w * scale));
  const outH = Math.max(1, Math.round(rect.h * scale));
  const angle = ((Number(settings.rotation || 0) % 360) + 360) % 360;
  const turned = angle === 90 || angle === 270;
  const canvas = document.createElement('canvas');
  canvas.width = turned ? outH : outW; canvas.height = turned ? outW : outH;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(angle * Math.PI / 180);
  ctx.scale(settings.flipX ? -1 : 1, settings.flipY ? -1 : 1);
  ctx.filter = `brightness(${100 + Number(settings.brightness || 0)}%) contrast(${100 + Number(settings.contrast || 0)}%) saturate(${100 + Number(settings.saturation || 0)}%) grayscale(${settings.grayscale || 0}%) sepia(${settings.sepia || 0}%) blur(${settings.blur || 0}px)`;
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, -outW / 2, -outH / 2, outW, outH);
  ctx.restore();
  strokes.forEach((stroke) => {
    ctx.save();
    ctx.strokeStyle = stroke.color || '#ff705e'; ctx.fillStyle = stroke.color || '#ff705e';
    ctx.lineWidth = stroke.width || 6; ctx.lineCap = 'round';
    if (stroke.kind === 'spot') {
      ctx.globalAlpha = .72; ctx.beginPath(); ctx.arc(stroke.x * canvas.width, stroke.y * canvas.height, stroke.width || 12, 0, Math.PI * 2); ctx.fill();
    } else if (stroke.points?.length) {
      ctx.beginPath(); stroke.points.forEach((point, i) => i ? ctx.lineTo(point.x * canvas.width, point.y * canvas.height) : ctx.moveTo(point.x * canvas.width, point.y * canvas.height)); ctx.stroke();
    }
    ctx.restore();
  });
  if (settings.watermark) {
    ctx.save(); ctx.globalAlpha = Number(settings.watermarkOpacity || .55); ctx.fillStyle = settings.watermarkColor || '#ffffff';
    ctx.font = `600 ${Number(settings.watermarkSize || 26)}px Segoe UI, sans-serif`; ctx.textAlign = settings.watermarkPosition === 'left' ? 'left' : 'right';
    ctx.fillText(settings.watermark, settings.watermarkPosition === 'left' ? 28 : canvas.width - 28, canvas.height - 28); ctx.restore();
  }
  return canvasBlob(canvas, settings.format === 'png' ? 'image/png' : settings.format === 'webp' ? 'image/webp' : 'image/jpeg', Number(settings.quality || .9));
}
const contactSheet = async (photos, title = 'Frameflow archive') => {
  const cards = [];
  for (const photo of photos) {
    try { cards.push({ photo, src: await blobDataUrl(await blobFromPhoto(photo)) }); } catch (e) { /* keep going */ }
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font:14px Segoe UI,Arial;color:#15202b;margin:36px}h1{font-size:26px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}figure{margin:0;break-inside:avoid}img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;background:#eef2f4}figcaption{padding-top:7px;line-height:1.35}small{color:#65717d}</style></head><body><h1>${title}</h1><p>Local index exported from Frameflow Studio. No network resources are required.</p><main>${cards.map(({ photo, src }) => `<figure><img src="${src}" alt=""><figcaption><strong>${photo.caption || photo.name}</strong><br><small>${photo.name} · ${fmtDate(photo.date)}</small></figcaption></figure>`).join('')}</main></body></html>`;
};
const zipBlob = async (photos, options = {}) => {
  const zip = new JSZip(); const manifest = [];
  for (const photo of photos) {
    try {
      const blob = options.process ? await options.process(photo) : await blobFromPhoto(photo);
      zip.file(options.name ? options.name(photo) : photo.name, blob);
      manifest.push({ name: photo.name, caption: photo.caption, tags: photo.tags || [], date: photo.date, source: 'local' });
    } catch (e) { manifest.push({ name: photo.name, error: 'Could not read this image locally' }); }
  }
  zip.file('frameflow-manifest.json', JSON.stringify({ created: new Date().toISOString(), photos: manifest }, null, 2));
  zip.file('index.html', await contactSheet(photos, options.title || 'Frameflow archive'));
  return zip.generateAsync({ type: 'blob' });
};
const exportOffice = async (photos, kind) => {
  const rows = [];
  for (const photo of photos) { try { rows.push(`<figure><img src="${await blobDataUrl(await blobFromPhoto(photo))}"><figcaption><strong>${photo.caption || photo.name}</strong><br>${photo.name} · ${fmtDate(photo.date)}</figcaption></figure>`); } catch (e) { /* skip unreadable */ } }
  const title = kind === 'word' ? 'Frameflow photo report' : 'Frameflow presentation';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#18242f}h1{font-size:25px}main{display:grid;grid-template-columns:repeat(2,1fr);gap:24px}figure{margin:0;break-inside:avoid}img{max-width:100%;height:auto;border-radius:8px}figcaption{padding-top:8px;font-size:12px;line-height:1.4}</style></head><body><h1>${title}</h1><p>Images are embedded locally for a portable handoff. Open this HTML file in Word or PowerPoint.</p><main>${rows.join('')}</main></body></html>`;
  return new Blob([html], { type: 'text/html' });
};
const exportSlideshow = async (photos, options) => {
  const zip = new JSZip(); const entries = [];
  for (const [i, photo] of photos.entries()) { const blob = await blobFromPhoto(photo); const filename = `images/${String(i + 1).padStart(3, '0')}-${safeName(photo.name)}`; zip.file(filename, blob); entries.push({ filename, title: photo.caption || photo.name, date: fmtDate(photo.date) }); }
  const payload = JSON.stringify(entries).replace(/</g, '\\u003c');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${options.title}</title><style>body{margin:0;background:${options.background};color:#fff;font-family:Segoe UI,Arial}main{min-height:100vh;display:grid;place-items:center;text-align:center;padding:3vw;box-sizing:border-box}img{max-width:92vw;max-height:78vh;object-fit:contain;border-radius:12px;box-shadow:0 20px 80px #0008}h1{font-size:clamp(22px,4vw,52px);margin:18px 0 6px}p{opacity:.72}</style></head><body><main><div><img id="photo"><h1 id="title"></h1><p id="date"></p></div></main><script>const photos=${payload},delay=${Number(options.delay) || 4000};let i=0;function show(){const p=photos[i%photos.length];document.querySelector('#photo').src=p.filename;document.querySelector('#title').textContent=p.title;document.querySelector('#date').textContent=p.date;i++}show();setInterval(show,delay)</script></body></html>`;
  zip.file('index.html', html); return zip.generateAsync({ type: 'blob' });
};

function App() {
  const [photos, setPhotos] = useState(demo);
  const [activeId, setActiveId] = useState('p1');
  const [view, setView] = useState('library');
  const [filter, setFilter] = useState('All photos');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('Newest first');
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState({ brightness: 0, contrast: 0, saturation: 0, grayscale: 0, sepia: 0, blur: 0, crop: 'Original', rotation: 0, flipX: false, flipY: false, watermark: '', format: 'jpg', quality: .9 });
  const [strokes, setStrokes] = useState([]);
  const [searchTag, setSearchTag] = useState('');
  const [printSettings, setPrintSettings] = useState({ size: '4 x 6', layout: 2, captions: true, copies: 1 });
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const active = photos.find((p) => p.id === activeId) || photos[0];
  const selected = photos.filter((p) => p.selected);
  const flash = (message) => { setNotice(message); setTimeout(() => setNotice(''), 3200); };
  useEffect(() => { dbGetAll().then((rows) => { if (rows.length) { const restored = rows.map((r) => ({ ...r, url: URL.createObjectURL(r.blob) })); setPhotos((current) => [...restored, ...current]); setActiveId(restored[0].id); } }).catch(() => {}); }, []);
  useEffect(() => { const onKey = (e) => { if (e.key.toLowerCase() === 'i' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) { e.preventDefault(); setModal('import'); } if (e.key === 'Escape') setModal(null); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
  const updatePhoto = (id, patch) => setPhotos((current) => current.map((photo) => { if (photo.id !== id) return photo; const next = { ...photo, ...patch }; const stored = { ...next }; delete stored.url; dbPut(stored); return next; }));
  const visible = useMemo(() => photos.filter((p) => {
    const matchesFilter = filter === 'All photos' || filter === 'Selected' ? (filter === 'All photos' || p.selected) : filter === 'Favorites' ? p.favorite || p.tags?.includes('Favorites') : p.tags?.includes(filter);
    const haystack = `${p.name} ${p.caption} ${(p.tags || []).join(' ')}`.toLowerCase();
    return matchesFilter && haystack.includes(query.toLowerCase()) && (!searchTag || p.tags?.includes(searchTag));
  }).sort((a, b) => sort === 'Oldest first' ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date)), [photos, filter, query, sort, searchTag]);
  const toggle = (id) => updatePhoto(id, { selected: !photos.find((p) => p.id === id)?.selected });
  const clearSelection = () => { photos.forEach((p) => p.selected && updatePhoto(p.id, { selected: false })); flash('Selection cleared'); };
  const importFiles = (files) => {
    const existing = new Set(photos.map((p) => p.fingerprint).filter(Boolean));
    const incoming = [...files].filter(isImage).filter((file) => { const fingerprint = `${file.name}:${file.size}:${file.lastModified || file.modifiedAt || ''}`; if (existing.has(fingerprint)) return false; existing.add(fingerprint); return true; }).map((file, i) => {
      const blob = file instanceof File ? file : new File([file.bytes], file.name, { type: file.type || 'image/jpeg', lastModified: Date.parse(file.modifiedAt || '') || Date.now() });
      const id = `local-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`;
      const fingerprint = `${file.name}:${file.size || blob.size}:${file.lastModified || file.modifiedAt || ''}`;
      const record = { id, name: file.name, caption: 'New import', date: file.modifiedAt || new Date().toISOString(), size: `${(blob.size / 1048576).toFixed(1)} MB`, blob, tags: ['Imported'], selected: false, fingerprint };
      dbPut(record); return { ...record, url: URL.createObjectURL(blob) };
    });
    if (incoming.length) { setPhotos((current) => [...incoming, ...current]); setActiveId(incoming[0].id); flash(`${incoming.length} photo${incoming.length > 1 ? 's' : ''} added locally`); } else flash('No new supported images found');
    setModal(null);
  };
  const openFiles = async () => { if (!window.frameflowDesktop) return fileRef.current?.click(); try { importFiles(await window.frameflowDesktop.openImages()); } catch (e) { flash('The Windows file picker could not read those photos'); } };
  const openFolder = async () => { if (!window.frameflowDesktop) return flash('Folder import is available in the Windows desktop build'); try { importFiles(await window.frameflowDesktop.openImageFolder()); } catch (e) { flash('The folder could not be read locally'); } };
  const runBatch = async (action, values = {}) => {
    if (!selected.length) return flash('Select at least one photo first');
    if (action === 'caption') { selected.forEach((p) => updatePhoto(p.id, { caption: values.caption || p.caption })); flash('Captions applied locally'); setModal(null); return; }
    if (action === 'rename') { selected.forEach((p, i) => updatePhoto(p.id, { name: `${safeName(values.stem || 'photo')}-${String(i + 1).padStart(3, '0')}.${values.extension || 'jpg'}` })); flash('Filenames staged locally'); setModal(null); return; }
    if (action === 'date') { selected.forEach((p) => updatePhoto(p.id, { date: values.date || p.date })); flash('Capture dates updated in the local library'); setModal(null); return; }
    if (action === 'export') {
      flash('Processing locally…');
      const settings = { width: values.width, format: values.format || 'jpg', quality: Number(values.quality || .88), watermark: values.watermark, crop: values.crop === 'Original' ? null : values.crop };
      await saveBlob(await zipBlob(selected, { process: (p) => editedBlob(p, settings), name: (p) => `${safeName(p.name.replace(/\.[^.]+$/, ''))}.${settings.format}`, title: `Frameflow ${values.preset || 'batch'} export` }), `frameflow-${safeName(values.preset || 'batch')}.zip`);
      flash('Local batch package ready'); setModal(null);
    }
  };
  const printHtml = () => {
    const count = Math.max(1, Number(printSettings.layout));
    const items = selected.flatMap((p) => Array.from({ length: Math.max(1, Number(printSettings.copies) || 1) }, () => p));
    document.body.classList.add('printing-sheet');
    const node = document.querySelector('#print-sheet');
    node.innerHTML = `<div class="print-page"><h1>Frameflow photo sheet</h1><div class="print-grid" style="--print-cols:${count}">${items.map((p) => `<figure><img src="${p.url}" alt=""><figcaption>${printSettings.captions ? (p.caption || p.name) : ''}</figcaption></figure>`).join('')}</div></div>`;
    printDocument();
    setTimeout(() => { document.body.classList.remove('printing-sheet'); node.innerHTML = ''; }, 1200);
  };
  const exportEmail = async () => { if (!selected.length) return flash('Select at least one photo first'); const rows = []; for (const p of selected) rows.push(`<p><strong>${p.caption || p.name}</strong><br><img style="max-width:640px" src="${await blobDataUrl(await blobFromPhoto(p))}"></p>`); const html = `<html><body><h1>Photos from Frameflow</h1>${rows.join('')}</body></html>`; await saveBlob(new Blob([html], { type: 'text/html' }), 'frameflow-email-draft.html'); flash('Local email draft saved'); setModal(null); };
  const openEditor = (photo = active) => { setEditor({ brightness: 0, contrast: 0, saturation: 0, grayscale: 0, sepia: 0, blur: 0, crop: 'Original', rotation: 0, flipX: false, flipY: false, watermark: '', format: 'jpg', quality: .9 }); setStrokes(photo?.annotations || []); setModal('editor'); };
  const commitEdit = async () => { if (!active) return; flash('Rendering a local edited copy…'); const blob = await editedBlob(active, editor, strokes); const url = URL.createObjectURL(blob); const next = { ...active, url, blob, edited: true, annotations: strokes }; delete next.fingerprint; dbPut(next); setPhotos((current) => current.map((p) => p.id === active.id ? next : p)); flash('Edited copy saved in local storage'); setModal(null); };
  const addStroke = (event) => { const rect = event.currentTarget.getBoundingClientRect(); const point = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }; setStrokes((items) => [...items, { kind: 'spot', ...point, color: '#ff705e', width: 13 }]); };
  const exportSlide = async (settings) => { if (!selected.length) return flash('Select at least one photo first'); flash('Building a local slideshow package…'); await saveBlob(await exportSlideshow(selected, settings), 'frameflow-slideshow.zip'); flash('Slideshow package ready'); setModal(null); };
  const removeActive = () => { if (!active || active.id.startsWith('p')) return flash('Demo photos are part of the workspace preview'); dbDelete(active.id); URL.revokeObjectURL(active.url); setPhotos((current) => current.filter((p) => p.id !== active.id)); setActiveId(photos.find((p) => p.id !== active.id)?.id || 'p1'); flash('Photo removed from local storage'); };

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><Aperture size={20}/></div><div><b>Frameflow</b><span>Studio</span></div></div><div className="top-search"><Search size={16}/><input aria-label="Search photos" placeholder="Search photos, captions, or tags" value={query} onChange={(e) => setQuery(e.target.value)}/>{query && <button className="clear-search" onClick={() => setQuery('')}><X size={14}/></button>}<kbd>Ctrl K</kbd></div><div className="top-actions"><button className="icon-button" title="Help" onClick={() => setModal('help')}><CircleHelp size={18}/></button><button className="icon-button" title="Local settings" onClick={() => setModal('settings')}><Settings2 size={18}/></button><div className="avatar">KB</div></div></header>
    <div className="workspace"><aside className="sidebar"><div className="side-heading"><span>Workspace</span><button className="icon-button small" onClick={() => setModal('import')}><Plus size={16}/></button></div><button className="import-cta" onClick={() => setModal('import')}><Upload size={17}/><span>Import photos</span><kbd>I</kbd></button><SideLabel>Browse</SideLabel><Side icon={<LayoutGrid size={17}/>} text="All photos" count={photos.length} active={filter === 'All photos'} onClick={() => { setView('library'); setFilter('All photos'); }}/><Side icon={<BadgeCheck size={17}/>} text="Selected" count={selected.length} active={filter === 'Selected'} onClick={() => { setView('library'); setFilter('Selected'); }}/><Side icon={<Clock3 size={17}/>} text="Photo history" active={view === 'history'} onClick={() => { setView('history'); setFilter('All photos'); }}/><Side icon={<Images size={17}/>} text="Slideshow" onClick={() => setModal('slideshow')}/><div className="side-section"><SideLabel>Collections</SideLabel><Side icon={<Tag size={17}/>} text="Travel" active={filter === 'Travel'} onClick={() => setFilter('Travel')}/><Side icon={<Sparkles size={17}/>} text="Favorites" active={filter === 'Favorites'} onClick={() => setFilter('Favorites')}/><Side icon={<Tag size={17}/>} text="Work" active={filter === 'Work'} onClick={() => setFilter('Work')}/><button className="new-collection" onClick={() => flash('Collections are managed locally in each photo’s tags')}><Plus size={14}/>New collection</button></div><div className="storage-card"><div className="storage-title"><Archive size={16}/><span>Local library</span><span className="status-dot"/></div><div className="storage-bar"><i/></div><small>IndexedDB · no server sync</small><span>{photos.filter((p) => p.blob).length} imported items stored on this device</span></div><div className="sidebar-foot"><span className="privacy-lock">●</span><span>Private by design</span></div></aside>
      <main className="main-content"><section className="page-head"><div><p className="eyebrow">{view === 'history' ? 'Chronological view' : 'Your workspace'}</p><h1>{view === 'history' ? 'Photo history' : filter === 'All photos' ? 'All photos' : filter}</h1><p className="subhead">{view === 'history' ? 'Every local import, arranged by capture date.' : `${visible.length} items ready for your next move.`}</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => setModal('slideshow')}><Play size={16}/>Slideshow</button><button className="primary-button" onClick={() => setModal('import')}><ImagePlus size={16}/>Add photos</button></div></section><section className="toolbar"><div className="toolbar-left"><button className={searchTag ? 'filter-chip active' : 'filter-chip'} onClick={() => setSearchTag(searchTag ? '' : 'Favorites')}><SlidersHorizontal size={15}/> {searchTag ? searchTag : 'Quick filter'}<ChevronDown size={14}/></button><span className="view-note">{selected.length} selected</span></div><label className="sort-label">Sort by <select value={sort} onChange={(e) => setSort(e.target.value)}><option>Newest first</option><option>Oldest first</option></select></label></section>{view === 'history' ? <History photos={visible} onOpen={setActiveId} activeId={activeId} onToggle={toggle}/> : <><section className="selection-bar"><span><b>{selected.length}</b> selected for your next action</span><div><button onClick={() => setModal('print')}><Printer size={15}/>Print sheet</button><button onClick={() => setModal('batch')}><Wand2 size={15}/>Batch tools</button><button onClick={() => setModal('share')}><Share2 size={15}/>Share</button><button onClick={clearSelection}>Clear</button></div></section><section className="photo-grid">{visible.map((p) => <Card key={p.id} photo={p} active={p.id === activeId} onOpen={() => setActiveId(p.id)} onToggle={() => toggle(p.id)} onFavorite={() => updatePhoto(p.id, { favorite: !p.favorite, tags: p.favorite ? (p.tags || []).filter((t) => t !== 'Favorites') : [...new Set([...(p.tags || []), 'Favorites'])] })}/>)}</section></>}</main>
      <aside className="detail-pane"><div className="detail-kicker"><span>Inspector</span><button className="icon-button small" onClick={() => setModal('settings')}><MoreIcon/></button></div>{active && <><div className="hero-image"><img src={active.url} alt={active.caption}/><button className="hero-expand" onClick={() => openEditor(active)}><Maximize2 size={16}/></button></div><div className="detail-title"><div><p className="eyebrow">{active.name}</p><h2>{active.caption || 'Untitled photo'}</h2></div><button className={active.favorite ? 'favorite-button active' : 'favorite-button'} onClick={() => updatePhoto(active.id, { favorite: !active.favorite })}>★</button></div><div className="metadata-grid"><div><span>Captured</span><b>{fmtDate(active.date)}</b></div><div><span>Time</span><b>{fmtTime(active.date)}</b></div><div><span>File size</span><b>{active.size || 'Local copy'}</b></div><div><span>Source</span><b>On this device</b></div></div><div className="tag-row">{(active.tags || []).map((tag) => <button key={tag} onClick={() => setSearchTag(tag)}>{tag}</button>)}<button className="add-tag" onClick={() => setModal('tag')}><Plus size={13}/>Tag</button></div><div className="detail-actions"><button className="primary-button full" onClick={() => openEditor(active)}><Edit3 size={16}/>Edit photo</button><div className="split-actions"><button onClick={() => setModal('print')}><Printer size={15}/>Print</button><button onClick={() => setModal('share')}><Share2 size={15}/>Share</button><button onClick={removeActive}><Trash2 size={15}/></button></div></div></>}</aside>
    </div><input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => importFiles(e.target.files)}/><div id="print-sheet"/><div className={notice ? 'toast visible' : 'toast'}><Check size={16}/>{notice}</div>{modal && <Modal title={modalTitle(modal)} close={() => setModal(null)}>{modal === 'import' && <ImportPanel openFiles={openFiles} openFolder={openFolder} cameraRef={cameraRef} onCaptured={importFiles}/>} {modal === 'batch' && <BatchPanel runBatch={runBatch} selectedCount={selected.length}/>} {modal === 'print' && <PrintPanel settings={printSettings} setSettings={setPrintSettings} photos={selected} onPrint={printHtml}/>} {modal === 'share' && <SharePanel photos={selected} onEmail={exportEmail} onSlideshow={() => setModal('slideshow')} onOffice={async (kind) => { await saveBlob(await exportOffice(selected, kind), `frameflow-${kind}-report.html`); flash('Local document handoff saved'); setModal(null); }}/>} {modal === 'slideshow' && <SlideshowPanel photos={selected.length ? selected : photos} onExport={exportSlide}/>} {modal === 'editor' && <EditorPanel photo={active} settings={editor} setSettings={setEditor} strokes={strokes} setStrokes={setStrokes} onCanvasClick={addStroke} onSave={commitEdit}/>} {modal === 'tag' && <TagPanel photo={active} onSave={(tag) => { updatePhoto(active.id, { tags: [...new Set([...(active.tags || []), tag])] }); flash('Tag added locally'); setModal(null); }}/>} {modal === 'help' && <HelpPanel/>} {modal === 'settings' && <SettingsPanel/>}</Modal>}</div>;
}
const modalTitle = (m) => ({ import: 'Bring photos into Frameflow', batch: 'Batch tools', print: 'Print studio', share: 'Local handoffs', slideshow: 'Slideshow builder', editor: 'Edit photo', tag: 'Add a local tag', help: 'A quiet help panel', settings: 'Local settings' }[m] || 'Frameflow tool');
function MoreIcon() { return <span className="more-icon">•••</span>; }
function SideLabel({ children }) { return <p className="side-label">{children}</p>; }
function Side({ icon, text, count, active, onClick }) { return <button className={active ? 'side-item active' : 'side-item'} onClick={onClick}>{icon}<span>{text}</span>{count !== undefined && <i>{count}</i>}</button>; }
function Card({ photo, active, onOpen, onToggle, onFavorite }) { return <article className={active ? 'photo-card active' : 'photo-card'} onClick={onOpen}><div className="card-image"><img src={photo.url} alt={photo.caption || photo.name}/><button className={photo.selected ? 'select-dot selected' : 'select-dot'} onClick={(e) => { e.stopPropagation(); onToggle(); }}>{photo.selected && <Check size={13}/>}</button><button className={photo.favorite ? 'card-star active' : 'card-star'} onClick={(e) => { e.stopPropagation(); onFavorite(); }}>★</button><span className="card-menu">•••</span></div><div className="card-copy"><div><b>{photo.caption || photo.name}</b><span>{photo.name} · {fmtDate(photo.date)}</span></div><span className="card-size">{photo.size || 'Local'}</span></div></article>; }
function History({ photos, onOpen, activeId, onToggle }) { const days = [...new Set(photos.map((p) => fmtDate(p.date)))]; return <div className="history-list">{days.map((day) => <section key={day}><div className="history-date"><span>{day}</span><i/></div><div className="photo-grid">{photos.filter((p) => fmtDate(p.date) === day).map((p) => <Card key={p.id} photo={p} active={p.id === activeId} onOpen={() => onOpen(p.id)} onToggle={() => onToggle(p.id)} onFavorite={() => {}}/>)}</div></section>)}</div>; }
function Modal({ title, close, children }) { return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}><div className="modal-card"><div className="modal-head"><div><span className="modal-label"><Sparkles size={13}/> Frameflow tool</span><h2>{title}</h2></div><button className="icon-button" onClick={close}><X size={18}/></button></div><div className="modal-body">{children}</div></div></div>; }
function ImportPanel({ openFiles, openFolder, cameraRef, onCaptured }) { const [camera, setCamera] = useState(false); const [stream, setStream] = useState(null); const videoRef = useRef(null); useEffect(() => { if (!camera) return undefined; let currentStream; const request = navigator.mediaDevices?.getUserMedia?.({ video: true }); if (!request) { setCamera(false); return undefined; } request.then((s) => { currentStream = s; setStream(s); if (videoRef.current) videoRef.current.srcObject = s; }).catch(() => setCamera(false)); return () => { currentStream?.getTracks().forEach((t) => t.stop()); setStream(null); }; }, [camera]); const snap = () => { const video = videoRef.current; const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext('2d').drawImage(video, 0, 0); canvas.toBlob((blob) => { const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' }); onCaptured([file]); setCamera(false); }, 'image/jpeg', .92); }; return <div className="import-panel"><p className="modal-intro">Keep everything on this PC. Frameflow reads photos locally and stores imported copies in browser-local storage.</p>{camera ? <div className="camera-box"><video ref={videoRef} autoPlay playsInline/><button className="primary-button" onClick={snap}><Camera size={16}/>Capture locally</button></div> : <div className="import-options"><button className="import-option" onClick={openFiles}><div><FileImage size={22}/></div><span><b>Choose photos</b><small>JPG, PNG, WEBP, GIF, or BMP</small></span><ArrowRight size={17}/></button><button className="import-option" onClick={openFolder}><div><FolderOpen size={22}/></div><span><b>Choose a folder</b><small>Includes mounted camera cards and subfolders</small></span><ArrowRight size={17}/></button><button className="import-option" onClick={() => setCamera(true)}><div><Camera size={22}/></div><span><b>Use camera</b><small>Capture through local camera permission</small></span><ArrowRight size={17}/></button></div>}<div className="privacy-callout"><span>●</span><div><b>Private by design</b><p>No uploads, accounts, analytics, or background transfer. Exports happen only when you save them.</p></div></div></div>; }
function BatchPanel({ runBatch, selectedCount }) { const [action, setAction] = useState('export'); const [values, setValues] = useState({ preset: 'web', width: 1200, quality: .86, format: 'jpg', watermark: '', crop: 'Original', caption: '', stem: 'photo', extension: 'jpg', date: new Date().toISOString().slice(0, 10) }); const set = (k, v) => setValues((x) => ({ ...x, [k]: v })); return <div className="tool-panel"><p className="modal-intro">Run a clean, local operation across <b>{selectedCount} selected photos</b>. Export operations create a ZIP with a thumbnail index and manifest.</p><div className="segmented">{[['export','Optimize'],['caption','Captions'],['rename','Rename'],['date','Dates']].map(([id, label]) => <button key={id} className={action === id ? 'active' : ''} onClick={() => setAction(id)}>{label}</button>)}</div>{action === 'export' && <><Field label="Preset"><select value={values.preset} onChange={(e) => { const v = e.target.value; set('preset', v); if (v === 'email') { set('width', 900); set('quality', .72); } if (v === 'ebay') { set('width', 1600); set('quality', .82); } if (v === 'print') { set('width', 2400); set('quality', .94); } }}><option value="web">Web-ready</option><option value="email">Email-friendly</option><option value="ebay">Marketplace / eBay</option><option value="print">Print quality</option><option value="custom">Custom local export</option></select></Field><div className="form-grid"><Field label="Max width"><input type="number" value={values.width} onChange={(e) => set('width', e.target.value)}/></Field><Field label="Quality"><input type="number" min=".2" max="1" step=".01" value={values.quality} onChange={(e) => set('quality', e.target.value)}/></Field><Field label="Format"><select value={values.format} onChange={(e) => set('format', e.target.value)}><option value="jpg">JPEG</option><option value="png">PNG</option><option value="webp">WEBP</option></select></Field><Field label="Crop"><select value={values.crop} onChange={(e) => set('crop', e.target.value)}><option>Original</option><option>4:3</option><option>3:2</option><option>1:1</option><option>16:9</option></select></Field></div><Field label="Watermark (optional)"><input value={values.watermark} placeholder="Copyright or proof mark" onChange={(e) => set('watermark', e.target.value)}/></Field></>}{action === 'caption' && <Field label="Caption for selected photos"><input value={values.caption} placeholder="Weekend in the city" onChange={(e) => set('caption', e.target.value)}/></Field>}{action === 'rename' && <div className="form-grid"><Field label="Filename stem"><input value={values.stem} onChange={(e) => set('stem', e.target.value)}/></Field><Field label="Extension"><select value={values.extension} onChange={(e) => set('extension', e.target.value)}><option>jpg</option><option>png</option><option>webp</option></select></Field></div>}{action === 'date' && <Field label="Capture date"><input type="date" value={values.date} onChange={(e) => set('date', e.target.value)}/></Field>}<div className="modal-foot"><span className="muted">No originals are overwritten</span><button className="primary-button" onClick={() => runBatch(action, values)}><Wand2 size={16}/>Run locally</button></div></div>; }
function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label>; }
function PrintPanel({ settings, setSettings, photos, onPrint }) { return <div className="tool-panel"><p className="modal-intro">A print-preview-first sheet for home printers. Frameflow handles fit, repeated copies, and captions in the local document.</p><div className="form-grid"><Field label="Photo size"><select value={settings.size} onChange={(e) => setSettings({ ...settings, size: e.target.value })}><option>Wallet</option><option>3.5 x 5</option><option>4 x 6</option><option>5 x 7</option><option>8 x 10</option></select></Field><Field label="Photos across"><select value={settings.layout} onChange={(e) => setSettings({ ...settings, layout: e.target.value })}><option value="1">1 up</option><option value="2">2 up</option><option value="3">3 up</option><option value="4">4 up</option><option value="6">6 up</option></select></Field><Field label="Copies each"><input type="number" min="1" max="20" value={settings.copies} onChange={(e) => setSettings({ ...settings, copies: e.target.value })}/></Field></div><label className="check-line"><input type="checkbox" checked={settings.captions} onChange={(e) => setSettings({ ...settings, captions: e.target.checked })}/><span>Include captions under photos</span></label><div className="print-preview"><div className="preview-paper"><div className="preview-grid" style={{ '--cols': settings.layout }}>{(photos.length ? photos : [{ url: './demo/photo-1.svg', caption: 'Select photos to preview' }]).slice(0, 6).map((p, i) => <figure key={i}><img src={p.url}/>{settings.captions && <figcaption>{p.caption}</figcaption>}</figure>)}</div></div></div><div className="modal-foot"><span className="muted">{photos.length || 0} photos in sheet</span><button className="primary-button" onClick={onPrint}><Printer size={16}/>Open print preview</button></div></div>; }
function SharePanel({ photos, onEmail, onSlideshow, onOffice }) { return <div className="share-panel"><p className="modal-intro">Local handoffs for the selected set. Each option creates a file or opens a system print/share step only when you press it.</p><div className="share-grid"><button onClick={onEmail}><Mail size={21}/><b>Email draft</b><span>Save HTML with reduced inline images</span></button><button onClick={async () => { await saveBlob(await zipBlob(photos, { title: 'Frameflow share package' }), 'frameflow-share.zip'); }}><Share2 size={21}/><b>ZIP share package</b><span>Images, captions, manifest, and index</span></button><button onClick={() => onOffice('word')}><FileImage size={21}/><b>Word handoff</b><span>Portable HTML document for Word</span></button><button onClick={() => onOffice('powerpoint')}><Grid2X2 size={21}/><b>PowerPoint handoff</b><span>Portable HTML presentation sheet</span></button><button onClick={onSlideshow}><Play size={21}/><b>Slideshow</b><span>Three-view style local presentation</span></button><button onClick={async () => { await saveBlob(await zipBlob(photos, { title: 'Frameflow backup' }), 'frameflow-backup.zip'); }}><Archive size={21}/><b>Backup archive</b><span>Incremental-friendly local archive</span></button></div><p className="privacy-note"><span>●</span> Online processors and automatic sending are intentionally absent. Nothing leaves this device in the background.</p></div>; }
function SlideshowPanel({ photos, onExport }) { const [index, setIndex] = useState(0); const [playing, setPlaying] = useState(true); const [settings, setSettings] = useState({ title: 'Frameflow set', delay: 4000, background: '#12232b' }); useEffect(() => { if (!playing) return undefined; const timer = setInterval(() => setIndex((i) => (i + 1) % photos.length), Number(settings.delay)); return () => clearInterval(timer); }, [playing, photos.length, settings.delay]); const p = photos[index] || photos[0]; return <div className="slideshow-panel"><div className="slide-stage" style={{ background: settings.background }}><img src={p.url} alt=""/><div><b>{p.caption || p.name}</b><span>{fmtDate(p.date)}</span></div><button className="slide-prev" onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}><ArrowLeft size={18}/></button><button className="slide-next" onClick={() => setIndex((i) => (i + 1) % photos.length)}><ArrowRight size={18}/></button></div><div className="filmstrip">{photos.map((photo, i) => <button key={photo.id} className={i === index ? 'active' : ''} onClick={() => setIndex(i)}><img src={photo.url}/></button>)}</div><div className="form-grid"><Field label="Title"><input value={settings.title} onChange={(e) => setSettings({ ...settings, title: e.target.value })}/></Field><Field label="Seconds per photo"><input type="number" min="1" value={Number(settings.delay) / 1000} onChange={(e) => setSettings({ ...settings, delay: Number(e.target.value) * 1000 })}/></Field></div><div className="modal-foot"><button className="secondary-button" onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button><button className="primary-button" onClick={() => onExport(settings)}><Download size={16}/>Export local slideshow</button></div></div>; }
function EditorPanel({ photo, settings, setSettings, strokes, setStrokes, onCanvasClick, onSave }) { const css = { filter: `brightness(${100 + Number(settings.brightness)}%) contrast(${100 + Number(settings.contrast)}%) saturate(${100 + Number(settings.saturation)}%) grayscale(${settings.grayscale}%) sepia(${settings.sepia}%) blur(${settings.blur}px)`, transform: `rotate(${settings.rotation}deg) scaleX(${settings.flipX ? -1 : 1}) scaleY(${settings.flipY ? -1 : 1})` }; return <div className="editor-panel"><div className="editor-stage" onClick={onCanvasClick}><img src={photo.url} style={css} alt="Edit preview"/>{strokes.map((s, i) => <span key={i} className="annotation-dot" style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, background: s.color }}/>)}</div><div className="editor-controls"><div className="editor-toolbar"><button onClick={() => setSettings({ ...settings, rotation: (Number(settings.rotation) + 90) % 360 })}><RotateCcw size={15}/>Rotate</button><button onClick={() => setSettings({ ...settings, flipX: !settings.flipX })}>Flip</button><button onClick={() => setStrokes([])}><Trash2 size={15}/>Clear marks</button></div><div className="control-grid">{[['brightness','Brightness'],['contrast','Contrast'],['saturation','Color'],['sepia','Sepia'],['grayscale','B&W'],['blur','Soft focus']].map(([key, label]) => <label key={key}><span>{label}</span><input type="range" min={key === 'blur' ? 0 : 0} max={key === 'blur' ? 8 : 100} value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}/></label>)}</div><div className="form-grid"><Field label="Crop ratio"><select value={settings.crop} onChange={(e) => setSettings({ ...settings, crop: e.target.value })}><option>Original</option><option>4:3</option><option>3:2</option><option>1:1</option><option>16:9</option></select></Field><Field label="Watermark"><input value={settings.watermark} placeholder="Optional text" onChange={(e) => setSettings({ ...settings, watermark: e.target.value })}/></Field></div><p className="editor-hint"><Crop size={14}/> Click the preview to add a local annotation mark. Re-encoding removes original EXIF from edited copies.</p><div className="modal-foot"><span className="muted">Original stays untouched</span><button className="primary-button" onClick={onSave}><Save size={16}/>Save edited copy locally</button></div></div></div>; }
function TagPanel({ photo, onSave }) { const [tag, setTag] = useState(''); return <div className="simple-panel"><p className="modal-intro">Tags are kept in the local library and used by search and collections.</p><input autoFocus className="large-input" placeholder="e.g. Client, 2026, Favorite" value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && tag.trim() && onSave(tag.trim())}/><div className="existing-tags">{(photo?.tags || []).map((t) => <span key={t}>{t}</span>)}</div><div className="modal-foot"><span className="muted">Enter to add</span><button className="primary-button" disabled={!tag.trim()} onClick={() => onSave(tag.trim())}><Plus size={16}/>Add tag</button></div></div>; }
function HelpPanel() { return <div className="help-panel"><div className="help-row"><span>Import</span><p>Choose individual files, a folder, a mounted camera card, or use a permitted local camera.</p></div><div className="help-row"><span>Preview</span><p>Select photos from the grid, open the inspector, then print, edit, share, or batch-process.</p></div><div className="help-row"><span>Privacy</span><p>Images remain in IndexedDB on this device. There is no account, network client, sync, analytics, or upload path.</p></div><div className="help-row"><span>Shortcuts</span><p><kbd>I</kbd> opens import. <kbd>Esc</kbd> closes a tool.</p></div></div>; }
function SettingsPanel() { return <div className="settings-panel"><div className="setting-card"><div><b>Storage</b><span>Browser-local IndexedDB</span></div><span className="setting-good">On this device</span></div><div className="setting-card"><div><b>Network access</b><span>Disabled by application design</span></div><span className="setting-good">None</span></div><div className="setting-card"><div><b>Desktop hardening</b><span>Context isolation, sandbox, no Node integration</span></div><span className="setting-good">Active</span></div><p className="muted">Frameflow uses native Windows dialogs only for reading selected files, saving explicit exports, and opening print preview.</p></div>; }

createRoot(document.getElementById('root')).render(<App/>);
