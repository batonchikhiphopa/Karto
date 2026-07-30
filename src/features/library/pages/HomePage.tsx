import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { kartoDb } from "../../../platform/database";
import type { Deck } from "../../../shared/library";
import { Modal } from "../../../shared/ui/Modal";
import { DeckTile } from "../components/DeckTile";
import { createDeck, deleteDeck, listDecks, updateDeck } from "../model/library.repository";

export function HomePage() {
  const decks = useLiveQuery(listDecks, []);
  const cards = useLiveQuery(() => kartoDb.cards.toArray(), []);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Deck | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editing) await updateDeck(editing.id, name);
      else await createDeck(name);
      setCreating(false);
      setEditing(null);
      setName("");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить колоду.");
    }
  };

  const requestDelete = async (deck: Deck) => {
    if (window.confirm(`Удалить «${deck.name}» вместе со всеми карточками?`)) {
      await deleteDeck(deck.id);
    }
  };

  return (
    <section className="page home-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Библиотека</p>
          <h1>Ваши колоды</h1>
        </div>
        <button className="primary-action compact" type="button" onClick={() => setCreating(true)}>Новая колода</button>
      </header>

      <div className="deck-grid">
        {(decks ?? []).map((deck) => (
          <DeckTile
            cards={(cards ?? []).filter((card) => card.deckId === deck.id)}
            deck={deck}
            key={deck.id}
            onDelete={requestDelete}
            onEdit={(nextDeck) => {
              setEditing(nextDeck);
              setName(nextDeck.name);
            }}
          />
        ))}
        <button className="create-tile" type="button" onClick={() => setCreating(true)}>
          <span className="create-tile-inner">
            <span className="create-plus">+</span>
            <span className="create-text">Новая колода</span>
          </span>
        </button>
      </div>

      {(creating || editing) && (
        <Modal
          title={editing ? "Переименовать колоду" : "Новая колода"}
          onClose={() => {
            setCreating(false);
            setEditing(null);
            setName("");
            setError("");
          }}
        >
          <form className="stack-form" onSubmit={submit}>
            <label>
              <span>Название</span>
              <input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-action" type="submit">Сохранить</button>
          </form>
        </Modal>
      )}
    </section>
  );
}

