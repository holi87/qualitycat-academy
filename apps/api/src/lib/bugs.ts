type BugFlagMap = Record<string, boolean>;

const parseFlagValue = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
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

const isBugsModeOn = (): boolean => (process.env.BUGS ?? "off").trim().toLowerCase() === "on";

export const isBugEnabled = (flag?: string): boolean => {
  if (!isBugsModeOn()) {
    return false;
  }

  if (!flag) {
    return true;
  }

  const flags = parseBugFlags(process.env.BUG_FLAGS);
  return flags[flag] ?? false;
};

export const getBugFlagsSnapshot = (): { bugs: "on" | "off"; flags: BugFlagMap } => {
  return {
    bugs: isBugsModeOn() ? "on" : "off",
    flags: parseBugFlags(process.env.BUG_FLAGS),
  };
};
