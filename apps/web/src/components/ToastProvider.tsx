import { ReactNode, createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastVariant = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  show: (message: string, variant?: ToastVariant, durationMs?: number) => void;
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

type ToastProviderProps = {
  children: ReactNode;
};

const ToastProvider = ({ children }: ToastProviderProps): JSX.Element => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: number): void => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((message: string, variant: ToastVariant = "info", durationMs = 3200) => {
    const id = Date.now() + Math.floor(Math.random() * 100000);
    setToasts((current) => [...current, { id, message, variant }]);

    const timer = window.setTimeout(() => {
      timersRef.current.delete(id);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, durationMs);
    timersRef.current.set(id, timer);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message, durationMs) => show(message, "success", durationMs),
      error: (message, durationMs) => show(message, "error", durationMs),
      info: (message, durationMs) => show(message, "info", durationMs),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div className={`toast toast--${toast.variant}`} role="status" key={toast.id}>
            <p className="toast__content">{toast.message}</p>
            <button
              className="toast__close"
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
};

export default ToastProvider;
