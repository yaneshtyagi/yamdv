import React, { useRef } from "react";

export default function SidebarDivider({ onResize }) {
  const drag = useRef(null);
  const sidebar = (divider) => divider.previousElementSibling;
  return (
    <div
      className="sidebar-divider"
      role="separator"
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const pane = sidebar(event.currentTarget);
        drag.current = {
          x: event.clientX,
          width: pane.offsetWidth,
          scale: pane.getBoundingClientRect().width / pane.offsetWidth,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const { x, width, scale } = drag.current;
        onResize(width + (event.clientX - x) / scale);
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const width = sidebar(event.currentTarget).offsetWidth;
        onResize(width + (event.key === "ArrowLeft" ? -16 : 16));
      }}
    />
  );
}
