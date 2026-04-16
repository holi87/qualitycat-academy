import { isFeBugEnabled } from "../../lib/bugs";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [];

  if (current <= 3) {
    pages.push(1, 2, 3, 4, "ellipsis", total);
  } else if (current >= total - 2) {
    pages.push(1, "ellipsis", total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, "ellipsis", current - 1, current, current + 1, "ellipsis", total);
  }

  return pages;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <nav className="pagination" data-testid="pagination">
      <button
        className="pagination__button pagination__button--prev"
        data-testid="pagination-prev"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        &laquo; Prev
      </button>

      <div className="pagination__pages">
        {pageNumbers.map((item, index) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="pagination__ellipsis">
              &hellip;
            </span>
          ) : (
            <button
              key={item}
              className={`pagination__page ${item === page ? "pagination__page--active" : ""}`}
              data-testid={`pagination-page-${item}`}
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </button>
          )
        )}
      </div>

      <span className="pagination__info" data-testid="pagination-info">
        Page {isFeBugEnabled("FE_BUG_PAGINATION_OFF_BY_ONE") ? page + 1 : page} of {totalPages}
      </span>

      <button
        className="pagination__button pagination__button--next"
        data-testid="pagination-next"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        Next &raquo;
      </button>
    </nav>
  );
}
