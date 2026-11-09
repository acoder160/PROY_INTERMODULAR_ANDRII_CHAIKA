import { useState } from 'react';

// One paint per name, so the same skater always gets the same colour
const PAINTS = ['var(--paint-orange)', 'var(--paint-yellow)', 'var(--paint-blue)', 'var(--paint-green)', 'var(--paint-pink)'];

const paintFor = (name) => {
  let hash = 0;
  for (const ch of name || '?') hash = (hash * 31 + ch.codePointAt(0)) | 0;
  return PAINTS[Math.abs(hash) % PAINTS.length];
};

/** Profile photo, or the first letter of the name on a paint disc. Decorative: the name sits next to it. */
export default function Avatar({ username, url, size = 40 }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.48) };
  if (url && !failed) {
    // Cloudinary: ask for a square thumbnail at twice the display size
    const thumb = url.includes('/image/upload/')
      ? url.replace('/image/upload/', `/image/upload/c_fill,g_face,w_${size * 2},h_${size * 2},q_auto/`)
      : url;
    return <img className="avatar" src={thumb} alt="" style={style} onError={() => setFailed(true)} />;
  }
  return (
    <span className="avatar avatar-letter" style={{ ...style, background: paintFor(username) }} aria-hidden="true">
      {(username || '?').charAt(0).toUpperCase()}
    </span>
  );
}
