export type BugFlagMap = Record<string, boolean>;
export type BugDifficulty = "easy" | "medium" | "hard";
export type BugCategory = "backend" | "frontend";

export type BugDefinition = {
  flag: string;
  difficulty: BugDifficulty;
  description: string;
  category: BugCategory;
};

export const ALL_BUG_DEFINITIONS: BugDefinition[] = [
  // Backend — Easy
  { flag: "BUG_AUTH_WRONG_STATUS", difficulty: "easy", description: "Returns 403 instead of 401 for auth failures", category: "backend" },
  { flag: "BUG_COURSES_MISSING_FIELD", difficulty: "easy", description: "Omits description from course list response", category: "backend" },
  { flag: "BUG_SESSIONS_WRONG_SORT", difficulty: "easy", description: "Sorts descending when ascending requested and vice versa", category: "backend" },
  // Backend — Medium
  { flag: "BUG_PAGINATION_MIXED_BASE", difficulty: "medium", description: "Wrong offset: page * limit instead of (page - 1) * limit", category: "backend" },
  { flag: "BUG_BOOKINGS_LEAK", difficulty: "medium", description: "Returns all users' bookings instead of only the requester's", category: "backend" },
  { flag: "BUG_SEARCH_WRONG_RESULTS", difficulty: "medium", description: "Search ignores case-insensitive matching", category: "backend" },
  { flag: "BUG_PAGINATION_MISSING_META", difficulty: "medium", description: "Omits totalPages from pagination metadata", category: "backend" },
  // Backend — Hard
  { flag: "BUG_BOOKINGS_RACE", difficulty: "hard", description: "No serializable transaction + artificial delay on bookings", category: "backend" },
  { flag: "BUG_NPLUS1_COURSES", difficulty: "hard", description: "N+1 queries on course list (extra count per course)", category: "backend" },
  { flag: "BUG_FILE_UPLOAD_NO_MIME_CHECK", difficulty: "hard", description: "Accepts any file type without MIME validation", category: "backend" },
  // Frontend — Easy
  { flag: "FE_BUG_DOUBLE_SUBMIT", difficulty: "easy", description: "Login and booking mutations called twice", category: "frontend" },
  { flag: "FE_BUG_WRONG_ERROR_MSG", difficulty: "easy", description: "HTTP 500 shows 'Invalid email or password' instead of real error", category: "frontend" },
  { flag: "FE_BUG_FORM_NO_VALIDATION", difficulty: "easy", description: "Submit button not disabled when form validation fails", category: "frontend" },
  // Frontend — Medium
  { flag: "FE_BUG_TIMEZONE_OFFSET", difficulty: "medium", description: "All dates rendered with +1 hour offset", category: "frontend" },
  { flag: "FE_BUG_STALE_CACHE", difficulty: "medium", description: "Infinite staleTime prevents data refresh", category: "frontend" },
  { flag: "FE_BUG_PAGINATION_OFF_BY_ONE", difficulty: "medium", description: "Displays wrong page number in pagination UI", category: "frontend" },
  { flag: "FE_BUG_MODAL_NO_CLOSE_ON_ESC", difficulty: "medium", description: "Confirmation modal does not close on Escape key", category: "frontend" },
  // Frontend — Hard
  { flag: "FE_BUG_XSS_COURSE_DESC", difficulty: "hard", description: "Course description rendered with dangerouslySetInnerHTML", category: "frontend" },
];

export const KNOWN_BACKEND_BUG_FLAGS = ALL_BUG_DEFINITIONS
  .filter((b) => b.category === "backend")
  .map((b) => b.flag);

export const KNOWN_FRONTEND_BUG_FLAGS = ALL_BUG_DEFINITIONS
  .filter((b) => b.category === "frontend")
  .map((b) => b.flag);

export type RuntimeBugSnapshot = {
  bugs: "on" | "off";
  backendBugs: boolean;
  frontendBugs: boolean;
  flags: BugFlagMap;
  frontendFlags: BugFlagMap;
  availableFlags: BugDefinition[];
};

