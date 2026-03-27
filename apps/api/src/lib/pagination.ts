import { isBugEnabled } from "./bugs.js";

export const getPaginationSkip = (page: number, limit: number): number => {
  if (isBugEnabled("BUG_PAGINATION_MIXED_BASE")) {
    return page * limit;
  }

  return (page - 1) * limit;
};

export const buildPaginationMeta = (
  page: number,
  limit: number,
  total: number,
): { page: number; limit: number; total: number; totalPages?: number } => {
  if (isBugEnabled("BUG_PAGINATION_MISSING_META")) {
    return { page, limit, total };
  }

  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
};
