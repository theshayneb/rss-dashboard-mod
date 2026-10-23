/**
 * The save button's to-do mode: appending the online article's link to a
 * note as an unchecked Markdown task.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "obsidian";
import {
  addArticleLinkTask,
  describeTaskLinkResult,
  formatArticleTask,
} from "../../../src/services/task-link-saver";

const NOTE = "Planning & Productivity/To-Dos & Projects/Tasks & Chores.md";
const article = {
  title: "A good read",
  link: "https://example.com/posts/good-read",
};

let app: App;

beforeEach(async () => {
  app = App.createMock();
  await app.vault.createFolder("Planning & Productivity/To-Dos & Projects");
});

async function readNote(path = NOTE): Promise<string> {
  return app.vault.adapter.read(path);
}

describe("formatArticleTask()", () => {
  it("writes an unchecked task linking the title to the online article", () => {
    expect(formatArticleTask(article)).toBe(
      "- [ ] [A good read](https://example.com/posts/good-read)",
    );
  });

  it("falls back to the bare link when the article has no title", () => {
    expect(formatArticleTask({ title: "", link: article.link })).toBe(
      "- [ ] https://example.com/posts/good-read",
    );
  });

  it("keeps brackets in a title from breaking the link", () => {
    expect(
      formatArticleTask({ title: "[Video] Launch", link: article.link }),
    ).toBe("- [ ] [Video Launch](https://example.com/posts/good-read)");
  });

  it("wraps a link containing spaces or parentheses in angle brackets", () => {
    expect(
      formatArticleTask({ title: "Wiki", link: "https://en.wikipedia.org/wiki/A_(b)" }),
    ).toBe("- [ ] [Wiki](<https://en.wikipedia.org/wiki/A_(b)>)");
  });
});

describe("addArticleLinkTask()", () => {
  it("appends the task on a new line at the bottom of the note", async () => {
    await app.vault.create(NOTE, "# Tasks\n- [ ] Laundry");

    const result = await addArticleLinkTask(app, NOTE, article);

    expect(result.status).toBe("added");
    expect(await readNote()).toBe(
      "# Tasks\n- [ ] Laundry\n- [ ] [A good read](https://example.com/posts/good-read)\n",
    );
  });

  it("does not add the same article twice", async () => {
    await app.vault.create(NOTE, "");
    await addArticleLinkTask(app, NOTE, article);

    const result = await addArticleLinkTask(app, NOTE, article);

    expect(result.status).toBe("already-listed");
    expect((await readNote()).match(/good-read/g)).toHaveLength(1);
  });

  it("finds the note by file name when its folder is spelled differently", async () => {
    await app.vault.create(NOTE, "");

    const result = await addArticleLinkTask(
      app,
      "Planning & Prodcutivity/To-Dos & Projects/Tasks & Chores.md",
      article,
    );

    expect(result.status).toBe("added");
    expect(await readNote()).toContain("good-read");
  });

  it("creates nothing and explains when the note does not exist", async () => {
    const result = await addArticleLinkTask(app, NOTE, article);

    expect(result).toEqual({ status: "note-missing", path: NOTE });
    expect(await app.vault.adapter.exists(NOTE)).toBe(false);
    expect(describeTaskLinkResult(result)).toContain("Couldn't find");
  });
});
