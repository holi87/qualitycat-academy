import type { FormEvent } from "react";

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder = "Search...",
}: SearchBarProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        className="search-bar__input"
        data-testid="search-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        className="search-bar__submit"
        data-testid="search-submit"
        type="submit"
      >
        Search
      </button>
      {value.length > 0 && (
        <button
          className="search-bar__clear"
          data-testid="search-clear"
          type="button"
          onClick={onClear}
        >
          Clear
        </button>
      )}
    </form>
  );
}
