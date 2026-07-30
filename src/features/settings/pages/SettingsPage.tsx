import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { kartoDb, resetKartoDatabase } from "../../../platform/database";
import { initializeKartoDatabase } from "../../../platform/initialize";
import type { AppTheme } from "../../../shared/library";
import { downloadBackup, importBackup } from "../model/backup";

export function SettingsPage() {
  const preferences = useLiveQuery(() => kartoDb.settings.get("preferences"), []);
  const importRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const setTheme = async (theme: AppTheme) => {
    document.documentElement.dataset.theme = theme;
    await kartoDb.settings.update("preferences", { theme });
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    try {
      const result = await importBackup(JSON.parse(await file.text()) as unknown);
      setMessage(`Импортировано: ${result.decks} колод, ${result.cards} карточек.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось импортировать файл.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const reset = async () => {
    const confirmed = window.confirm("Удалить все локальные колоды, карточки, статьи и прогресс? Это действие нельзя отменить.");
    if (!confirmed) return;
    await resetKartoDatabase();
    await initializeKartoDatabase();
    setMessage("Локальные данные очищены. Базовая подборка создана заново.");
  };

  return (
    <section className="page settings-page">
      <header className="page-heading">
        <div><p className="eyebrow">Настройки</p><h1>Karto 2.0</h1><p className="lede">PWA · TypeScript · IndexedDB · без аккаунта</p></div>
      </header>

      <div className="settings-grid">
        <section className="panel settings-section">
          <h2>Внешний вид</h2>
          <label>
            <span>Тема</span>
            <select value={preferences?.theme ?? "system"} onChange={(event) => void setTheme(event.target.value as AppTheme)}>
              <option value="system">Как в системе</option>
              <option value="dark">Тёмная</option>
              <option value="light">Светлая</option>
            </select>
          </label>
          <p className="settings-hint">Язык материалов меняется отдельно в разделе «Читаем с Карто».</p>
        </section>

        <section className="panel settings-section">
          <h2>Резервная копия</h2>
          <p>Экспорт включает колоды, изображения, прогресс, статьи, источники и настройки.</p>
          <div className="button-row">
            <button className="secondary-action" type="button" onClick={() => void downloadBackup()}>Скачать JSON</button>
            <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => void onImport(event.target.files?.[0])} />
            <button className="secondary-action" type="button" onClick={() => importRef.current?.click()}>Импортировать</button>
          </div>
          <p className="settings-hint">Поддерживаются резервные копии Karto 2.0 и старый формат с колодами и вложенными карточками.</p>
        </section>

        <section className="panel settings-section">
          <h2>Локальное хранение</h2>
          <p>Все пользовательские данные лежат в IndexedDB этого браузера. Для переноса на другое устройство используйте экспорт.</p>
          <button className="secondary-action danger-outline" type="button" onClick={() => void reset()}>Удалить локальные данные</button>
        </section>

        <section className="panel settings-section">
          <h2>Установка</h2>
          <p>Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран». После первого открытия интерфейс работает офлайн.</p>
        </section>
      </div>
      {message && <p className="status-message success">{message}</p>}
      {error && <p className="status-message error">{error}</p>}
    </section>
  );
}

