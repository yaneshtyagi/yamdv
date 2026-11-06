import React, { useEffect, useRef } from "react";
export default function Popup({ children, x, y, onClose, label = "Actions" }) {
  const ref = useRef();
  useEffect(() => {
    const before = document.activeElement;
    ref.current.querySelector("button:not(:disabled)")?.focus();
    const outside = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      if (before?.isConnected) before.focus();
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
            ...e.currentTarget.querySelectorAll("button:not(:disabled)"),
          ],
          index = items.indexOf(document.activeElement);
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
