import { CITY_SUGGESTIONS, CITY_DATALIST_ID } from '../lib/cities';

type CityInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
};

/**
 * City field with suggestions. Free text is still accepted — the list only
 * saves typing for the cities most shoots happen in.
 */
export function CityInput({
  value,
  onChange,
  placeholder = 'Например: Москва',
  className = 'input-field',
  id,
}: CityInputProps) {
  return (
    <>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={CITY_DATALIST_ID}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      <datalist id={CITY_DATALIST_ID}>
        {CITY_SUGGESTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}
