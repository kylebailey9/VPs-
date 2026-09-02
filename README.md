# Frameflow Studio for Windows

Frameflow Studio is an original, offline-first Windows photo workspace. It is inspired by the public user-facing workflow of PhotoLightning without using its code, branding, screenshots, or assets.

## Included coverage

- Import individual images, folders, subfolders, and mounted camera or memory-card folders
- Local camera capture when Windows grants camera permission
- Duplicate-aware local import into browser IndexedDB
- Thumbnail library, search, tags, favorites, selected sets, and chronological Photo History
- Large inspector preview with captions, dates, file size, and local source information
- Non-destructive edits: brightness, contrast, color, grayscale, sepia, soft focus, crop ratios, rotate, flip, watermark, and click-to-mark annotations
- Batch captions, web-safe rename, local capture-date metadata, resize, crop, format conversion, JPEG quality, watermark, email, web, eBay, and print presets
- Print preview with wallet, 3.5 x 5, 4 x 6, 5 x 7, and 8 x 10 choices, multi-up layouts, copies, and captions
- Local HTML email drafts, ZIP share packages, Word/PowerPoint-compatible HTML handoffs, backup archives, thumbnail indexes, and self-contained HTML slideshows
- Slideshow preview with play/pause, filmstrip navigation, timing, and local export

## Privacy and security

Photo blobs and metadata stay in browser-local IndexedDB. No server, account, upload, sync, telemetry, analytics, or background transfer path is included. Exports are written only after an explicit save action, and edited exports are re-encoded so their original EXIF is not carried forward.

Electron keeps context isolation, sandboxing, web security, disabled Node integration, a narrow preload bridge, and a local-only CSP. The bridge exposes only native image selection, folder selection, explicit file saving, printing, and the local Pictures path.

## Build on Windows

```powershell
npm install
npm run build
npm run package:win
```

The installer is written to `release\Frameflow-Studio-Setup-0.1.0.exe`.

For source development:

```powershell
npm run desktop:dev
```

## Deliberate boundaries

Direct online photo-processor uploads, automatic email sending, Outlook/COM insertion, DPOF writes back to a memory card, optical CD/DVD burning, printer-vendor paper templates, and sound attached to slideshows require external services, Office or device APIs, or hardware-specific integrations. Frameflow provides local, explicit handoffs for those workflows instead of moving photo data in the background.
