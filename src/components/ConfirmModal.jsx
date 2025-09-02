import React from "react";
import { createPortal } from "react-dom";

export default function ConfirmModal({
  open,
  title,
  description,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
      if (e.key === "Enter") onConfirm?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  const backdropStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.5)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  };
  const boxStyle = {
    background: "#fff",
    color: "#111",
    borderRadius: 12,
    width: "min(520px, calc(100vw - 32px))",
    boxShadow: "0 10px 30px rgba(0,0,0,.25)",
  };
  const headStyle = { padding: "16px 20px", fontWeight: 700, fontSize: 18 };
  const bodyStyle = { padding: "0 20px 20px", color: "#374151", fontSize: 14, lineHeight: 1.5 };
  const footerStyle = { padding: "12px 20px 16px", display: "flex", justifyContent: "flex-end", gap: 8 };
  const btn = {
    height: 36,
    padding: "0 14px",
    borderRadius: 8,
    border: "1px solid #D1D5DB",
    cursor: "pointer",
    fontWeight: 600,
  };

  return createPortal(
    <div style={backdropStyle} onMouseDown={onCancel}>
      <div style={boxStyle} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={headStyle}>{title}</div>
        {description ? <div style={bodyStyle}>{description}</div> : null}
        <div style={footerStyle}>
          <button style={{ ...btn, background: "#F3F4F6" }} onClick={onCancel}>
            {cancelText}
          </button>
          <button
            autoFocus
            style={{ ...btn, background: "#FEE2E2", borderColor: "#FCA5A5" }}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
