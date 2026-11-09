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

export const FlagIcon = make(<>
  <path d="M5 21V3.5" />
  <path d="M5 4h12.5l-2.6 4.5 2.6 4.5H5" />
</>);

export const ShieldIcon = make(<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />);

export const TrashIcon = make(<>
  <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
</>);

export const BellIcon = make(<>
  <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
  <path d="M10 20a2 2 0 0 0 4 0" />
</>);

// Feed: lines of activity
export const FeedIcon = make(<>
  <path d="M4 6h16M4 12h16M4 18h10" />
</>);

export const HeartIcon = function HeartIcon({ size = 22, filled = false, ...props }) {
  return (
    <svg width={size} height={size} {...base} {...props}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill={filled ? 'currentColor' : 'none'} />
    </svg>
  );
};

export const BookmarkIcon = function BookmarkIcon({ size = 22, filled = false, ...props }) {
  return (
    <svg width={size} height={size} {...base} {...props}>
      <path d="M6 3h12v18l-6-4-6 4z" fill={filled ? 'currentColor' : 'none'} />
    </svg>
  );
};

export const ShareIcon = make(<>
  <circle cx="18" cy="5" r="2.5" />
  <circle cx="6" cy="12" r="2.5" />
  <circle cx="18" cy="19" r="2.5" />
  <path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
</>);

export const ReplyIcon = make(<path d="M10 8L5 12l5 4M5 12h9a5 5 0 0 1 5 5v1" />);

export const EditIcon = make(<>
  <path d="M4 20h4L19 9l-4-4L4 16z" />
  <path d="M13.5 6.5l4 4" />
</>);

export const ArrowLeftIcon = make(<path d="M15 5l-7 7 7 7" strokeWidth="2.4" />);

export const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';

export function StarIcon({ size = 22, filled = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={STAR_PATH} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export const SearchIcon = make(<>
  <circle cx="11" cy="11" r="6.5" />
  <path d="M16 16l4.5 4.5" strokeWidth="2.4" />
</>);

export const PlusIcon = make(<path d="M12 5v14M5 12h14" strokeWidth="2.6" />);

export const SunIcon = make(<>
  <circle cx="12" cy="12" r="4" />
  <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
</>);

export const DropIcon = make(<path d="M12 3.5c3 3.8 5.5 6.6 5.5 9.6a5.5 5.5 0 0 1-11 0c0-3 2.5-5.8 5.5-9.6z" />);

export const RainIcon = make(<>
  <path d="M7 14.5a4.5 4.5 0 0 1-.3-9 5.5 5.5 0 0 1 10.6 1.3A3.6 3.6 0 0 1 17 14.5z" />
  <path d="M8 17.5l-1 2.5M12 17.5l-1 2.5M16 17.5l-1 2.5" />
</>);
