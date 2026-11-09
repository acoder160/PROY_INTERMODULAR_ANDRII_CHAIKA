import { PaintStrip } from './PaintBits';

/** The SpotCheck name in the display face over the paint strip. There is no logo asset, so the type is the mark. */
export default function BrandLockup() {
  return (
    <div className="brand-lockup" aria-hidden="true">
      <span className="brand-word">SpotCheck</span>
      <PaintStrip className="brand-strip" />
    </div>
  );
}
