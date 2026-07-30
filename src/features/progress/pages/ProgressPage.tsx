import { useLiveQuery } from "dexie-react-hooks";
import { kartoDb } from "../../../platform/database";

export function ProgressPage() {
  const sessions = useLiveQuery(() => kartoDb.studySessions.orderBy("finishedAt").reverse().toArray(), []);
  const progress = useLiveQuery(() => kartoDb.studyProgress.toArray(), []);
  const totalReviewed = (sessions ?? []).reduce((sum, session) => sum + session.reviewed, 0);
  const totalCorrect = (sessions ?? []).reduce((sum, session) => sum + session.correct, 0);
  const accuracy = totalReviewed ? Math.round((totalCorrect / totalReviewed) * 100) : 0;
  const learned = (progress ?? []).filter((item) => item.intervalDays >= 7).length;

  return (
    <section className="page progress-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Прогресс</p>
          <h1>Ритм обучения</h1>
          <p className="lede">Статистика хранится только в этом браузере.</p>
        </div>
      </header>
      <div className="metric-grid">
        <article className="metric-card"><strong>{totalReviewed}</strong><span>ответов</span></article>
        <article className="metric-card"><strong>{accuracy}%</strong><span>уверенно</span></article>
        <article className="metric-card"><strong>{learned}</strong><span>интервал ≥ 7 дней</span></article>
        <article className="metric-card"><strong>{sessions?.length ?? 0}</strong><span>сессий</span></article>
      </div>
      <section className="panel">
        <h2>Последние занятия</h2>
        {sessions?.length ? (
          <div className="session-list">
            {sessions.slice(0, 20).map((session) => (
              <article key={session.id}>
                <div><strong>{session.deckName}</strong><span>{new Date(session.finishedAt).toLocaleString("ru")}</span></div>
                <p>{session.reviewed} карточек · {session.correct} знаю · {session.unsure} не уверен · {session.wrong} не знаю</p>
              </article>
            ))}
          </div>
        ) : <p className="empty-state">Завершите первое повторение — оно появится здесь.</p>}
      </section>
    </section>
  );
}

