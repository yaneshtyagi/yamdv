export const isMarkdown = (name) => /\.(md|markdown|mdown|mkd)$/i.test(name);
export function recordHistory(history, file) {
  return [
    { ...file, openedAt: Date.now() },
    ...history.filter((item) => item.id !== file.id),
  ].slice(0, 200);
}
export function readSaved(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function resolveRelative(from, target) {
  const parts = from.split("/");
  parts.pop();
  for (const part of decodeURIComponent(target).split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}
