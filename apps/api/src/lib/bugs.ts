export type BugFlagMap = Record<string, boolean>;

export const KNOWN_BACKEND_BUG_FLAGS = [
  "BUG_AUTH_WRONG_STATUS",
  "BUG_BOOKINGS_LEAK",
  "BUG_BOOKINGS_RACE",
  "BUG_PAGINATION_MIXED_BASE",
  "BUG_NPLUS1_COURSES",
] as const;

export type RuntimeBugSnapshot = {
  bugs: "on" | "off";
  backendBugs: boolean;
  frontendBugs: boolean;
  flags: BugFlagMap;
  availableFlags: string[];
};

type RuntimeBugState = {
  backendBugs: boolean;
  frontendBugs: boolean;
  flags: BugFlagMap;
};

const parseFlagValue = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
};

const parseRuntimeBool = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }

  return parseFlagValue(value);
};

const parseBugFlags = (source: string | undefined): BugFlagMap => {
  if (!source) {
    return {};
  }

  return source
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .reduce<BugFlagMap>((acc, entry) => {
      const [keyRaw, valueRaw = "false"] = entry.split("=");
      const key = keyRaw?.trim();
      if (!key) {
        return acc;
      }

      acc[key] = parseFlagValue(valueRaw);
      return acc;
    }, {});
};

const stringifyBugFlags = (flags: BugFlagMap): string => {
  return Object.entries(flags)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([flag, enabled]) => `${flag}=${enabled ? "true" : "false"}`)
    .join(",");
};

const normalizeFlags = (flags: BugFlagMap): BugFlagMap => {
  const normalized: BugFlagMap = {};

  for (const flag of KNOWN_BACKEND_BUG_FLAGS) {
    normalized[flag] = Boolean(flags[flag]);
  }

  for (const [flag, enabled] of Object.entries(flags)) {
    if (flag in normalized) {
      continue;
    }

    normalized[flag] = Boolean(enabled);
  }

  return normalized;
};

const runtimeState: RuntimeBugState = {
  backendBugs: parseRuntimeBool(process.env.BUGS),
  frontendBugs: parseRuntimeBool(process.env.FRONTEND_BUGS ?? process.env.VITE_BUGS),
  flags: normalizeFlags(parseBugFlags(process.env.BUG_FLAGS)),
};

const syncProcessEnvSnapshot = (): void => {
  process.env.BUGS = runtimeState.backendBugs ? "on" : "off";
  process.env.FRONTEND_BUGS = runtimeState.frontendBugs ? "on" : "off";
  process.env.BUG_FLAGS = stringifyBugFlags(runtimeState.flags);
};

syncProcessEnvSnapshot();

const cloneFlags = (): BugFlagMap => ({ ...runtimeState.flags });

export const getRuntimeBugSnapshot = (): RuntimeBugSnapshot => {
  return {
    bugs: runtimeState.backendBugs ? "on" : "off",
    backendBugs: runtimeState.backendBugs,
    frontendBugs: runtimeState.frontendBugs,
    flags: cloneFlags(),
    availableFlags: [...KNOWN_BACKEND_BUG_FLAGS],
  };
};

export const getBugFlagsSnapshot = (): RuntimeBugSnapshot => getRuntimeBugSnapshot();

export const isFrontendBugEnabled = (): boolean => runtimeState.frontendBugs;

export const isBugEnabled = (flag?: string): boolean => {
  if (!runtimeState.backendBugs) {
    return false;
  }

  if (!flag) {
    return true;
  }

  return runtimeState.flags[flag] ?? false;
};

export const setRuntimeBugState = (update: {
  backendBugs?: boolean;
  frontendBugs?: boolean;
  flags?: BugFlagMap;
}): RuntimeBugSnapshot => {
  if (typeof update.backendBugs === "boolean") {
    runtimeState.backendBugs = update.backendBugs;
  }

  if (typeof update.frontendBugs === "boolean") {
    runtimeState.frontendBugs = update.frontendBugs;
  }

  if (update.flags) {
    runtimeState.flags = normalizeFlags({
      ...runtimeState.flags,
      ...update.flags,
    });
  }

  syncProcessEnvSnapshot();
  return getRuntimeBugSnapshot();
};

export const setAllBackendFlags = (enabled: boolean): RuntimeBugSnapshot => {
  const nextFlags = KNOWN_BACKEND_BUG_FLAGS.reduce<BugFlagMap>((acc, flag) => {
    acc[flag] = enabled;
    return acc;
  }, {});

  return setRuntimeBugState({ flags: nextFlags });
};
