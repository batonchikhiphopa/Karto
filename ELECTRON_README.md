# Karto → Desktop .exe (Electron)

## What goes where

Copy these files to the **root** of your Karto project (next to `server.js`, `app.js`, etc.):

```
karto/
├── main.js ← new file (Electron entry point)
├── package.json ← replace existing
├── server.js ← one edit (see below)
└── ... (everything else unchanged)
```

---

## Code changes

The current desktop version already uses the built-in HTTP server:

- `main.js` starts the server via `require("./server")` and `await server.start()`
- `server.js` exports `createServer()` and `createApp()`
- separate `spawn("node", ["server.js"])` is no longer used

---

## One command - install and build

```bash
npm install && npm run build:win
```

The finished installer will appear in the `dist/` folder.

The file will be named something like `Karto Setup 1.0.0.exe`.

---

##Commands

| Command | What does it do |
|---|---|
| `npm install` | Installs all dependencies, including Electron |
| `npm start` | Runs the desktop application (for development) |
| `npm run build:win` | Builds an `.exe` installer for Windows |
| `npm run build:mac` | Builds a `.dmg` for macOS |
| `npm run build:linux` | Builds `.AppImage` for Linux |
| `npm test` | Run tests (as before) |
| `npm run dev-server` | Starts only the server (as before `npm start`) |

---

## How it works

```
Electron (main.js)
│
├─ createServer(...) ← The built-in Express/HTTP server starts in the same process
│
└─ BrowserWindow.loadURL(...) ← The window displays the frontend via a local URL
```

When the application closes, Electron calls `await server.stop()`, so the local port is released without creating a separate child process.

---

##Notes

- **The `.env`** file is searched in several places in the desktop version.
The order is: explicit `envPath`, `KARTO_ENV_PATH`, `PORTABLE_EXECUTABLE_DIR\\.env`,
`.env` next to `process.execPath`, `.env` in `process.cwd()`, then `.env` next to `server.js`.
For a portable build, put `.env` next to the original portable `.exe`.
For an unpacked or installed build, put `.env` next to `Karto.exe`.
System environment variables are also supported and take precedence.
- **localStorage** is stored in the system application data folder (not next to `.exe`).
On Windows, this is `%APPDATA%\Karto`.
- The build requires about 200–300 MB — Electron includes Chromium and Node.js.