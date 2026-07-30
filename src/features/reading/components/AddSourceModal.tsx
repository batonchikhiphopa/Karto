import { useState } from "react";
import type { MaterialLanguage, ReadingCategoryId } from "../../../shared/reading";
import { Modal } from "../../../shared/ui/Modal";
import { germanCategories } from "../model/reading.types";
import { saveReadingSource } from "../model/reading.repository";

interface AddSourceModalProps {
  language: MaterialLanguage;
  initialCategory: ReadingCategoryId;
  onClose: () => void;
}

export function AddSourceModal({ language, initialCategory, onClose }: AddSourceModalProps) {
  const [label, setLabel] = useState("");
  const [homepageUrl, setHomepageUrl] = useState("");
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      new URL(homepageUrl);
      await saveReadingSource({ label, homepageUrl, language, categoryId });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Проверьте название и URL.");
    }
  };

  return (
    <Modal title="Специализированный источник" onClose={onClose}>
      <form className="stack-form" onSubmit={submit}>
        <label><span>Название</span><input autoFocus required value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Например, t3n" /></label>
        <label><span>Главная страница или лента</span><input required type="url" value={homepageUrl} onChange={(event) => setHomepageUrl(event.target.value)} placeholder="https://…" /></label>
        <label>
          <span>Категория</span>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value as ReadingCategoryId)}>
            {germanCategories.map((category) => <option value={category.id} key={category.id}>{category.label}</option>)}
          </select>
        </label>
        <p className="settings-hint">Источник появится в категории. Отдельную статью из него можно добавить по URL через «Читать с Карто».</p>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-action" type="submit">Добавить источник</button>
      </form>
    </Modal>
  );
}

