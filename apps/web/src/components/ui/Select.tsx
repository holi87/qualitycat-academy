interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  name: string;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function Select({
  name,
  options,
  value,
  onChange,
  placeholder,
}: SelectProps) {
  return (
    <div className="select">
      <select
        className="select__native"
        data-testid={`select-${name}`}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
