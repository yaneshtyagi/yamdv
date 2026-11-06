import { compileQuery } from "../search-core";
import { boundedMap, readFile } from "./files";
export function scopeFiles(
  scope,
  { tabs, active, folder, favorites, history, workspace },
) {
  const tabFile = (t) => (t?.file ? { ...t.file, _content: t.content } : null);
  const items =
    scope === "active"
      ? [tabFile(active)]
      : scope === "tabs"
        ? tabs.map(tabFile)
        : scope === "folder"
          ? folder
          : scope === "favorites"
            ? favorites
            : scope === "history"
              ? history
              : workspace;
  return [
    ...new Map((items || []).filter(Boolean).map((f) => [f.id, f])).values(),
  ];
}
export function workerSearch(
  content,
  query,
  options,
  signal,
  { WorkerClass = Worker, timeout = 1500 } = {},
) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted)
      return reject(new DOMException("Canceled", "AbortError"));
    const worker = new WorkerClass(
      new URL("../search.worker.js", import.meta.url),
      { type: "module" },
    );
    const finish = (err, value) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      err ? reject(err) : resolve(value);
    };
    const abort = () => finish(new DOMException("Canceled", "AbortError"));
    const timer = setTimeout(
      () =>
        finish(
          Error("Regex search timed out for this file. Simplify the pattern."),
        ),
      timeout,
    );
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }) =>
      data.error ? finish(Error(data.error)) : finish(null, data);
    worker.onerror = () => finish(Error("Search worker failed."));
    worker.postMessage({ id: 1, content, query, options });
  });
}
export async function searchDocuments(
  files,
  query,
  options,
  signal,
  { read = readFile, match = workerSearch } = {},
) {
  compileQuery(query, options);
  if (!query) return { groups: [], issues: [], truncated: false };
  const result = await boundedMap(
    files,
    async (file) => {
      const content = file._content ?? (await read(file));
      if (signal?.aborted) throw new DOMException("Canceled", "AbortError");
      if (content.length > 5_000_000)
        throw Error("File exceeds the 5 MB search limit.");
      return { file, ...(await match(content, query, options, signal)) };
    },
    { limit: 4, signal },
  );
  if (signal?.aborted) throw new DOMException("Canceled", "AbortError");
  let count = 0,
    truncated = false;
  const groups = [],
    issues = [];
  result.forEach((r, i) => {
    if (r?.error)
      issues.push({
        file: files[i],
        message: r.error.message,
        status: r.error.status,
      });
    else if (r?.value) {
      const value = r.value;
      truncated ||= value.truncated;
      if (value.matches.length) {
        const remaining = Math.max(0, 1000 - count);
        truncated ||= value.matches.length > remaining;
        const matches = value.matches.slice(0, remaining);
        count += matches.length;
        if (matches.length) groups.push({ ...value, matches });
      }
    }
  });
  return { groups, issues, truncated };
}
