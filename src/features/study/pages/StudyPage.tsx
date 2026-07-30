import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getCards, getDeck } from "../../library/model/library.repository";
import type { Card, StudyProgress, StudyResult } from "../../../shared/library";
import { russianCount } from "../../../shared/plural";
import { navigate } from "../../../app/navigation";
import {
  getDueCardIds,
  gradeCard,
  restoreProgress,
  saveStudySession
} from "../model/study.repository";

interface UndoEntry {
  cardIndex: number;
  result: StudyResult;
  previous: StudyProgress | undefined;
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function StudyPage({ deckId }: { deckId: string }) {
  const deck = useLiveQuery(() => getDeck(deckId), [deckId]);
  const allCards = useLiveQuery(() => getCards(deckId), [deckId]);
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [index, setIndex] = useState(0);
  const [side, setSide] = useState(0);
  const [hovered, setHovered] = useState<StudyResult | "undo" | null>(null);
  const [undo, setUndo] = useState<UndoEntry | null>(null);
  const [stats, setStats] = useState({ correct: 0, unsure: 0, wrong: 0 });
  const startedAt = useRef(new Date().toISOString());
  const saved = useRef(false);

  useEffect(() => {
    if (!allCards || queue) return;
    void getDueCardIds(deckId).then((ids) => {
      const due = new Set(ids);
      setQueue(shuffled(allCards.filter((card) => due.has(card.id))));
    });
  }, [allCards, deckId, queue]);

  const card = queue?.[index];
  const answerSides = useMemo(() => card ? [card.backText, ...card.extraSides.map((item) => item.text)] : [], [card]);
  const flipped = side > 0;
  const complete = queue !== null && index >= queue.length;

  const finishSession = useCallback(async () => {
    if (saved.current || !deck || !queue || index === 0) return;
    saved.current = true;
    await saveStudySession({
      deckId: deck.id,
      deckName: deck.name,
      startedAt: startedAt.current,
      reviewed: index,
      ...stats
    });
  }, [deck, index, queue, stats]);

  useEffect(() => {
    if (complete) void finishSession();
  }, [complete, finishSession]);

  const exit = useCallback(async () => {
    await finishSession();
    navigate(deck?.system ? "/words" : `/decks/${deckId}`);
  }, [deck?.system, deckId, finishSession, navigate]);

  const flip = useCallback(() => {
    if (!card) return;
    setSide((current) => current === 0 ? 1 : current >= answerSides.length ? 1 : current + 1);
  }, [answerSides.length, card]);

  const grade = useCallback(async (result: StudyResult) => {
    if (!card) return;
    const { previous } = await gradeCard(card.id, deckId, result);
    setUndo({ cardIndex: index, result, previous });
    setStats((current) => ({ ...current, [result]: current[result] + 1 }));
    setIndex((current) => current + 1);
    setSide(0);
  }, [card, deckId, index]);

  const undoLast = useCallback(async () => {
    if (!undo || !queue) return;
    const previousCard = queue[undo.cardIndex];
    if (!previousCard) return;
    await restoreProgress(previousCard.id, undo.previous);
    setStats((current) => ({ ...current, [undo.result]: Math.max(0, current[undo.result] - 1) }));
    setIndex(undo.cardIndex);
    setSide(0);
    setUndo(null);
    saved.current = false;
  }, [queue, undo]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void exit();
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        flip();
      }
      if (event.key === "ArrowLeft" || event.key === "1") void grade("wrong");
      if (event.key === "ArrowDown" || event.key === "2") void grade("unsure");
      if (event.key === "ArrowRight" || event.key === "3") void grade("correct");
      if (event.key === "ArrowUp" || (event.ctrlKey && event.key.toLowerCase() === "z")) void undoLast();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exit, flip, grade, undoLast]);

  if (!deck || queue === null) {
    return (
      <section className="screen-study">
        <div className="study-wrap">
          <div className="study-card-area">
            <div className="study-card-loading"><span className="study-card-loading-spinner" /><span className="study-card-loading-text">Готовим повторение</span></div>
          </div>
        </div>
      </section>
    );
  }

  if (!queue.length) {
    return (
      <section className="screen-study">
        <div className="study-wrap">
          <div className="study-complete">
            <p className="eyebrow">На сегодня всё</p>
            <h1>Нет карточек к повторению</h1>
            <p>Следующие карточки появятся здесь, когда наступит срок.</p>
            <button className="primary-action" type="button" onClick={() => void exit()}>Вернуться</button>
          </div>
        </div>
      </section>
    );
  }

  if (complete) {
    const accuracy = Math.round((stats.correct / Math.max(1, queue.length)) * 100);
    return (
      <section className="screen-study">
        <div className="study-wrap">
          <div className="study-complete">
            <p className="eyebrow">Сессия завершена</p>
            <h1>{russianCount(queue.length, "карточка", "карточки", "карточек")}</h1>
            <p>{accuracy}% уверенных ответов · {stats.unsure} сомнений · {stats.wrong} ошибок</p>
            <button className="primary-action" type="button" onClick={() => void exit()}>Готово</button>
          </div>
        </div>
      </section>
    );
  }

  if (!card) {
    return null;
  }

  const visibleText = flipped ? answerSides[side - 1] : card.frontText;
  const visibleImage = card.image && ((flipped && card.imageSide === "back") || (!flipped && card.imageSide === "front"));
  const layoutClass = visibleImage && flipped ? "is-side" : visibleImage ? "is-top" : "is-text-only";

  return (
    <section className="screen-study">
      <div
        className="study-wrap"
        style={{
          "--left-glow": hovered === "wrong" ? 1 : 0,
          "--right-glow": hovered === "correct" ? 1 : 0,
          "--bottom-glow": hovered === "unsure" ? 1 : 0,
          "--top-glow": hovered === "undo" ? 1 : 0
        } as React.CSSProperties}
      >
        <button className="icon-button study-exit-btn" type="button" onClick={() => void exit()} aria-label="Выйти">×</button>
        <button className="study-edge study-edge-left" type="button" onMouseEnter={() => setHovered("wrong")} onMouseLeave={() => setHovered(null)} onClick={() => void grade("wrong")}>
          <span className={`study-edge-label${hovered === "wrong" ? " visible" : ""}`}>Не знаю · 1</span>
        </button>
        <button className="study-edge study-edge-right" type="button" onMouseEnter={() => setHovered("correct")} onMouseLeave={() => setHovered(null)} onClick={() => void grade("correct")}>
          <span className={`study-edge-label${hovered === "correct" ? " visible" : ""}`}>Знаю · 3</span>
        </button>
        <button className="study-edge study-edge-bottom" type="button" onMouseEnter={() => setHovered("unsure")} onMouseLeave={() => setHovered(null)} onClick={() => void grade("unsure")}>
          <span className={`study-edge-label${hovered === "unsure" ? " visible" : ""}`}>Не уверен · 2</span>
        </button>
        <button className="study-edge study-edge-top" type="button" disabled={!undo} onMouseEnter={() => setHovered("undo")} onMouseLeave={() => setHovered(null)} onClick={() => void undoLast()}>
          <span className={`study-edge-label${hovered === "undo" && undo ? " visible" : ""}`}>Отменить · ↑</span>
        </button>

        <div className="study-card-area">
          <button
            className={`study-card${flipped ? " is-flipped" : ""}${visibleImage ? " has-media" : ""}${visibleImage && flipped ? " is-layout-side" : ""}`}
            type="button"
            onClick={flip}
          >
            <div className={`study-card-content ${layoutClass}`}>
              {visibleImage && <div className="study-card-media"><img className="study-card-img" src={card.image} alt="" /></div>}
              <div className="study-card-copy">
                <span className="study-card-tag">{flipped ? "Ответ" : `${index + 1} / ${queue.length}`}</span>
                {flipped && answerSides.length > 1 && <span className="study-answer-progress">{side} / {answerSides.length}</span>}
                <div className={flipped ? `study-back-text${visibleImage ? " has-media" : ""}` : `study-front-text${visibleImage ? " has-media" : ""}`}>
                  {visibleText}
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}
