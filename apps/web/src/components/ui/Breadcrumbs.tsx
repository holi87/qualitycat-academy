interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="breadcrumbs" data-testid="breadcrumbs" aria-label="Breadcrumb">
      <ol className="breadcrumbs__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={index}
              className={`breadcrumbs__item ${isLast ? "breadcrumbs__item--current" : ""}`}
              data-testid={`breadcrumb-${index}`}
            >
              {isLast || !item.to ? (
                <span className="breadcrumbs__text" aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              ) : (
                <a className="breadcrumbs__link" href={item.to}>
                  {item.label}
                </a>
              )}
              {!isLast && (
                <span className="breadcrumbs__separator" aria-hidden="true">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
