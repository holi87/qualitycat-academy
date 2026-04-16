import { isFeBugEnabled } from "./bugs";

export const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (isFeBugEnabled("FE_BUG_TIMEZONE_OFFSET")) {
    date.setHours(date.getHours() + 1);
  }

  return date.toLocaleString();
};
