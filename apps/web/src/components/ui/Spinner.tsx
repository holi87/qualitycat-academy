interface SpinnerProps {
  size?: "sm" | "md" | "lg";
}

export function Spinner({ size = "md" }: SpinnerProps) {
  return (
    <div
      className={`spinner spinner--${size}`}
      data-testid="loading-spinner"
      role="status"
      aria-label="Loading"
    >
      <div className="spinner__circle" />
    </div>
  );
}
