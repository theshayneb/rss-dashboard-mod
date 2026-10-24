/**
 * Settings that arrive from another device re-render the dashboard. That
 * must not throw the user back to the top of the article list or feed list.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installObsidianDomPolyfills } from "../test-dom-polyfills";
import { RssDashboardView } from "../../../src/views/dashboard-view";

/** A dashboard whose refresh rebuilds both scroll areas from scratch. */
function dashboardStandIn() {
  const containerEl = document.body.appendChild(createDiv());
  const build = () => {
    containerEl.empty();
    containerEl.createDiv({ cls: "rss-dashboard-feed-folders-section" });
    containerEl.createDiv({ cls: "rss-dashboard-articles" });
  };
  build();
  return { containerEl, refresh: vi.fn(build) };
}

function scrollOf(containerEl: HTMLElement, selector: string): number {
  return containerEl.querySelector<HTMLElement>(selector)?.scrollTop ?? -1;
}

beforeEach(() => {
  installObsidianDomPolyfills();
  document.body.empty();
});

describe("RssDashboardView.refreshKeepingScroll()", () => {
  it("re-renders and keeps the article list and feed list scrolled where they were", () => {
    const view = dashboardStandIn();
    view.containerEl.querySelector<HTMLElement>(
      ".rss-dashboard-articles",
    )!.scrollTop = 640;
    view.containerEl.querySelector<HTMLElement>(
      ".rss-dashboard-feed-folders-section",
    )!.scrollTop = 220;

    RssDashboardView.prototype.refreshKeepingScroll.call(
      view as unknown as RssDashboardView,
    );

    expect(view.refresh).toHaveBeenCalledTimes(1);
    expect(scrollOf(view.containerEl, ".rss-dashboard-articles")).toBe(640);
    expect(
      scrollOf(view.containerEl, ".rss-dashboard-feed-folders-section"),
    ).toBe(220);
  });
});
