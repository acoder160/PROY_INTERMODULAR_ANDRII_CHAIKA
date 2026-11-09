// Iconos SVG de trazo único (2px, extremos redondos), equivalentes a los Ionicons de la app móvil.
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

const make = (paths) => function Icon({ size = 22, ...props }) {
  return <svg width={size} height={size} {...base} {...props}>{paths}</svg>;
};

export const OptionsIcon = make(<>
  <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
  <circle cx="15" cy="7" r="2" />
  <circle cx="9" cy="17" r="2" />
</>);

export const GlobeIcon = make(<>
  <circle cx="12" cy="12" r="9" />
  <path d="M3 12h18" />
  <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
</>);

export const PersonIcon = make(<>
  <circle cx="12" cy="8" r="4" fill="currentColor" stroke="none" />
  <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="currentColor" stroke="none" />
</>);

export const LogoutIcon = make(<>
  <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
  <path d="M10 8l-4 4 4 4M6 12h10" />
</>);

export const CloseIcon = make(<path d="M6 6l12 12M18 6L6 18" strokeWidth="2.4" />);

export const RefreshIcon = make(<>
  <path d="M20 12a8 8 0 1 1-2.6-5.9" />
  <path d="M20 4v5h-5" />
</>);

export const LocateIcon = make(<>
  <circle cx="12" cy="12" r="7" />
  <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
</>);

export const NavigateIcon = make(<path d="M20 4L3 11l7 3 3 7z" fill="currentColor" />);

export const CameraIcon = make(<>
  <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
  <circle cx="12" cy="13" r="3.5" />
</>);

export function ChevronIcon({ up = false, size = 22 }) {
  return (
    <svg width={size} height={size} {...base}>
      <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  );
}

export const CheckCircleIcon = make(<>
  <circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" />
  <path d="M8 12.5l2.7 2.7L16 9.8" stroke="#fff" />
</>);

export const AlertCircleIcon = make(<>
  <circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" />
  <path d="M12 7.5v5.5" stroke="#fff" />
  <circle cx="12" cy="16.5" r="1.2" fill="#fff" stroke="none" />
</>);

export const ShieldIcon = make(<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />);

export const TrashIcon = make(<>
  <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
</>);

export const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';

export function StarIcon({ size = 22, filled = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={STAR_PATH} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
