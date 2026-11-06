import React, { useEffect, useRef, useState } from "react";
import { searchDocuments, scopeFiles } from "../services/search";
export default function SearchPanel({
  scope,
  onScope,
  sources,
  onResult,
  onResults,
  activeResult,
  onClose,
  vim,
}) {
  const [query, setQuery] = useState(""),
    [regex, setRegex] = useState(false),
    [caseSensitive, setCase] = useState(false),
    [data, setData] = useState({ groups: [], issues: [] }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input = useRef();
  useEffect(() => {
    input.current?.focus();
  }, [scope]);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setData({ groups: [], issues: [] });
    onResults([]);
    setBusy(!!query);
    const timer = setTimeout(async () => {
      try {
        const files = scopeFiles(scope, sources);
        const result = await searchDocuments(
          files,
          query,
          { regex, caseSensitive },
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setData(result);
          onResults(
            result.groups.flatMap((g) =>
              g.matches.map((match) => ({ file: g.file, match })),
            ),
          );
        }
      } catch (e) {
        if (e.name !== "AbortError" && !controller.signal.aborted) {
          setError(e.message);
          setData({ groups: [], issues: [] });
          onResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, regex, caseSensitive, scope, sources]);
  return (
    <section className="search-panel" aria-label="Document search">
      <div className="search-title">
        <strong>SEARCH</strong>
        <button aria-label="Close search" onClick={onClose}>
          ×
        </button>
      </div>
      <label>
        Scope
        <select value={scope} onChange={(e) => onScope(e.target.value)}>
          {[
            ["active", "Active document"],
            ["tabs", "All open tabs"],
            ["folder", "Current folder"],
            ["favorites", "Favorites"],
            ["history", "History"],
            ["workspace", "Current workspace"],
          ].map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <div className="search-input">
        <input
          ref={input}
          aria-label="Search Markdown source"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Markdown source…"
        />
        <button
          aria-label="Case sensitive"
          aria-pressed={caseSensitive}
          title="Match case"
          onClick={() => setCase(!caseSensitive)}
        >
          Aa
        </button>
        <button
          aria-label="Regular expression"
          aria-pressed={regex}
          onClick={() => setRegex(!regex)}
        >
          .*
        </button>
      </div>
      <div className="search-status" role="status">
        {busy
          ? "Searching…"
          : `${data.groups.reduce((n, g) => n + g.matches.length, 0)} matches · ${data.groups.length} files`}
        {data.truncated ? " · Results limited to 200/file and 1,000 total" : ""}
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="search-results">
        {data.groups.map((group) => (
          <details open key={group.file.id}>
            <summary>
              {group.file.name} <small>{group.matches.length}</small>
            </summary>
            {group.matches.map((match) => (
              <div
                className={
                  "search-result " +
                  (activeResult?.file.id === group.file.id &&
                  activeResult?.match.offset === match.offset
                    ? "active"
                    : "")
                }
                key={match.offset}
              >
                <button
                  onClick={() => onResult(group.file, match, false)}
                  title={group.file.relative}
                >
                  {match.line}:{match.column}{" "}
                  <span>
                    {match.snippet.slice(0, match.snippetOffset)}
                    <mark>
                      {match.snippet.slice(
                        match.snippetOffset,
                        match.snippetOffset + match.length,
                      )}
                    </mark>
                    {match.snippet.slice(match.snippetOffset + match.length)}
                  </span>
                </button>
                <button
                  aria-label={`Open match at line ${match.line} in new tab`}
                  onClick={() => onResult(group.file, match, true)}
                >
                  ↗
                </button>
              </div>
            ))}
          </details>
        ))}
        {data.issues.map((issue) => (
          <p className="search-issue" key={issue.file.id}>
            {issue.file.name}: {issue.message}
          </p>
        ))}
      </div>
      <small className="search-hint">
        Source search · F3 / Shift+F3: next / previous match
      </small>
    </section>
  );
}
