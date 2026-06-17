import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { getSuggestions } from "../expression/suggestions";
import type { ParameterEntry } from "../schema/parameterSchema";

interface ExpressionInputProps {
  value: string;
  onChange: (value: string) => void;
  nodeNames: string[];
  parameters: ParameterEntry[];
  placeholder?: string;
  className?: string;
}

const BLUR_CLOSE_MS = 120;

export function ExpressionInput({
  value,
  onChange,
  nodeNames,
  parameters,
  placeholder,
  className,
}: ExpressionInputProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const suggestions = useMemo(
    () => getSuggestions(value, nodeNames, parameters),
    [value, nodeNames, parameters],
  );
  const visible = open && suggestions.length > 0;

  function accept(index: number) {
    const s = suggestions[index];
    if (!s) return;
    onChange(s.value);
    setActive(0);
    setOpen(true); // keep open so the next segment can be suggested
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!visible) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      accept(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), BLUR_CLOSE_MS)}
        onKeyDown={onKeyDown}
        className={`w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${className ?? ""}`}
      />
      {visible && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.value}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus; fire before blur
                accept(i);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-2 py-1 text-sm ${
                i === active ? "bg-primary/10 text-primary" : "text-slate-700 dark:text-slate-200"
              }`}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
