import type { ReactNode } from "react";

interface BadgeProps {
  variant: "success" | "warning" | "error" | "info" | "neutral";
  children: ReactNode;
  testId?: string;
}

export function Badge({ variant, children, testId }: BadgeProps) {
  return (
    <span
      className={`badge badge--${variant}`}
      data-testid={`badge-${testId ?? variant}`}
    >
      {children}
    </span>
  );
}
