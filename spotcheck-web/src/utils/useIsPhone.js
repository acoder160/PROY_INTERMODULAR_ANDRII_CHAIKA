import { useEffect, useState } from 'react';

const QUERY = '(max-width: 719px)'; // the same breakpoint where sheets stop being centred cards

/** Share of the screen the spot sheet takes while it peeks. Keep in sync with .sheet.is-peek in MapChrome.css. */
export const PEEK_RATIO = 0.5;

/** True on phone-width viewports. Follows rotation and window resizes. */
export default function useIsPhone() {
  const [isPhone, setIsPhone] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const onChange = (event) => setIsPhone(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return isPhone;
}
