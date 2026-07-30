import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Card } from "../../../shared/library";
import { russianCount } from "../../../shared/plural";
import { Link, navigate } from "../../../app/navigation";
import { CardEditor } from "../components/CardEditor";
import { deleteCard, getCards, getDeck } from "../model/library.repository";

interface DeckPageProps {
  fixedDeckId?: string;
  deckId?: string;
}

export function DeckPage({ fixedDeckId, deckId: routeDeckId }: DeckPageProps) {
  const deckId = fixedDeckId ?? routeDeckId ?? "";
  const deck = useLiveQuery(() => getDeck(deckId), [deckId]);
  const cards = useLiveQuery(() => getCards(deckId), [deckId]);
  const [editing, setEditing] = useState<Card | "new" | null>(null);

  if (deck === undefined || cards === undefined) {
    return <p className="empty-state page">Открываем колоду…</p>;
  }
  if (!deck) {
    return <section className="empty-state page"><h1>Колода не найдена</h1><Link to="/">Вернуться домой</Link></section>;
  }

  return (
    <section className="page deck-page">
      <header className="page-heading">
        <div>
          {!fixedDeckId && <button className="text-action" type="button" onClick={() => navigate("/")}>← Все колоды</button>}
          <p className="eyebrow">{deck.system ? "Слова из чтения" : "Колода"}</p>
          <h1>{deck.name}</h1>
          <p className="lede">{russianCount(cards.length, "карточка", "карточки", "карточек")}</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-action" type="button" disabled={!cards.length} onClick={() => navigate(`/study/${encodeURIComponent(deck.id)}`)}>Учить</button>
          <button className="primary-action" type="button" onClick={() => setEditing("new")}>Новая карточка</button>
        </div>
      </header>

      {cards.length ? (
        <div className="card-list">
          {cards.map((card) => (
            <article className="library-card" key={card.id}>
              {card.image && <img src={card.image} alt="" />}
              <div className="library-card-copy">
                <h2>{card.frontText}</h2>
                <p>{card.backText}</p>
                {card.extraSides.length > 0 && <small>+ {card.extraSides.length} доп. {card.extraSides.length === 1 ? "сторона" : "стороны"}</small>}
              </div>
              <div className="library-card-actions">
                <button className="text-action" type="button" onClick={() => setEditing(card)}>Изменить</button>
                <button className="text-action danger" type="button" onClick={() => {
                  if (window.confirm("Удалить эту карточку?")) void deleteCard(card.id);
                }}>Удалить</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state panel">
          <h2>Пока пусто</h2>
          <p>Добавьте первую карточку — текст, перевод, заметку и при желании изображение.</p>
          <button className="primary-action" type="button" onClick={() => setEditing("new")}>Добавить карточку</button>
        </div>
      )}

      {editing && (
        <CardEditor
          card={editing === "new" ? undefined : editing}
          deckId={deck.id}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
