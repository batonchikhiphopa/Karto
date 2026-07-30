import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { initializeKartoDatabase } from "./platform/initialize";
import "../style.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Karto root element is missing.");

async function start() {
  try {
    await initializeKartoDatabase();
    createRoot(root as HTMLElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (error) {
    console.error("[karto] Startup failed:", error);
    root!.innerHTML = `<main class="fatal-error"><h1>Karto не запустился</h1><p>Не удалось открыть локальную базу данных. Проверьте, разрешено ли браузеру хранить данные для этого сайта.</p></main>`;
  }
}

void start();
