import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DOMPurify from "dompurify";
import { safeDiagram } from "../markdown";
let renderQueue = Promise.resolve();
export default function Diagram({ source, theme }) {
  const [svg, setSvg] = useState(""),
    [error, setError] = useState(""),
    [full, setFull] = useState(false),
    [zoom, setZoom] = useState(1),
    [size, setSize] = useState({ width: 800, height: 400 });
  const viewport = useRef(),
    origin = useRef(),
    closing = useRef();
  useEffect(() => {
    let canceled = false;
    setError("");
    setSvg("");
    renderQueue = renderQueue
      .catch(() => {})
      .then(async () => {
        const text = safeDiagram(source);
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          htmlLabels: false,
          theme: theme === "dark" ? "dark" : "default",
          maxTextSize: 100000,
          maxEdges: 500,
          suppressErrorRendering: true,
          secure: [
            "securityLevel",
            "startOnLoad",
            "maxTextSize",
            "maxEdges",
            "htmlLabels",
            "theme",
            "flowchart",
          ],
          flowchart: { htmlLabels: false, useMaxWidth: false },
        });
        const id = "diagram-" + crypto.randomUUID();
        try {
          const result = await mermaid.render(id, text);
          if (canceled) return;
          const clean = DOMPurify.sanitize(result.svg, {
            USE_PROFILES: { svg: true, svgFilters: true },
            FORBID_TAGS: ["a", "foreignObject", "script"],
          });
          const doc = new DOMParser().parseFromString(clean, "image/svg+xml"),
            root = doc.documentElement;
          const values = root
            .getAttribute("viewBox")
            ?.split(/[ ,]+/)
            .map(Number);
          if (values?.length === 4 && values.every(Number.isFinite))
            setSize({
              width: Math.max(1, values[2]),
              height: Math.max(1, values[3]),
            });
          setSvg(clean);
        } finally {
          document.getElementById("d" + id)?.remove();
        }
      })
      .catch((e) => {
        if (!canceled) setError(e.message);
      });
    return () => {
      canceled = true;
    };
  }, [source, theme]);
  const adjust = (delta) =>
    setZoom((z) =>
      Math.min(5, Math.max(0.1, Math.round((z + delta) * 10) / 10)),
    );
  function fit() {
    if (viewport.current)
      setZoom(
        Math.max(
          0.1,
          Math.min(
            2,
            (viewport.current.clientWidth - 40) / size.width,
            (viewport.current.clientHeight - 40) / size.height,
          ),
        ),
      );
  }
  function exit() {
    setFull(false);
    queueMicrotask(() => closing.current?.focus());
  }
  useEffect(() => {
    if (full) {
      origin.current = document.activeElement;
      viewport.current?.focus();
    } else origin.current?.focus();
  }, [full]);
  useEffect(() => {
    if (!full) return;
    const listener = (e) => {
      if (e.detail === "zoom-in") adjust(0.1);
      else if (e.detail === "zoom-out") adjust(-0.1);
      else if (e.detail === "zoom-reset") setZoom(1);
    };
    window.addEventListener("diagram-command", listener);
    return () => window.removeEventListener("diagram-command", listener);
  }, [full]);
  function key(e) {
    if (e.key === "Escape" && full) {
      e.preventDefault();
      e.stopPropagation();
      exit();
      return;
    }
    const direction = {
      ArrowLeft: [-80, 0],
      ArrowRight: [80, 0],
      ArrowUp: [0, -80],
      ArrowDown: [0, 80],
    };
    if (full && direction[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      viewport.current?.scrollBy(...direction[e.key]);
    }
    if ((e.metaKey || e.ctrlKey) && ["+", "=", "-", "0"].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "0") setZoom(1);
      else adjust(e.key === "-" ? -0.1 : 0.1);
    }
    if (e.key === "Tab" && full) {
      const buttons = [
        ...e.currentTarget.querySelectorAll('button,[tabindex="0"]'),
      ];
      if (e.shiftKey && document.activeElement === buttons[0]) {
        e.preventDefault();
        buttons.at(-1)?.focus();
      } else if (!e.shiftKey && document.activeElement === buttons.at(-1)) {
        e.preventDefault();
        buttons[0]?.focus();
      }
    }
  }
  const view = (
    <section
      className={"diagram " + (full ? "diagram-fullscreen" : "")}
      data-diagram-fullscreen={full || undefined}
      role={full ? "dialog" : undefined}
      aria-modal={full || undefined}
      aria-label="Mermaid diagram"
      onKeyDown={key}
    >
      <div className="diagram-toolbar">
        <span>Mermaid</span>
        <button aria-label="Zoom diagram out" onClick={() => adjust(-0.1)}>
          −
        </button>
        <output>{Math.round(zoom * 100)}%</output>
        <button aria-label="Zoom diagram in" onClick={() => adjust(0.1)}>
          +
        </button>
        <button onClick={() => setZoom(1)}>Reset</button>
        <button onClick={fit}>Fit</button>
        <button ref={closing} onClick={() => (full ? exit() : setFull(true))}>
          {full ? "Exit Full Screen" : "Full Screen"}
        </button>
      </div>
      {error ? (
        <div role="alert" className="diagram-error">
          Unable to render diagram: {error}
          <pre>{source}</pre>
        </div>
      ) : (
        <div
          ref={viewport}
          tabIndex={0}
          className="diagram-viewport"
          style={{
            height: full
              ? "calc(100dvh - 72px)"
              : Math.min(450, size.height * zoom + 40),
          }}
          aria-label="Diagram viewport; use arrow keys to pan in full screen"
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              adjust(e.deltaY < 0 ? 0.1 : -0.1);
            }
          }}
        >
          {svg ? (
            <div
              className="diagram-svg"
              style={{ width: size.width * zoom, height: size.height * zoom }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <p role="status">Rendering diagram…</p>
          )}
        </div>
      )}
      {full && (
        <small>
          Arrow keys: pan · ⌘/Ctrl +/-: zoom · 0: reset · Tab: controls · Esc:
          close
        </small>
      )}
    </section>
  );
  return full ? (
    <>
      {<button onClick={() => setFull(false)}>Return to diagram</button>}
      {createPortal(view, document.body)}
    </>
  ) : (
    view
  );
}
