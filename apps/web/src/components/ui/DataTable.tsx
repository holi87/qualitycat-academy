import type { ReactNode } from "react";

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column[];
  data: T[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string) => void;
  renderRow: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  testId?: string;
}

export function DataTable<T>({
  columns,
  data,
  sortBy,
  sortOrder,
  onSort,
  renderRow,
  keyExtractor,
  emptyMessage = "No data available",
  testId = "default",
}: DataTableProps<T>) {
  const getSortIndicator = (key: string) => {
    if (sortBy !== key) return null;
    return sortOrder === "asc" ? " \u2191" : " \u2193";
  };

  return (
    <div className="data-table" data-testid={`table-${testId}`}>
      <table className="data-table__table">
        <thead className="data-table__head">
          <tr className="data-table__header-row">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`data-table__header-cell ${column.sortable ? "data-table__header-cell--sortable" : ""}`}
                data-testid={`table-header-${column.key}`}
              >
                {column.sortable && onSort ? (
                  <button
                    className="data-table__sort-button"
                    data-testid={`table-sort-${column.key}`}
                    onClick={() => onSort(column.key)}
                  >
                    {column.label}
                    {getSortIndicator(column.key)}
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="data-table__body">
          {data.length === 0 ? (
            <tr className="data-table__empty-row">
              <td
                className="data-table__empty-cell"
                colSpan={columns.length}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr
                key={keyExtractor(item)}
                className="data-table__row"
                data-testid={`row-${keyExtractor(item)}`}
              >
                {renderRow(item, index)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
