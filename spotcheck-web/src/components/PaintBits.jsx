import { StarIcon } from './Icons';
import { SPOT_TYPE_PAINT } from '../utils/paint';

/* Piezas compartidas del sistema "Locate Paint" (equivalen a spotcheck-mobile/components/ui/PaintBits.tsx) */

const DIFFICULTY_LEVEL = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3 };

export function TypeChip({ type, label }) {
  return (
    <span className="type-chip" style={{ background: SPOT_TYPE_PAINT[type] ?? 'var(--sheet)' }}>
      {label}
    </span>
  );
}

export function MarkGlyph({ level }) {
  const active = DIFFICULTY_LEVEL[level] ?? 2;
  return (
    <span className="diff-marks" aria-hidden="true">
      {[1, 2, 3].map((i) => <i key={i} className={i <= active ? '' : 'off'} />)}
    </span>
  );
}

// 1-3 marcas inclinadas + texto: la dificultad nunca va solo por color
export function DifficultyMarks({ level, label }) {
  return (
    <span className="diff" aria-label={label}>
      <MarkGlyph level={level} />
      <span aria-hidden="true">{label}</span>
    </span>
  );
}

export function StarRating({ value, onChange, size = 32, label }) {
  const stars = [1, 2, 3, 4, 5];
  if (!onChange) {
    return (
      <span className="stars" role="img" aria-label={label(value)}>
        {stars.map((s) => <StarIcon key={s} size={size} filled={s <= value} />)}
      </span>
    );
  }
  return (
    <div className="stars" role="radiogroup" aria-label={label(value)}>
      {stars.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={s === value}
          aria-label={label(s)}
          className="star-target"
          onClick={() => onChange(s)}
        >
          <StarIcon size={size} filled={s <= value} />
        </button>
      ))}
    </div>
  );
}

// Píldora de elección con contorno; seleccionada se invierte a asfalto. Punto de pintura opcional.
export function ChoicePill({ selected, onClick, label, ariaLabel, paint, display = true, disabled = false, children, lang }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      lang={lang}
      className={`choice-pill${selected ? ' is-selected' : ''}${display ? '' : ' is-body'}`}
    >
      {paint && <span className="paint-dot" style={{ background: paint }} />}
      {children}
      {label !== undefined && <span>{label}</span>}
    </button>
  );
}

const STRIP = ['var(--paint-orange)', 'var(--paint-yellow)', 'var(--paint-blue)', 'var(--paint-green)', 'var(--paint-pink)'];

export function PaintStrip({ className = '' }) {
  return (
    <div className={`paint-strip ${className}`} aria-hidden="true">
      {STRIP.map((c) => <span key={c} style={{ background: c }} />)}
    </div>
  );
}
