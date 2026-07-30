import type { ReadingItem } from "../../../shared/reading";

export const esquireOfflineFallback: Array<
  Pick<ReadingItem, "title" | "originalUrl" | "categoryId">
> = [
  {
    title: "Safety First! Wie wir Großveranstaltungen in Zeiten wie diesen wirklich genießen können",
    originalUrl: "https://www.esquire.de/news/gesellschaft/sicherheit-grossveranstaltungen-csd-deutschland-interview",
    categoryId: "gesellschaft"
  },
  {
    title: "Job Crafting statt Jobwechsel! So macht der Job endlich wieder Bock",
    originalUrl: "https://www.esquire.de/news/business-karriere/unzufrieden-im-job-mit-job-crafting-macht-arbeit-spass",
    categoryId: "arbeit-leben"
  },
  {
    title: "Wie BTS einen Rekord nach dem anderen knackt – und sogar das südkoreanische BIP befeuert",
    originalUrl: "https://www.esquire.de/entertainment/musik/bts-zahlen-weltrekorde-klicks-streams",
    categoryId: "kultur-unterhaltung"
  },
  {
    title: "Wie sich die Musikbranche gegen KI-generierte Musik zur Wehr setzt",
    originalUrl: "https://www.esquire.de/entertainment/musik/ki-musik-musikbranche-wehrt",
    categoryId: "technologie"
  },
  {
    title: "Esquire Sneaker Ticker: die neuesten Trend-Schuhe der Woche",
    originalUrl: "https://www.esquire.de/style/casual-fashion/sneaker-ticker-adidas-vans-trend-schuhe",
    categoryId: "style"
  }
];

