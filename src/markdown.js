import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { toString } from "mdast-util-to-string";
import GithubSlugger from "github-slugger";
export function metadata() {
  return (tree) => {
    const slugger = new GithubSlugger();
    function visit(node) {
      if (node.position) {
        node.data ||= {};
        node.data.hProperties = {
          ...node.data.hProperties,
          "data-source-start": node.position.start.line,
          "data-source-end": node.position.end.line,
        };
      }
      if (node.type === "heading") {
        node.data.hProperties.id = slugger.slug(toString(node));
      }
      node.children?.forEach(visit);
    }
    visit(tree);
  };
}
const parser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(metadata);
export function analyzeMarkdown(source) {
  const tree = parser.runSync(parser.parse(source));
  const result = [];
  let hasDiagram = false;
  function visit(n) {
    if (n.type === "code" && n.lang === "mermaid") hasDiagram = true;
    if (n.type === "heading")
      result.push({
        id: n.data.hProperties.id,
        depth: n.depth,
        text: toString(n),
        line: n.position.start.line,
      });
    n.children?.forEach(visit);
  }
  visit(tree);
  return { outline: result, hasDiagram };
}
export function safeDiagram(source) {
  if (source.length > 100000)
    throw Error("Diagram exceeds the 100,000 character limit.");
  if (/%%\s*\{|^\s*---|^\s*click\s/im.test(source))
    throw Error(
      "Diagram configuration directives, frontmatter and click actions are disabled for safety.",
    );
  return source;
}

export function outlineFor(source) {
  return analyzeMarkdown(source).outline;
}
