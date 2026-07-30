import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { kartoDb } from "../../../platform/database";
import { Link, navigate } from "../../../app/navigation";
import { WORDS_DECK_ID } from "../../../shared/library";
import { Modal } from "../../../shared/ui/Modal";
import { saveCard } from "../../library/model/library.repository";
import { getReadingItem, markReadingOpened } from "../model/reading.repository";

function splitText(text: string): string[] {
  return text.split(/(\p{L}+(?:[-’']\p{L}+)*)/gu);
}

export function ReaderPage({ itemId }: { itemId: string }) {
  const item = useLiveQuery(() => getReadingItem(itemId), [itemId]);
  const [selectedWord, setSelectedWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const paragraphs = useMemo(() => (item?.content ?? "").split(/\n{2,}/).map((part) => part.trim()).filter(Boolean), [item?.content]);

  useEffect(() => {
    if (item) void markReadingOpened(item.id);
  }, [item]);

  const saveWord = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveCard(WORDS_DECK_ID, { frontText: selectedWord, backText: translation });
    setSavedMessage(`«${selectedWord}» добавлено в «Слова».`);
    setSelectedWord("");
    setTranslation("");
  };

  if (item === undefined) return <p className="empty-state page">Открываем материал…</p>;
  if (!item) return <section className="empty-state page"><h1>Материал не найден</h1><Link to="/read">Вернуться к чтению</Link></section>;

  return (
    <article className="reader-page">
      <header className="reader-topbar">
        <button className="text-action" type="button" onClick={() => navigate("/read")}>← Подборка</button>
        <div>
          <span>{item.sourceLabel}</span>
          {item.originalUrl && <a href={item.originalUrl} target="_blank" rel="noreferrer">Оригинал ↗</a>}
        </div>
      </header>
      <div className="reader-content">
        <p className="eyebrow">{item.language.toUpperCase()} · {item.sourceLabel}</p>
        <h1>{item.title}</h1>
        {item.summary && !item.content && <p className="reader-lede">{item.summary}</p>}
        {paragraphs.length ? (
          <div className="article-copy">
            {paragraphs.map((paragraph, paragraphIndex) => (
              <p key={`${paragraph.slice(0, 20)}-${paragraphIndex}`}>
                {splitText(paragraph).map((token, tokenIndex) => (
                  /^\p{L}/u.test(token)
                    ? <button className="reader-word" type="button" key={`${tokenIndex}-${token}`} onClick={() => {
                      setSelectedWord(token);
                      setTranslation("");
                      setSavedMessage("");
                    }}>{token}</button>
                    : <span key={`${tokenIndex}-${token}`}>{token}</span>
                ))}
              </p>
            ))}
          </div>
        ) : (
          <section className="reader-placeholder">
            <h2>Текст не сохранён локально</h2>
            <p>Эта ссылка пришла из стартовой подборки. Откройте оригинал или добавьте статью по URL/текстом через кнопку «Читать с Карто».</p>
            <div className="button-row">
              {item.originalUrl && <a className="primary-action" href={item.originalUrl} target="_blank" rel="noreferrer">Открыть оригинал ↗</a>}
              <button className="secondary-action" type="button" onClick={() => navigate("/read")}>Добавить текст</button>
            </div>
          </section>
        )}
        {savedMessage && <p className="status-message success">{savedMessage}</p>}
      </div>

      {selectedWord && (
        <Modal title={`Сохранить «${selectedWord}»`} onClose={() => setSelectedWord("")}>
          <form className="stack-form" onSubmit={saveWord}>
            <label><span>Перевод или пояснение</span><textarea autoFocus required rows={4} value={translation} onChange={(event) => setTranslation(event.target.value)} /></label>
            <div className="word-tools">
              <a href={`https://www.dwds.de/wb/${encodeURIComponent(selectedWord)}`} target="_blank" rel="noreferrer">Проверить в DWDS ↗</a>
            </div>
            <button className="primary-action" type="submit">Добавить в «Слова»</button>
          </form>
        </Modal>
      )}
    </article>
  );
}
