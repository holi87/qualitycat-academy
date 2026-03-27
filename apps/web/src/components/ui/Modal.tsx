import { type ReactNode, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  testId?: string;
}

export function Modal({ isOpen, onClose, title, children, testId }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal" data-testid={`modal-${testId ?? "default"}`}>
      <div
        className="modal__overlay"
        data-testid="modal-overlay"
        onClick={onClose}
      />
      <div className="modal__content">
        <div className="modal__header">
          <h2 className="modal__title" data-testid="modal-title">
            {title}
          </h2>
          <button
            className="modal__close"
            data-testid="modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
