import { useSyncExternalStore } from "react";

type PublicBugState = {
  backendBugs: boolean;
  frontendBugs: boolean;
};

const parseRuntimeBool = (value: unknown): boolean => {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
};

let runtimeState: PublicBugState = {
  backendBugs: false,
  frontendBugs: parseRuntimeBool(import.meta.env.VITE_BUGS),
};

const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): PublicBugState => runtimeState;

export const getRuntimeBugState = (): PublicBugState => runtimeState;

export const applyPublicBugState = (next: PublicBugState): void => {
  const changed =
    runtimeState.backendBugs !== next.backendBugs || runtimeState.frontendBugs !== next.frontendBugs;
  if (!changed) {
    return;
  }

  runtimeState = next;
  notify();
};

export const isUiBugModeEnabled = (): boolean => runtimeState.frontendBugs;

export const useRuntimeBugState = (): PublicBugState =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
