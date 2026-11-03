import { describe, it, expect } from "vitest";
import { recordHistory, isMarkdown, resolveRelative } from "../src/library";
describe("document library", () => {
  it("keeps 200 unique files with most recently opened first", () => {
    let history = [];
    for (let n = 0; n < 205; n++)
      history = recordHistory(history, { id: String(n) });
    expect(history).toHaveLength(200);
    expect(history.at(-1).id).toBe("5");
    history = recordHistory(history, { id: "20" });
    expect(history[0].id).toBe("20");
    expect(history.filter((f) => f.id === "20")).toHaveLength(1);
    expect(history).toHaveLength(200);
  });
  it("recognizes Markdown extensions without including unrelated files", () => {
    expect(isMarkdown("README.MD")).toBe(true);
    expect(isMarkdown("notes.markdown")).toBe(true);
    expect(isMarkdown("notes.md.exe")).toBe(false);
  });
  it("resolves sibling and parent document paths", () => {
    expect(resolveRelative("docs/guide/start.md", "../README.md")).toBe(
      "docs/README.md",
    );
    expect(resolveRelative("docs/start.md", "./next.md")).toBe("docs/next.md");
  });
});
