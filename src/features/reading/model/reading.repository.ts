import { kartoDb } from "../../../platform/database";
import { createId, stableId } from "../../../shared/ids";
import type {
  MaterialLanguage,
  ReadingCategoryId,
  ReadingItem,
  ReadingSource
} from "../../../shared/reading";

export async function getReadingItems(language: MaterialLanguage): Promise<ReadingItem[]> {
  const items = await kartoDb.readingItems.where("language").equals(language).toArray();
  return items.sort((left, right) => right.importedAt.localeCompare(left.importedAt));
}

export async function getReadingItem(itemId: string): Promise<ReadingItem | undefined> {
  return kartoDb.readingItems.get(itemId);
}

export async function saveReadingSource(
  input: Pick<ReadingSource, "label" | "homepageUrl" | "language" | "categoryId">
): Promise<ReadingSource> {
  const source: ReadingSource = {
    ...input,
    id: createId("source"),
    label: input.label.trim(),
    homepageUrl: input.homepageUrl.trim(),
    builtIn: false,
    enabled: true,
    createdAt: new Date().toISOString()
  };
  await kartoDb.readingSources.add(source);
  return source;
}

export interface ImportArticleInput {
  title: string;
  url?: string;
  text: string;
  language: MaterialLanguage;
  categoryId: ReadingCategoryId;
}

export async function importArticle(input: ImportArticleInput): Promise<ReadingItem> {
  const originalUrl = input.url?.trim() ?? "";
  const title = input.title.trim() || "Материал без названия";
  const item: ReadingItem = {
    id: originalUrl ? stableId("article", originalUrl) : createId("article"),
    sourceId: "manual",
    sourceLabel: originalUrl ? new URL(originalUrl).hostname.replace(/^www\./, "") : "Мой текст",
    language: input.language,
    categoryId: input.categoryId,
    title,
    originalUrl,
    publishedAt: null,
    author: null,
    summary: input.text.trim().slice(0, 220) || null,
    content: input.text.trim() || null,
    imageUrl: null,
    importedAt: new Date().toISOString()
  };
  await kartoDb.readingItems.put(item);
  return item;
}

function cleanDocument(documentNode: Document): string {
  documentNode.querySelectorAll("script,style,noscript,nav,footer,header,aside,form").forEach((node) => node.remove());
  const article = documentNode.querySelector("article,main,[role=main]") ?? documentNode.body;
  return (article?.textContent ?? "").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();
}

export async function extractOpenArticle(url: string): Promise<{ title: string; text: string }> {
  const normalizedUrl = new URL(url).href;
  const response = await fetch(normalizedUrl, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Источник ответил с кодом ${response.status}.`);
  const documentNode = new DOMParser().parseFromString(await response.text(), "text/html");
  const title = documentNode.querySelector("h1")?.textContent?.trim()
    || documentNode.querySelector("title")?.textContent?.trim()
    || new URL(normalizedUrl).hostname;
  const text = cleanDocument(documentNode);
  if (text.length < 100) throw new Error("Не удалось извлечь основной текст.");
  return { title, text };
}

export async function markReadingOpened(itemId: string): Promise<void> {
  const previous = await kartoDb.readingProgress.get(itemId);
  await kartoDb.readingProgress.put({
    itemId,
    openedAt: previous?.openedAt ?? new Date().toISOString(),
    completedAt: previous?.completedAt ?? null,
    position: previous?.position ?? 0
  });
}

