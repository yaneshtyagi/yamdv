import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  textModel,
  caretRect,
  wordMotion,
  nextCharacter,
  previousCharacter,
} from "../reader-text";
import { copyText } from "../services/clipboard";
const controls =
  "button,a,input,textarea,select,[contenteditable=true],[data-reader-ui],.diagram";
export default function ReadingCursor({
  readerRef,
  viewId,
  content,
  vim,
  positions,
  onHeadingChange,
}) {
  const [display, setDisplay] = useState(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    const reader = readerRef.current,
      article = reader?.querySelector("article");
    if (!article) return;
    let model = textModel(article),
      cursor = Math.min(positions.current.get(viewId) || 0, model.text.length),
      anchor = null,
      mode = "normal",
      pending = "",
      pendingAt = 0,
      frame = 0,
      ownSelection = false,
      disposed = false,
      copying = false,
      reportedHeading;
    const selection = () => window.getSelection();
    function capture(backward = false) {
      const s = selection();
      return s?.focusNode
        ? model.offset(s.focusNode, s.focusOffset, backward)
        : null;
    }
    function collapse(offset) {
      const point = model.point(offset);
      if (point) selection().collapse(point.node, point.offset);
    }
    function nativeMove(offset, direction, granularity) {
      collapse(offset);
      const s = selection();
      if (s?.modify) {
        s.modify("move", direction, granularity);
        const backwardLine = direction === "backward" && granularity === "line";
        const result = capture(backwardLine);
        if (result !== null) {
          // Chromium can land on the same rendered line when moving up over an hr.
          if (
            backwardLine &&
            caretRect(model, result)?.top === caretRect(model, offset)?.top
          ) {
            const rule = model.rules.find(
              ({ after }) =>
                after <= offset &&
                caretRect(model, after)?.top === caretRect(model, offset)?.top,
            );
            if (rule && rule.before < offset) return rule.before;
          }
          return result;
        }
        return direction === "backward" ? 0 : model.text.length;
      }
      return direction === "backward"
        ? previousCharacter(model.text, offset)
        : nextCharacter(model.text, offset);
    }
    function boundary(offset, end) {
      return nativeMove(offset, end ? "forward" : "backward", "lineboundary");
    }
    function lineRange(offset) {
      return [boundary(offset, false), boundary(offset, true)];
    }
    function selectRange(start, end) {
      const a = model.point(start),
        b = model.point(end);
      if (a && b) {
        const range = document.createRange();
        range.setStart(a.node, a.offset);
        range.setEnd(b.node, b.offset);
        selection().removeAllRanges();
        selection().addRange(range);
      }
    }
    function updateSelection() {
      ownSelection = true;
      if (mode === "visual")
        selectRange(
          Math.min(anchor, cursor),
          nextCharacter(model.text, Math.max(anchor, cursor)),
        );
      else if (mode === "visual-line") {
        const a = lineRange(anchor),
          b = lineRange(cursor);
        selectRange(Math.min(a[0], b[0]), Math.max(a[1], b[1]));
      } else collapse(cursor);
      ownSelection = false;
    }
    function draw() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (disposed) return;
        const caret = caretRect(model, cursor),
          bounds = reader.getBoundingClientRect(),
          body = article.getBoundingClientRect();
        const focused = document.activeElement === reader;
        reader.dataset.readerMode = mode;
        reader.dataset.readerOffset = String(cursor);
        positions.current.set(viewId, cursor);
        const heading =
          model.headings.findLast(
            (entry) => entry.offset !== null && entry.offset <= cursor,
          )?.id ?? null;
        if (heading !== reportedHeading) {
          reportedHeading = heading;
          onHeadingChange(viewId, heading);
        }
        if (!caret) {
          setDisplay(null);
          return;
        }
        setDisplay({
          bounds: {
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
          },
          line: {
            left: Math.max(0, body.left - bounds.left + 10),
            top: caret.top - bounds.top,
            width: Math.min(bounds.width - 20, body.width - 20),
            height: caret.height,
          },
          caret: {
            left: caret.left - bounds.left,
            top: caret.top - bounds.top,
            height: caret.height,
          },
          focused,
          mode,
        });
      });
    }
    function reveal() {
      const rect = caretRect(model, cursor);
      if (!rect) return;
      const bounds = reader.getBoundingClientRect();
      const pre = model.point(cursor)?.node.parentElement.closest("pre");
      if (pre) {
        const box = pre.getBoundingClientRect();
        if (rect.left < box.left + 12)
          pre.scrollBy({
            left: rect.left - box.left - 12,
            behavior: "instant",
          });
        else if (rect.right > box.right - 12)
          pre.scrollBy({
            left: rect.right - box.right + 12,
            behavior: "instant",
          });
      }
      if (rect.top < bounds.top + 24)
        reader.scrollBy({
          top: rect.top - bounds.top - 24,
          behavior: "instant",
        });
      else if (rect.bottom > bounds.bottom - 24)
        reader.scrollBy({
          top: rect.bottom - bounds.bottom + 24,
          behavior: "instant",
        });
    }
    function go(offset) {
      cursor = Math.max(0, Math.min(model.text.length, offset));
      updateSelection();
      if (cursor === 0) reader.scrollTop = 0;
      else reveal();
      draw();
    }
    function normal() {
      mode = "normal";
      anchor = null;
      pending = "";
      updateSelection();
      draw();
    }
    async function yank(line = false) {
      if (!model.nodes.length) {
        setMessage("Nothing to copy");
        return;
      }
      const originalCursor = cursor;
      copying = true;
      if (line && mode === "normal") {
        const [a, b] = lineRange(cursor);
        selectRange(a, b);
      }
      const selected = selection();
      const text =
        article.contains(selected?.anchorNode) &&
        article.contains(selected?.focusNode)
          ? selected.toString()
          : "";
      if (!text) {
        setMessage("Nothing selected");
        copying = false;
        return;
      }
      try {
        await copyText(text);
        if (disposed) return;
        setMessage("Copied selection");
        if (cursor === originalCursor) normal();
      } catch {
        if (!disposed)
          setMessage("Copy unavailable — use ⌘/Ctrl+C; selection kept");
      } finally {
        copying = false;
      }
    }
    function key(event) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.target !== reader
      )
        return;
      const key =
        event.shiftKey && /^[a-z]$/.test(event.key)
          ? event.key.toUpperCase()
          : event.key;
      const ctrlPage =
        vim &&
        event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        ["d", "u", "f", "b"].includes(key.toLowerCase());
      if (event.metaKey || event.altKey || (event.ctrlKey && !ctrlPage)) return;
      if (
        !vim &&
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)
      )
        return;
      let handled = true;
      setMessage("");
      ownSelection = true;
      if (ctrlPage) {
        const down = ["d", "f"].includes(key.toLowerCase()),
          amount = Math.max(
            1,
            Math.floor(
              reader.clientHeight /
                24 /
                (["d", "u"].includes(key.toLowerCase()) ? 2 : 1),
            ),
          );
        let next = cursor;
        for (let i = 0; i < amount; i++)
          next = nativeMove(next, down ? "forward" : "backward", "line");
        go(next);
      } else if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key) ||
        (vim && ["h", "j", "k", "l"].includes(key))
      ) {
        const backward = ["ArrowLeft", "ArrowUp", "h", "k"].includes(key),
          line = ["ArrowUp", "ArrowDown", "j", "k"].includes(key);
        go(
          nativeMove(
            cursor,
            backward ? "backward" : "forward",
            line ? "line" : "character",
          ),
        );
        pending = "";
      } else if (vim && ["w", "b", "e"].includes(key)) {
        go(wordMotion(model.text, cursor, key));
        pending = "";
      } else if (vim && key === "0") {
        go(boundary(cursor, false));
        pending = "";
      } else if (vim && key === "$") {
        const end = boundary(cursor, true);
        go(end > 0 ? previousCharacter(model.text, end) : end);
        pending = "";
      } else if (vim && key === "g") {
        if (pending === "g" && Date.now() - pendingAt < 1000) {
          go(0);
          pending = "";
        } else {
          pending = "g";
          pendingAt = Date.now();
        }
      } else if (vim && key === "G") {
        go(
          model.text.length
            ? previousCharacter(model.text, model.text.length)
            : 0,
        );
        pending = "";
      } else if (vim && (key === "v" || key === "V")) {
        const next = key === "V" ? "visual-line" : "visual";
        if (mode === next) normal();
        else {
          if (mode === "normal") anchor = cursor;
          mode = next;
          updateSelection();
          draw();
        }
        pending = "";
      } else if (vim && key === "y") {
        if (
          mode !== "normal" ||
          (article.contains(selection()?.anchorNode) &&
            article.contains(selection()?.focusNode) &&
            !selection().isCollapsed)
        ) {
          void yank();
          pending = "";
        } else if (pending === "y" && Date.now() - pendingAt < 1000) {
          void yank(true);
          pending = "";
        } else {
          pending = "y";
          pendingAt = Date.now();
        }
      } else if (vim && key === "Escape") {
        normal();
      } else {
        handled = false;
        pending = "";
      }
      ownSelection = false;
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    function focus(event) {
      if (event.type === "focus" && mode === "normal") collapse(cursor);
      draw();
    }
    function pointer(event) {
      if (event.target.closest(controls)) return;
      const s = selection();
      const fromSelection = capture();
      let point;
      if (s?.isCollapsed) {
        if (document.caretPositionFromPoint) {
          const p = document.caretPositionFromPoint(
            event.clientX,
            event.clientY,
          );
          if (p) point = { node: p.offsetNode, offset: p.offset };
        } else if (document.caretRangeFromPoint) {
          const p = document.caretRangeFromPoint(event.clientX, event.clientY);
          if (p) point = { node: p.startContainer, offset: p.startOffset };
        }
      }
      const offset = point
        ? model.offset(point.node, point.offset)
        : fromSelection;
      if (offset !== null && offset !== undefined) {
        cursor = offset;
        mode = "normal";
        anchor = null;
        reader.focus({ preventScroll: true });
        if (s?.isCollapsed) collapse(cursor);
        draw();
      }
    }
    function selected() {
      if (ownSelection || copying || document.activeElement !== reader) return;
      if (mode === "normal") {
        const value = capture();
        if (value !== null) cursor = value;
      }
      draw();
    }
    function rebuild() {
      const old = cursor;
      model = textModel(article);
      cursor = Math.min(old, model.text.length);
      if (mode !== "normal") updateSelection();
      draw();
    }
    function revealTarget({ detail: element }) {
      const offset = model.nodes.find(({ node }) =>
        element.contains(node),
      )?.start;
      if (offset === undefined) return;
      cursor = offset;
      mode = "normal";
      anchor = null;
      if (document.activeElement === reader) collapse(cursor);
      draw();
    }
    const mutation = new MutationObserver((records) => {
        if (
          records.some(
            (record) =>
              !(
                record.target.nodeType === Node.TEXT_NODE
                  ? record.target.parentElement
                  : record.target
              )?.closest("[data-reader-ui],.diagram"),
          )
        )
          rebuild();
      }),
      resize = new ResizeObserver(draw);
    mutation.observe(article, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    resize.observe(article);
    resize.observe(reader);
    reader.addEventListener("reader-reveal", revealTarget);
    reader.addEventListener("keydown", key);
    reader.addEventListener("pointerup", pointer);
    reader.addEventListener("focus", focus);
    reader.addEventListener("blur", focus);
    reader.addEventListener("scroll", draw, { passive: true, capture: true });
    window.addEventListener("resize", draw);
    document.addEventListener("selectionchange", selected);

    draw();
    return () => {
      positions.current.set(viewId, cursor);
      disposed = true;
      cancelAnimationFrame(frame);
      mutation.disconnect();
      resize.disconnect();
      reader.removeEventListener("reader-reveal", revealTarget);
      reader.removeEventListener("keydown", key);
      reader.removeEventListener("pointerup", pointer);
      reader.removeEventListener("focus", focus);
      reader.removeEventListener("blur", focus);
      reader.removeEventListener("scroll", draw, true);
      window.removeEventListener("resize", draw);
      document.removeEventListener("selectionchange", selected);
      if (mode !== "normal" && article.contains(selection()?.anchorNode))
        selection().removeAllRanges();
    };
  }, [viewId, content, vim]);
  return (
    <>
      {display
        ? createPortal(
            <div
              className={
                "reading-overlay " + (display.focused ? "focused" : "")
              }
              style={display.bounds}
              aria-hidden="true"
            >
              <div className="reading-active-line" style={display.line} />
              {display.focused && (
                <div className="reading-caret" style={display.caret} />
              )}
              {display.focused && (vim || message) && (
                <div className="reading-mode">
                  {message ||
                    (display.mode === "visual-line"
                      ? "VISUAL LINE · y: copy · Esc: cancel"
                      : display.mode === "visual"
                        ? "VISUAL · y: copy · Esc: cancel"
                        : "VIM NORMAL · v/V: select · y: copy")}
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
      <span
        data-reader-ui
        className="reader-announcement"
        role="status"
        aria-live="polite"
      >
        {message}
      </span>
    </>
  );
}
