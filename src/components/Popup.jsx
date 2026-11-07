import React, { useLayoutEffect, useRef } from "react";
export default function Popup({ children, x, y, onClose, label = "Actions" }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const before = document.activeElement;
    [...ref.current.querySelectorAll("button:not(:disabled),summary")]
      .find((el) => el.getClientRects().length)
      ?.focus();
    const outside = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className="popup"
      style={{
        left: Math.max(5, Math.min(x, innerWidth - 280)),
        top: Math.max(5, Math.min(y, innerHeight - 350)),
      }}
      onKeyDown={(e) => {
        const items = [
            ...e.currentTarget.querySelectorAll(
              "button:not(:disabled),summary",
            ),
          ].filter((el) => el.getClientRects().length),
          index = items.indexOf(document.activeElement);
        if (["ArrowRight", "ArrowLeft"].includes(e.key)) {
          const details = document.activeElement?.closest("details");
          if (details) {
            e.preventDefault();
            details.open = e.key === "ArrowRight";
            details.querySelector("summary")?.focus();
          }
        }
        if (e.key === "Tab") {
          if (!e.shiftKey && document.activeElement === items.at(-1)) {
            e.preventDefault();
            items[0]?.focus();
          } else if (e.shiftKey && document.activeElement === items[0]) {
            e.preventDefault();
            items.at(-1)?.focus();
          }
        }
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          items[
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? items.length - 1
                : (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
                  items.length
          ]?.focus();
        }
      }}
    >
      {children}
    </div>
  );
}
