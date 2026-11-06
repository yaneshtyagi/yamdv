import { desktop } from "./store";
export async function copyText(text) {
  if (desktop?.copyText) return desktop.copyText(text);
  if (navigator.clipboard?.writeText)
    return navigator.clipboard.writeText(text);
  const copy = (event) => {
    event.clipboardData?.setData("text/plain", text);
    event.preventDefault();
  };
  document.addEventListener("copy", copy);
  try {
    if (!document.execCommand("copy"))
      throw Error("Clipboard unavailable; use your system Copy shortcut.");
  } finally {
    document.removeEventListener("copy", copy);
  }
}
