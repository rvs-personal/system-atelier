'use client';
import { Cloud, Download, RotateCcw } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: (string | { value: string; label: string })[];
  onChange: (v: string) => void;
}) {
  const items = options.map((o) =>
    typeof o === 'string' ? { label: o, value: o } : o,
  );
  return (
    <label className="field">
      <span>{label}</span>
      <Select
        value={value}
        onValueChange={(v) => v !== null && onChange(v)}
        items={items}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
export function Range({
  label,
  value,
  min = 0,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="range-field">
      <div>
        <label>{label}</label>
        <output>
          {value.toLocaleString()}
          {unit}
        </output>
      </div>
      <Slider
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
    </div>
  );
}
export function CloudStatus({
  status,
  error,
  save,
}: {
  status: string;
  error: string;
  save: () => unknown;
}) {
  if (!error) return null;
  return (
    <div className={'save-status ' + (error ? 'save-error' : '')} role="status">
      <Cloud size={15} />
      <span>{status}</span>
      {error && (
        <>
          <span>{error}</span>
          <button onClick={() => void save()}>
            <RotateCcw size={14} />
            Retry
          </button>
        </>
      )}
    </div>
  );
}
export function PageTitle({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{kicker}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="secondary" onClick={onClick}>
      <Download size={16} />
      Export
    </button>
  );
}
