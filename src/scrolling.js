// Unlike scrollIntoView, this never scrolls a document's ancestor panes/window.
export function centerInReader(reader, element) {
  if (!reader || !element || !reader.contains(element) || !reader.clientHeight)
    return;
  const viewport = reader.getBoundingClientRect(),
    target = element.getBoundingClientRect();
  // Rects include ancestor CSS zoom; scrollTop uses unzoomed CSS pixels.
  const scale = viewport.height / reader.clientHeight || 1;
  const delta =
    (target.top + target.height / 2 - viewport.top - viewport.height / 2) /
    scale;
  reader.scrollTo({
    top: Math.max(0, reader.scrollTop + delta),
    behavior: "instant",
  });
}
