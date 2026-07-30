import { useEffect, useMemo, useState } from "react";
import type { Card, Deck } from "../../../shared/library";
import { russianCount } from "../../../shared/plural";
import { navigate } from "../../../app/navigation";

interface DeckTileProps {
  deck: Deck;
  cards: Card[];
  onEdit: (deck: Deck) => void;
  onDelete: (deck: Deck) => void;
}

export function DeckTile({ deck, cards, onEdit, onDelete }: DeckTileProps) {
  const images = useMemo(
    () => [...new Set(cards.map((card) => card.image).filter((image): image is string => Boolean(image)))].slice(0, 6),
    [cards]
  );
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const timer = window.setInterval(() => setActiveImage((current) => (current + 1) % images.length), 4_200);
    return () => window.clearInterval(timer);
  }, [images.length]);

  return (
    <article className={`deck-tile${images.length ? "" : " deck-tile-no-image"}`} data-system-deck={deck.system}>
      <div className={`deck-media-stage${images.length ? "" : " is-empty"}`} aria-hidden="true">
        {images.map((image, index) => (
          <img
            alt=""
            className={`deck-media-image${activeImage === index ? " is-active" : ""}`}
            key={image}
            src={image}
          />
        ))}
      </div>
      <div className="deck-overlay" />
      <button
        className="deck-tile-surface"
        type="button"
        aria-label={`Открыть колоду ${deck.name}`}
        onClick={() => navigate(deck.system ? "/words" : `/decks/${encodeURIComponent(deck.id)}`)}
      />
      <div className="tile-action-bar">
        <div className="tile-action-group">
          <button className="tile-action" type="button" onClick={() => navigate(`/study/${encodeURIComponent(deck.id)}`)} title="Учить">▶</button>
        </div>
        <div className="tile-action-group">
          <button className="tile-action" data-action="edit-deck" type="button" onClick={() => onEdit(deck)} title="Переименовать">✎</button>
          <button className="tile-action" data-action="delete-deck" type="button" onClick={() => onDelete(deck)} title="Удалить">×</button>
        </div>
      </div>
      <footer className="deck-tile-footer">
        <div className="deck-tile-name">{deck.name}</div>
        <div className="deck-tile-count">{russianCount(cards.length, "карточка", "карточки", "карточек")}</div>
      </footer>
    </article>
  );
}
