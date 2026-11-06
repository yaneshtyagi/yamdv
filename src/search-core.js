export function compileQuery(
  query,
  { regex = false, caseSensitive = false } = {},
) {
  if (!query) return null;
  if (query.length > 2048)
    throw Error("Search query exceeds the 2,048 character limit.");
  return new RegExp(
    regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    caseSensitive ? "g" : "gi",
  );
}
export function findMatches(content, query, options = {}) {
  const re = compileQuery(query, options);
  if (!re) return { matches: [], truncated: false };
  const starts = [0];
  for (let i = 0; i < content.length; i++)
    if (content[i] === "\n") starts.push(i + 1);
  const matches = [];
  let match,
    truncated = false;
  while ((match = re.exec(content))) {
    if (!match[0].length) {
      re.lastIndex += content.codePointAt(re.lastIndex) > 0xffff ? 2 : 1;
      continue;
    }
    let lo = 0,
      hi = starts.length;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (starts[mid] <= match.index) lo = mid;
      else hi = mid;
    }
    const from = Math.max(starts[lo], match.index - 55),
      to = Math.min(
        content.indexOf("\n", match.index) < 0
          ? content.length
          : content.indexOf("\n", match.index),
        match.index + match[0].length + 80,
      );
    matches.push({
      offset: match.index,
      length: match[0].length,
      line: lo + 1,
      column: match.index - starts[lo] + 1,
      snippet: content.slice(from, to),
      snippetOffset: match.index - from,
    });
    if (matches.length >= (options.maxMatches || 200)) {
      truncated = true;
      break;
    }
  }
  return { matches, truncated };
}
