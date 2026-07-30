import { kartoDb } from "../../../platform/database";
import { stableId } from "../../../shared/ids";
import type { ReadingCategoryId, ReadingItem } from "../../../shared/reading";
import { esquireOfflineFallback } from "./reading.fallback";

const ESQUIRE_URL = "https://www.esquire.de/";

function categoryFromUrl(url: string): ReadingCategoryId {
  if (/style|fashion|uhren|grooming/i.test(url)) return "style";
  if (/digital|technik|tech|auto/i.test(url)) return "technologie";
  if (/business|karriere|leben|health|food/i.test(url)) return "arbeit-leben";
  if (/entertainment|musik|film|kultur/i.test(url)) return "kultur-unterhaltung";
  return "gesellschaft";
}

function toItem(
  article: Pick<ReadingItem, "title" | "originalUrl"> & Partial<Pick<ReadingItem, "categoryId">>
): ReadingItem {
  return {
    id: stableId("article", article.originalUrl),
    sourceId: "esquire-de",
    sourceLabel: "Esquire DE",
    language: "de",
    categoryId: article.categoryId ?? categoryFromUrl(article.originalUrl),
    title: article.title,
    originalUrl: article.originalUrl,
    publishedAt: null,
    author: null,
    summary: null,
    content: null,
    imageUrl: null,
    importedAt: new Date().toISOString()
  };
}

async function fetchFreshEsquire(): Promise<ReadingItem[]> {
  const response = await fetch(ESQUIRE_URL, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`Esquire returned ${response.status}`);
  const documentNode = new DOMParser().parseFromString(await response.text(), "text/html");
  const seen = new Set<string>();
  const items: ReadingItem[] = [];

  for (const link of Array.from(documentNode.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    const title = (link.querySelector("h1,h2,h3")?.textContent ?? link.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (title.length < 24) continue;
    const originalUrl = new URL(link.href, ESQUIRE_URL).href;
    if (!originalUrl.startsWith(ESQUIRE_URL) || seen.has(originalUrl)) continue;
    if (!/\/(news|entertainment|style|lifestyle|food|digital)\//.test(originalUrl)) continue;
    seen.add(originalUrl);
    items.push(toItem({ title, originalUrl }));
    if (items.length === 5) break;
  }
  if (items.length < 5) throw new Error("Not enough article links in Esquire response.");
  return items;
}

export async function seedGermanReading(): Promise<void> {
  const existingCount = await kartoDb.readingItems.where("sourceId").equals("esquire-de").count();
  if (existingCount > 0) return;

  let items: ReadingItem[];
  try {
    items = await fetchFreshEsquire();
  } catch {
    items = esquireOfflineFallback.map(toItem);
  }
  await kartoDb.readingItems.bulkPut(items.slice(0, 5));
}

