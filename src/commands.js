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
    event.altKey !== parts.includes("Alt")
  )
    return false;
  const actual = event.key.toLowerCase();
  return last === "Plus"
    ? ["+", "="].includes(actual) ||
        (mod && event.altKey && event.code === "Equal")
    : last === "Minus"
      ? actual === "-" || (mod && event.altKey && event.code === "Minus")
      : actual === last.toLowerCase() ||
        (last === "0" && mod && event.altKey && event.code === "Digit0");
}
export const commandKeys = (command) =>
  [command.key, ...(command.aliases || [])].filter(Boolean);
export function matchesCommandShortcut(
  event,
  command,
  mac = /Mac/.test(navigator.platform),
) {
  return commandKeys(command).some((key) => matchesShortcut(event, key, mac));
}
export function shortcutLabel(key) {
  if (Array.isArray(key)) return key.map(shortcutLabel).join(" / ");
  return (key || "")
    .replace("Mod", /Mac/.test(navigator.platform) ? "⌘" : "Ctrl")
    .replace("Plus", "+")
    .replace("Minus", "−")
    .replace("Alt", /Mac/.test(navigator.platform) ? "⌥" : "Alt")
    .replace("ArrowLeft", "←")
    .replace("ArrowRight", "→")
    .replace("ArrowUp", "↑")
    .replace("ArrowDown", "↓");
}
