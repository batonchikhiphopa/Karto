# Karto → Desktop .exe (Electron)

## Что куда положить

Скопируйте эти файлы в **корень** вашего проекта Karto (рядом с `server.js`, `app.js` и т.д.):

```
karto/
├── main.js          ← новый файл (Electron точка входа)
├── package.json     ← заменить существующий
├── server.js        ← одна правка (см. ниже)
└── ... (всё остальное без изменений)
```

---

## Правки в коде

Текущая desktop-версия уже использует встроенный HTTP-сервер:

- `main.js` поднимает сервер через `require("./server")` и `await server.start()`
- `server.js` экспортирует `createServer()` и `createApp()`
- отдельный `spawn("node", ["server.js"])` больше не используется

---

## Одна команда — установка и сборка

```bash
npm install && npm run build:win
```

Готовый установщик появится в папке `dist/`.  
Файл будет называться примерно `Karto Setup 1.0.0.exe`.

---

## Команды

| Команда | Что делает |
|---|---|
| `npm install` | Устанавливает все зависимости включая Electron |
| `npm start` | Запускает десктопное приложение (для разработки) |
| `npm run build:win` | Собирает `.exe` установщик для Windows |
| `npm run build:mac` | Собирает `.dmg` для macOS |
| `npm run build:linux` | Собирает `.AppImage` для Linux |
| `npm test` | Запускает тесты (как раньше) |
| `npm run dev-server` | Запускает только сервер (как раньше `npm start`) |

---

## Как это работает

```
Electron (main.js)
    │
    ├─ createServer(...)              ← встроенный Express/HTTP сервер стартует в том же процессе
    │
    └─ BrowserWindow.loadURL(...)     ← окно показывает фронтенд через локальный URL
```

При закрытии приложения Electron вызывает `await server.stop()`, поэтому локальный порт освобождается без отдельного дочернего процесса.

---

## Заметки

- **Файл `.env`** в desktop-версии ищется в нескольких местах.
  Порядок такой: явный `envPath`, `KARTO_ENV_PATH`, `PORTABLE_EXECUTABLE_DIR\\.env`,
  `.env` рядом с `process.execPath`, `.env` в `process.cwd()`, затем `.env` рядом с `server.js`.
  Для portable-сборки кладите `.env` рядом с исходным portable `.exe`.
  Для unpacked или установленной сборки кладите `.env` рядом с `Karto.exe`.
  Системные переменные окружения тоже поддерживаются и имеют приоритет.
- **localStorage** хранится в системной папке данных приложения (не рядом с `.exe`).
  На Windows это `%APPDATA%\Karto`.
- Сборка требует около 200–300 МБ — Electron включает в себя Chromium и Node.js.
