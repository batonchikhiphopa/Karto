import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { kartoDb } from "../../../platform/database";
import { Link } from "../../../app/navigation";
import {
  materialLanguages,
  type MaterialLanguage,
  type ReadingCategoryId,
  type ReadingItem
} from "../../../shared/reading";
import { AddSourceModal } from "../components/AddSourceModal";
import { ImportArticleModal } from "../components/ImportArticleModal";
import { getReadingItems } from "../model/reading.repository";
import { useReadingUiStore } from "../model/reading.store";
import { germanCategories } from "../model/reading.types";

const languageLabels: Record<MaterialLanguage, string> = {
  de: "Deutsch",
  en: "English",
  ru: "Русский",
  uk: "Українська"
};

export function ReadingFeedPage() {
  const { materialLanguage, categoryId, setCategoryId, setMaterialLanguage } = useReadingUiStore();
  const savedItems = useLiveQuery(() => getReadingItems(materialLanguage), [materialLanguage]);
  const sources = useLiveQuery(() => kartoDb.readingSources.where("language").equals(materialLanguage).toArray(), [materialLanguage]);
  const [importing, setImporting] = useState(false);
  const [addingSource, setAddingSource] = useState(false);
  const activeCategory: ReadingCategoryId = categoryId === "all" ? "gesellschaft" : categoryId;
  const items = (savedItems ?? []).filter((item: ReadingItem) => categoryId === "all" || item.categoryId === categoryId);
  const visibleSources = (sources ?? []).filter((source) => (
    source.builtIn || categoryId === "all" || source.categoryId === categoryId
  ));

  return (
    <section className="page reading-page">
      <header className="reading-header">
        <div>
          <p className="eyebrow">Читаем с Карто</p>
          <h1>Читайте настоящее. Запоминайте нужное.</h1>
          <p className="lede">Подборка и ваши источники зависят от языка материалов, а не от языка интерфейса.</p>
        </div>
        <label className="language-field">
          <span>Язык материалов</span>
          <select value={materialLanguage} onChange={(event) => setMaterialLanguage(event.target.value as MaterialLanguage)}>
            {materialLanguages.map((language) => (
              <option key={language} value={language} disabled={language !== "de"}>
                {languageLabels[language]}{language !== "de" ? " · скоро" : ""}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="reading-toolbar">
        <div className="category-list" aria-label="Категории материалов">
          <button className={categoryId === "all" ? "is-selected" : ""} onClick={() => setCategoryId("all")}>Все</button>
          {germanCategories.map((category) => (
            <button className={categoryId === category.id ? "is-selected" : ""} key={category.id} onClick={() => setCategoryId(category.id)}>
              {category.label}
            </button>
          ))}
        </div>
        <button className="primary-action" type="button" onClick={() => setImporting(true)}>Читать с Карто</button>
      </div>

      <div className="source-strip">
        <span>Источники:</span>
        {visibleSources.map((source) => (
          <a href={source.homepageUrl} target="_blank" rel="noreferrer" key={source.id}>{source.label} ↗</a>
        ))}
        <button type="button" onClick={() => setAddingSource(true)}>+ Добавить свой</button>
      </div>

      <section className="source-grid" aria-label="Материалы">
        {!savedItems && <p className="empty-state">Открываем локальную библиотеку…</p>}
        {items.map((item) => (
          <article className="source-card" key={item.id}>
            <p className="source-badge">{item.sourceLabel}</p>
            <h2>{item.title}</h2>
            <p>{item.summary || germanCategories.find((category) => category.id === item.categoryId)?.label}</p>
            <div className="source-card-actions">
              <Link to={`/read/${item.id}`}>Читать в Карто</Link>
              {item.originalUrl && <a href={item.originalUrl} target="_blank" rel="noreferrer">Оригинал ↗</a>}
            </div>
          </article>
        ))}
        {savedItems && items.length === 0 && <p className="empty-state">В этой категории пока нет материалов.</p>}
      </section>

      {importing && <ImportArticleModal language={materialLanguage} initialCategory={activeCategory} onClose={() => setImporting(false)} />}
      {addingSource && <AddSourceModal language={materialLanguage} initialCategory={activeCategory} onClose={() => setAddingSource(false)} />}
    </section>
  );
}
