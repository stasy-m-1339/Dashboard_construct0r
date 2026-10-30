import type { Dataset, FieldRole } from '../shared/types';
import { columnsByRole } from '../shared/fieldMeta';

interface Props {
  label?: string;
  dataset: Dataset | undefined;
  value: string;
  onChange: (column: string) => void;
  /** Prefer these roles; falls back to all columns if empty match */
  roles?: FieldRole | FieldRole[];
  allowEmpty?: boolean;
  emptyLabel?: string;
}

/** Role-aware column picker for widgets / filters / ETL. */
export function FieldSelect({
  label,
  dataset,
  value,
  onChange,
  roles,
  allowEmpty = true,
  emptyLabel = '—',
}: Props) {
  const preferred = roles ? columnsByRole(dataset, roles) : dataset?.columns || [];
  const all = dataset?.columns || [];
  // Include current value even if role-filtered out
  const options =
    value && !preferred.includes(value) && all.includes(value)
      ? [value, ...preferred]
      : preferred.length
        ? preferred
        : all;

  return (
    <label className="field-select">
      {label && <span>{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {options.map((c) => {
          const role = dataset?.fieldRoles?.[c];
          return (
            <option key={c} value={c}>
              {role ? `${c} · ${role}` : c}
            </option>
          );
        })}
      </select>
    </label>
  );
}
