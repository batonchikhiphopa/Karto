import { useState } from "react";
import { WORDS_DECK_ID } from "../shared/library";
import { HomePage } from "../features/library/pages/HomePage";
import { DeckPage } from "../features/library/pages/DeckPage";
import { ProgressPage } from "../features/progress/pages/ProgressPage";
import { ReaderPage } from "../features/reading/pages/ReaderPage";
import { ReadingFeedPage } from "../features/reading/pages/ReadingFeedPage";
import { SettingsPage } from "../features/settings/pages/SettingsPage";
import { StudyPage } from "../features/study/pages/StudyPage";
import { Link, routeId, usePathname } from "./navigation";
import logoUrl from "../../logo.svg";

const navigation = [
  { to: "/read", label: "Читаем с Карто", icon: "◫" },
  { to: "/words", label: "Слова", icon: "Aa" },
  { to: "/", label: "Колоды", icon: "▦", exact: true },
  { to: "/progress", label: "Прогресс", icon: "↗" },
  { to: "/settings", label: "Настройки", icon: "⚙" }
];

function Page({ pathname }: { pathname: string }) {
  if (pathname === "/") return <HomePage />;
  if (pathname === "/words") return <DeckPage fixedDeckId={WORDS_DECK_ID} />;
  if (pathname === "/read") return <ReadingFeedPage />;
  if (pathname.startsWith("/read/")) return <ReaderPage itemId={routeId(pathname, "/read/")} />;
  if (pathname.startsWith("/decks/")) return <DeckPage deckId={routeId(pathname, "/decks/")} />;
  if (pathname === "/progress") return <ProgressPage />;
  if (pathname === "/settings") return <SettingsPage />;
  return <HomePage />;
}

export function App() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  if (pathname.startsWith("/study/")) {
    return <StudyPage deckId={routeId(pathname, "/study/")} />;
  }

  return (
    <div className="app-shell">
      <button className="mobile-menu-button" type="button" aria-label="Открыть меню" onClick={() => setMenuOpen(true)}>☰</button>
      {menuOpen && <button className="sidebar-overlay" type="button" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar react-sidebar${menuOpen ? " is-open" : ""}`}>
        <header className="sidebar-brand">
          <div className="sidebar-logo"><img src={logoUrl} alt="" /></div>
          <div className="sidebar-brand-text"><p className="sidebar-kicker">local-first</p><h1 className="sidebar-title">Karto</h1></div>
          <button className="sidebar-close" type="button" onClick={() => setMenuOpen(false)}>×</button>
        </header>
        <nav className="sidebar-panel" aria-label="Основная навигация">
          {navigation.map(({ to, label, icon, exact }) => {
            const active = exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
            return (
              <Link className={`sidebar-link${active ? " active" : ""}`} key={to} to={to} onClick={() => setMenuOpen(false)}>
                <span className="nav-icon">{icon}</span>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <p className="migration-note">Karto 2.0<br />Данные остаются на устройстве</p>
      </aside>
      <main className="main main-content">
        <Page pathname={pathname} />
      </main>
    </div>
  );
}

