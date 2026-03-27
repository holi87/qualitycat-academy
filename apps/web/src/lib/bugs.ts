import { useSyncExternalStore } from "react";

type FrontendFlags = Record<string, boolean>;

type PublicBugState = {
  backendBugs: boolean;
  frontendBugs: boolean;
  frontendFlags: FrontendFlags;
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
  frontendFlags: {},
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

export const applyPublicBugState = (next: {
  backendBugs: boolean;
  frontendBugs: boolean;
  frontendFlags?: FrontendFlags;
}): void => {
  const flagsStr = JSON.stringify(next.frontendFlags ?? {});
  const currentFlagsStr = JSON.stringify(runtimeState.frontendFlags);
  const changed =
    runtimeState.backendBugs !== next.backendBugs ||
    runtimeState.frontendBugs !== next.frontendBugs ||
    flagsStr !== currentFlagsStr;

  if (!changed) {
    return;
  }

  runtimeState = {
    backendBugs: next.backendBugs,
    frontendBugs: next.frontendBugs,
    frontendFlags: next.frontendFlags ?? {},
  };
  notify();
};

export const isUiBugModeEnabled = (): boolean => runtimeState.frontendBugs;

export const isFeBugEnabled = (flag: string): boolean => {
  if (!runtimeState.frontendBugs) {
    return false;
  }

  return runtimeState.frontendFlags[flag] ?? false;
};

export const useRuntimeBugState = (): PublicBugState =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
