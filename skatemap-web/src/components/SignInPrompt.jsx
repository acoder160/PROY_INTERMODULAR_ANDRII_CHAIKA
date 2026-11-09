import { useTranslation } from 'react-i18next';

/** Shown where a signed-out visitor would see their own data (feed, notifications, saved spots). */
export default function SignInPrompt({ onSignIn }) {
  const { t } = useTranslation();
  return (
    <div className="social-empty">
      <p>{t('social.signInToSee')}</p>
      <button type="button" className="btn-primary btn-small" onClick={onSignIn}>{t('map.enter')}</button>
    </div>
  );
}