type RuntimeBugState = {
  backendBugs: boolean;
  frontendBugs: boolean;
  flags: BugFlagMap;
  frontendFlags: BugFlagMap;
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

const normalizeBackendFlags = (flags: BugFlagMap): BugFlagMap => {
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

const normalizeFrontendFlags = (flags: BugFlagMap): BugFlagMap => {
  const normalized: BugFlagMap = {};

  for (const flag of KNOWN_FRONTEND_BUG_FLAGS) {
    normalized[flag] = Boolean(flags[flag]);
  }

  return normalized;
};

const runtimeState: RuntimeBugState = {
  backendBugs: parseRuntimeBool(process.env.BUGS),
  frontendBugs: parseRuntimeBool(process.env.FRONTEND_BUGS ?? process.env.VITE_BUGS),
  flags: normalizeBackendFlags(parseBugFlags(process.env.BUG_FLAGS)),
  frontendFlags: normalizeFrontendFlags(parseBugFlags(process.env.FE_BUG_FLAGS)),
};

const syncProcessEnvSnapshot = (): void => {
  process.env.BUGS = runtimeState.backendBugs ? "on" : "off";
  process.env.FRONTEND_BUGS = runtimeState.frontendBugs ? "on" : "off";
  process.env.BUG_FLAGS = stringifyBugFlags(runtimeState.flags);
  process.env.FE_BUG_FLAGS = stringifyBugFlags(runtimeState.frontendFlags);
};

syncProcessEnvSnapshot();

const cloneFlags = (): BugFlagMap => ({ ...runtimeState.flags });
const cloneFrontendFlags = (): BugFlagMap => ({ ...runtimeState.frontendFlags });

export const getRuntimeBugSnapshot = (): RuntimeBugSnapshot => {
  return {
    bugs: runtimeState.backendBugs ? "on" : "off",
    backendBugs: runtimeState.backendBugs,
    frontendBugs: runtimeState.frontendBugs,
    flags: cloneFlags(),
    frontendFlags: cloneFrontendFlags(),
    availableFlags: [...ALL_BUG_DEFINITIONS],
  };
};

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
  frontendFlags?: BugFlagMap;
}): RuntimeBugSnapshot => {
  if (typeof update.backendBugs === "boolean") {
    runtimeState.backendBugs = update.backendBugs;
  }

  if (typeof update.frontendBugs === "boolean") {
    runtimeState.frontendBugs = update.frontendBugs;
  }

  if (update.flags) {
    runtimeState.flags = normalizeBackendFlags({
      ...runtimeState.flags,
      ...update.flags,
    });
  }

  if (update.frontendFlags) {
    runtimeState.frontendFlags = normalizeFrontendFlags({
      ...runtimeState.frontendFlags,
      ...update.frontendFlags,
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

export const setAllFrontendFlags = (enabled: boolean): RuntimeBugSnapshot => {
  const nextFlags = KNOWN_FRONTEND_BUG_FLAGS.reduce<BugFlagMap>((acc, flag) => {
    acc[flag] = enabled;
    return acc;
  }, {});

  return setRuntimeBugState({ frontendFlags: nextFlags });
};

export const setAllFlagsByDifficulty = (difficulty: BugDifficulty, enabled: boolean): RuntimeBugSnapshot => {
  const matching = ALL_BUG_DEFINITIONS.filter((b) => b.difficulty === difficulty);
  const backendUpdates: BugFlagMap = {};
  const frontendUpdates: BugFlagMap = {};

  for (const bug of matching) {
    if (bug.category === "backend") {
      backendUpdates[bug.flag] = enabled;
    } else {
      frontendUpdates[bug.flag] = enabled;
    }
  }

  return setRuntimeBugState({
    flags: { ...runtimeState.flags, ...backendUpdates },
    frontendFlags: { ...runtimeState.frontendFlags, ...frontendUpdates },
  });
};
