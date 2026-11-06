// Offsets are UTF-16 DOM offsets. Word motions return whole grapheme-cluster boundaries.
export function wordMotion(text, offset, motion) {
  const chars = [];
  let index = 0;
  for (const { segment: char } of new Intl.Segmenter(undefined, {
    granularity: "grapheme",
  }).segment(text)) {
    chars.push({
      char,
      index,
      type: /\s/u.test(char)
        ? "space"
        : /[\p{L}\p{N}_]/u.test(char)
          ? "word"
          : "punct",
    });
    index += char.length;
  }
  if (!chars.length) return 0;
  let i = chars.findIndex((c) => c.index >= offset);
  if (i < 0) i = chars.length;
  if (motion === "b") {
    i = Math.max(0, i - 1);
    while (i > 0 && chars[i].type === "space") i--;
    const type = chars[i].type;
    while (i > 0 && chars[i - 1].type === type) i--;
  } else if (motion === "e") {
    i = Math.min(i, chars.length - 1);
    if (i < chars.length - 1 && chars[i + 1].type !== chars[i].type) i++;
    while (i < chars.length - 1 && chars[i].type === "space") i++;
    while (i < chars.length - 1 && chars[i + 1].type === chars[i].type) i++;
  } else {
    if (i < chars.length) {
      const type = chars[i].type;
      while (i < chars.length && chars[i].type === type) i++;
    }
    while (i < chars.length && chars[i].type === "space") i++;
  }
  return chars[i]?.index ?? text.length;
}
export function nextCharacter(text, offset) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  for (const part of segmenter.segment(text))
    if (part.index + part.segment.length > offset)
      return part.index + part.segment.length;
  return text.length;
}
export function previousCharacter(text, offset) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let previous = 0;
  for (const part of segmenter.segment(text)) {
    if (part.index >= offset) break;
    previous = part.index;
  }
  return previous;
}
const ignored =
  "button,input,textarea,select,script,style,[data-reader-ui],.diagram,.katex-mathml";
export function textModel(article) {
  const nodes = [],
    byNode = new WeakMap();
  let text = "",
    previousBlock = null;
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode,
      parent = node.parentElement;
    if (
      !node.length ||
      !parent ||
      parent.closest(ignored) ||
      !parent.getClientRects().length
    )
      continue;
    const block = parent.closest("pre,p,h1,h2,h3,h4,h5,h6,li,td,th,blockquote");
    if (
      !block ||
      (!node.textContent.trim() &&
        !parent.closest("pre,code") &&
        parent === article)
    )
      continue;
    if (previousBlock && block !== previousBlock && !text.endsWith("\n"))
      text += "\n";
    const segment = {
      node,
      start: text.length,
      end: text.length + node.length,
    };
    nodes.push(segment);
    byNode.set(node, segment);
    text += node.textContent;
    previousBlock = block;
  }
  function point(offset) {
    offset = Math.max(0, Math.min(text.length, offset));
    const segment = nodes.find((s) => offset < s.end) || nodes.at(-1);
    return segment
      ? {
          node: segment.node,
          offset: Math.max(
            0,
            Math.min(segment.node.length, offset - segment.start),
          ),
        }
      : null;
  }
  function offset(node, index) {
    const found = byNode.get(node);
    if (found) return found.start + Math.min(index, node.length);
    if (!node || !article.contains(node)) return null;
    const range = document.createRange();
    try {
      range.setStart(node, index);
      range.collapse(true);
      for (const segment of nodes) {
        if (range.comparePoint(segment.node, 0) >= 0) return segment.start;
      }
      return text.length;
    } catch {
      return null;
    }
  }
  return { text, nodes, point, offset };
}
export function caretRect(model, offset) {
  const point = model.point(offset);
  if (!point) return null;
  const range = document.createRange();
  range.setStart(point.node, point.offset);
  range.collapse(true);
  let rect = range.getBoundingClientRect();
  if (!rect.height) {
    const other = model.point(
      offset < model.text.length
        ? nextCharacter(model.text, offset)
        : previousCharacter(model.text, offset),
    );
    if (other && other.node === point.node) {
      range.setStart(point.node, Math.min(point.offset, other.offset));
      range.setEnd(point.node, Math.max(point.offset, other.offset));
      const box = range.getBoundingClientRect();
      rect = {
        ...box.toJSON(),
        left: offset < model.text.length ? box.left : box.right,
      };
    }
  }
  return rect.height ? rect : null;
}
