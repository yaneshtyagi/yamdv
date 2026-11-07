import React, { useLayoutEffect, useRef } from "react";
export default function Modal({ title, children, onClose, className = "" }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const before = document.activeElement;
    ref.current.showModal();
    ref.current
      .querySelector("[data-autofocus],input,select,textarea")
      ?.focus();
    return () => before?.isConnected && before.focus({ preventScroll: true });
  }, []);
  return (
    <dialog
      ref={ref}
      className={"modal " + className}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <strong>{title}</strong>
        <button aria-label="Close dialog" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
