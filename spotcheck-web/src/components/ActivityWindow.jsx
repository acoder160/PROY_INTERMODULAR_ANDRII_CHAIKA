import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import Sheet from './Sheet';
import FeedPanel from './FeedPanel';
import NotificationsPanel from './NotificationsPanel';

const TABS = ['feed', 'notifications'];

/**
 * One window over the map for everything social that happens to you: the feed of people you follow and your
 * notifications, as two tabs. `tab` and `onTab` live in the URL (?panel=), so Back and old links keep working.
 * `unread` badges the Notifications tab until it is shown.
 */
export default function ActivityWindow({ tab, onTab, onClose, onRead, unread = 0 }) {
  const { t } = useTranslation();
  const id = useId();

  const label = { feed: t('social.feed'), notifications: t('social.notifications') };

  const onKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const rtl = document.documentElement.dir === 'rtl';
    const step = (event.key === 'ArrowRight') !== rtl ? 1 : -1;
    const next = TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length];
    onTab(next);
    document.getElementById(`${id}-${next}`)?.focus();
  };

  return (
    <Sheet open onClose={onClose} title={t('social.activityTitle')} variant="window">
      <div className="activity-tabs" role="tablist" aria-label={t('social.activityTitle')} onKeyDown={onKeyDown}>
        {TABS.map((name) => (
          <button
            key={name}
            id={`${id}-${name}`}
            type="button"
            role="tab"
            aria-selected={tab === name}
            aria-controls={`${id}-panel`}
            tabIndex={tab === name ? 0 : -1}
            className={`choice-pill activity-tab${tab === name ? ' is-selected' : ''}`}
            onClick={() => onTab(name)}
          >
            <span>{label[name]}</span>
            {name === 'notifications' && unread > 0 && tab !== name && (
              <span className="count-badge" aria-label={`${unread}`}>{unread > 99 ? '99+' : unread}</span>
            )}
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`}>
        {tab === 'notifications' ? <NotificationsPanel onRead={onRead} /> : <FeedPanel />}
      </div>
    </Sheet>
  );
}
