import { isUiBugModeEnabled } from "./bugs";

export const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (isUiBugModeEnabled()) {
    date.setHours(date.getHours() + 1);
  }

  return date.toLocaleString();
};
