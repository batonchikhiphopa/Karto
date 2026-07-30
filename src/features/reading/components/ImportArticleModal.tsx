import { useState } from "react";
import type { MaterialLanguage, ReadingCategoryId } from "../../../shared/reading";
import { Modal } from "../../../shared/ui/Modal";
import { navigate } from "../../../app/navigation";
import { germanCategories } from "../model/reading.types";
import { extractOpenArticle, importArticle } from "../model/reading.repository";

interface ImportArticleModalProps {
  language: MaterialLanguage;
  initialCategory: ReadingCategoryId;
  onClose: () => void;
}

export function ImportArticleModal({ language, initialCategory, onClose }: ImportArticleModalProps) {
  const [mode, setMode] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [categoryId, setCategoryId] = useState<ReadingCategoryId>(initialCategory);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadUrl = async () => {
    setError("");
    setLoading(true);
    try {
      const extracted = await extractOpenArticle(url);
      setTitle(extracted.title);
      setText(extracted.text);
    } catch (reason) {
      setError(`${reason instanceof Error ? reason.message : "Не удалось открыть URL"} Браузер мог заблокировать источник: вставьте текст вручную.`);
      setMode("text");
    } finally {
      setLoading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) {
      setError("Сначала загрузите или вставьте текст статьи.");
      return;
    }
    setLoading(true);
    try {
      const item = await importArticle({ title, url, text, language, categoryId });
      onClose();
      navigate(`/read/${item.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить статью.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Читать с Карто" onClose={onClose} wide>
      <form className="stack-form article-import-form" onSubmit={submit}>
        <div className="segmented-control">
          <button className={mode === "url" ? "is-active" : ""} type="button" onClick={() => setMode("url")}>По URL</button>
          <button className={mode === "text" ? "is-active" : ""} type="button" onClick={() => setMode("text")}>Вставить текст</button>
        </div>

        {mode === "url" && (
          <label>
            <span>Открытый URL статьи</span>
            <div className="inline-input">
              <input type="url" required={mode === "url"} placeholder="https://…" value={url} onChange={(event) => setUrl(event.target.value)} />
              <button className="secondary-action" type="button" disabled={!url || loading} onClick={() => void loadUrl()}>
                {loading ? "Загружаем…" : "Получить текст"}
              </button>
            </div>
          </label>
        )}

        <label>
          <span>Название</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Название статьи" />
        </label>
        <label>
          <span>Категория</span>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value as ReadingCategoryId)}>
            {germanCategories.map((category) => <option value={category.id} key={category.id}>{category.label}</option>)}
          </select>
        </label>
        <label>
          <span>Текст</span>
          <textarea rows={14} value={text} onChange={(event) => setText(event.target.value)} placeholder="Вставьте сюда текст статьи…" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <footer className="form-actions">
          <button className="secondary-action" type="button" onClick={onClose}>Отмена</button>
          <button className="primary-action" type="submit" disabled={loading || !text.trim()}>Сохранить и читать</button>
        </footer>
      </form>
    </Modal>
  );
}
