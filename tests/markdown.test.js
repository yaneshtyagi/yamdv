import { describe, it, expect } from "vitest";
import { outlineFor, safeDiagram } from "../src/markdown";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { metadata } from "../src/markdown";
describe("Markdown metadata", () => {
  it("includes H1–H6, formatted headings, setext and collision-safe ids but excludes fences", () => {
    const source =
      "# **Hello** `world`\n\n## Hello world\n### Hello world-1\n#### Fourth\n##### Fifth\n###### Sixth\n\nSetext\n===\n\n```md\n# Hidden\n```";
    const out = outlineFor(source);
    expect(out.map((h) => h.depth)).toEqual([1, 2, 3, 4, 5, 6, 1]);
    expect(out.map((h) => h.id)).toEqual([
      "hello-world",
      "hello-world-1",
      "hello-world-1-1",
      "fourth",
      "fifth",
      "sixth",
      "setext",
    ]);
    const tree = unified()
      .use(remarkParse)
      .use(metadata)
      .runSync(unified().use(remarkParse).parse(source));
    expect(tree.children[0].data.hProperties.id).toBe(out[0].id);
    expect(tree.children[0].data.hProperties["data-source-start"]).toBe(1);
  });
  it("rejects unsafe Mermaid overrides/actions and excessive input", () => {
    expect(safeDiagram("graph TD\nA-->B")).toContain("A-->B");
    for (const code of [
      '%%{init: {securityLevel: "loose"}}%%\ngraph TD',
      "---\nconfig:\n---",
      'graph TD\nclick A "javascript:alert(1)"',
      "x".repeat(100001),
    ])
      expect(() => safeDiagram(code)).toThrow();
  });
});
