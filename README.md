# Frameflow Studio for Windows

An original Electron desktop deliverable for Frameflow Studio. It reuses the Frameflow interface and browser-safe photo workflows, but runs as a local Windows application with native file dialogs, filesystem export, and print handoff.

## Privacy and storage boundary

Frameflow stores imported photo blobs and metadata locally in the app's IndexedDB profile. The desktop shell has no application backend, photo server, remote database, automatic sync, telemetry, or background transfer. The seeded demo artwork is bundled with the app, so the initial workspace works offline.

Cloud and online-processor screens are handoff placeholders. Saving a destination stores only that setting locally. Frameflow does not contact it or upload photos unless a future provider-specific connector is separately added and the user explicitly configures and initiates that action. The current build only makes local exports, opens a user-directed email draft, opens an explicitly chosen processor page, or invokes Windows sharing when the OS provides it.

## Run from source

```bash
cd /home/user/photolightning-port-windows
npm install
npm run desktop
```

`npm run desktop:dev` rebuilds the local renderer and launches the same offline desktop shell. `npm run dev` runs the renderer in a browser for UI work.

## Build a Windows installer

Run this on Windows. This project already contains the Windows x64 NSIS configuration:

```powershell
cd C:\path\to\photolightning-port-windows
npm install
npm run package:win
```

The NSIS installer is written to `release\` and creates Start Menu and optional desktop shortcuts. `npm run build` only creates the renderer bundle in `dist\`. The build uses `compression: store` to keep constrained build hosts from spending memory on installer compression.

## Desktop additions

- Native Windows photo open dialog for JPG, PNG, WEBP, GIF, and BMP files
- Native Save dialog for archive backups
- Native Chromium print dialog, including physical printer or PDF selection
- Electron preload bridge with context isolation, disabled Node integration, sandboxed renderer, and local-file loading
- Bundled original demo artwork for offline startup
- Existing local library, IndexedDB persistence, captions, tags, selection, history, slideshow, editing, annotations, red-eye spot assist, batch tools, ZIP exports, Office-compatible HTML exports, email draft handoff, camera permission flow, sharing, and integration placeholder screens

## Windows-only limits

- Direct printer status/control is outside the browser/Electron print API; printing goes through the Windows print dialog.
- CD/DVD burning requires Windows or a native helper and is represented by archive export.
- Camera capture depends on Windows camera permissions and an available camera.
- Native Office automation, cloud provider APIs, email sending, and online processor uploads are intentionally not connected.
- The app reads selected files into its local browser profile; it does not watch folders or sync them automatically.

## Linux packaging result

The renderer build and Windows payload staging completed in the sandbox. Electron Builder could not finish the NSIS installer here: the first full cross-package attempt was killed with exit 137 under the sandbox's approximately 1 GB RAM and no swap, and the resource-conscious prepackaged NSIS attempt stopped because Wine is not installed. No installer artifact was retained.

The shortest Windows-side command is `npm install && npm run package:win`.
