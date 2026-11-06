import React, { useEffect, useRef } from "react";
export default function Modal({ title, children, onClose, className = "" }) {
  const ref = useRef();
  useEffect(() => {
    const before = document.activeElement;
    ref.current.showModal();
    return () => before?.isConnected && before.focus();
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
