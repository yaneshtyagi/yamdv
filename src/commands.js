import commands from "../shared/commands.json";
export { commands };
export function commandEnabled(command, ctx) {
  return !command.needs || !!ctx[command.needs];
}
export function matchesShortcut(
  event,
  key,
  mac = /Mac/.test(navigator.platform),
) {
  if (!key) return false;
  const parts = key.split("+"),
    last = parts.pop();
  const mod = parts.includes("Mod");
  if (
    event.metaKey !== (mod && mac) ||
    event.ctrlKey !== (parts.includes("Ctrl") || (mod && !mac)) ||
    (last !== "Plus" && event.shiftKey !== parts.includes("Shift")) ||
    event.altKey
  )
    return false;
  const actual = event.key.toLowerCase();
  return last === "Plus"
    ? ["+", "="].includes(actual)
    : last === "Minus"
      ? actual === "-"
      : actual === last.toLowerCase();
}
export function shortcutLabel(key) {
  return (key || "")
    .replace("Mod", /Mac/.test(navigator.platform) ? "⌘" : "Ctrl")
    .replace("Plus", "+")
    .replace("Minus", "−");
}
