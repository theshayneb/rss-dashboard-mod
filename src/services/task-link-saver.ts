import { normalizePath, TFile, type App } from "obsidian";
import type { FeedItem } from "../types/types";

export type TaskLinkResult =
  | { status: "added" | "already-listed"; file: TFile }
  | { status: "note-missing"; path: string }
  | { status: "no-link" };

/** A Markdown task linking to the article, titled when it has a title. */
export function formatArticleTask(item: Pick<FeedItem, "title" | "link">): string {
  const link = /[\s()<>]/.test(item.link) ? `<${item.link}>` : item.link;
  const title = (item.title || "").replace(/[[\]\s]+/g, " ").trim();
  return title ? `- [ ] [${title}](${link})` : `- [ ] ${link}`;
}

/**
 * The configured note, or, when that path does not exist, the only note in
 * the vault with the same file name, so a misspelt folder still works.
 */
export function resolveTaskNote(app: App, notePath: string): TFile | null {
  const path = normalizePath(notePath.trim());
  const exact = app.vault.getAbstractFileByPath(path);
  if (exact instanceof TFile) return exact;

  const fileName = path.split("/").pop()?.toLowerCase();
  if (!fileName) return null;
  const matches = app.vault
    .getFiles()
    .filter((file) => file.name.toLowerCase() === fileName);
  return matches.length === 1 && matches[0] ? matches[0] : null;
}

/** Appends the article's link as an unchecked task at the end of the note. */
export async function addArticleLinkTask(
  app: App,
  notePath: string,
  item: Pick<FeedItem, "title" | "link">,
): Promise<TaskLinkResult> {
  if (!item.link) return { status: "no-link" };

  const file = resolveTaskNote(app, notePath);
  if (!file) return { status: "note-missing", path: notePath.trim() };

  let alreadyListed = false;
  await app.vault.process(file, (data) => {
    if (data.includes(item.link)) {
      alreadyListed = true;
      return data;
    }
    const separator = data.length === 0 || data.endsWith("\n") ? "" : "\n";
    return `${data}${separator}${formatArticleTask(item)}\n`;
  });

  return { status: alreadyListed ? "already-listed" : "added", file };
}

/** The notice shown after the save button runs in task mode. */
export function describeTaskLinkResult(result: TaskLinkResult): string {
  switch (result.status) {
    case "added":
      return `Added to ${result.file.basename}`;
    case "already-listed":
      return `Already in ${result.file.basename}`;
    case "note-missing":
      return `Couldn't find ${result.path}. Check the to-do note under Settings → Article saving.`;
    case "no-link":
      return "This article has no link to add.";
  }
}
