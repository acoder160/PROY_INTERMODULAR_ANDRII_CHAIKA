import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import PageBar from '../components/PageBar';
import Avatar from '../components/Avatar';
import SpotCard from '../components/SpotCard';
import ActiveSessions from '../components/ActiveSessions';
import Sheet from '../components/Sheet';
import ReportSheet from '../components/ReportSheet';
import { LogoutIcon, EditIcon, BookmarkIcon, FlagIcon } from '../components/Icons';
import { apiErrorText, formatMonthYear, uploadImage } from '../utils/social';
import '../Social.css';

const TABS = ['spots', 'followers', 'following'];

export default function ProfilePage() {
  const { username } = useParams();
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | missing | failed
  const [tab, setTab] = useState('spots');
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    api.get(`/users/${encodeURIComponent(username)}`)
      .then((res) => { if (!cancelled) { setProfile(res.data); setState('ready'); } })
      .catch((err) => { if (!cancelled) setState(err.response?.status === 404 ? 'missing' : 'failed'); });
    return () => { cancelled = true; };
  }, [username, user, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setList(null);
    const path = tab === 'spots' ? 'spots' : tab;
    api.get(`/users/${encodeURIComponent(username)}/${path}`)
      .then((res) => { if (!cancelled) setList(res.data ?? []); })
      .catch(() => { if (!cancelled) setList([]); });
    return () => { cancelled = true; };
  }, [username, tab, reloadKey]);


  const [reporting, setReporting] = useState(false);

  const toggleBlock = async () => {
    if (!user) { navigate('/login'); return; }
    const path = `/users/${encodeURIComponent(username)}/block`;
    if (!profile.blockedByMe && !window.confirm(t('safety.blockConfirm', { username }))) return;
    setBusy(true);
    try {
      if (profile.blockedByMe) await api.delete(path); else await api.put(path);
      setProfile((p) => ({
        ...p,
        blockedByMe: !p.blockedByMe,
        followedByMe: false,
        followers: p.followedByMe ? Math.max(0, p.followers - 1) : p.followers,
      }));
    } finally {
      setBusy(false);
    }
  };

  const toggleFollow = async () => {
    if (!user) { navigate('/login'); return; }
    setBusy(true);
    try {
      const path = `/users/${encodeURIComponent(username)}/follow`;
      const res = profile.followedByMe ? await api.delete(path) : await api.post(path);
      setProfile((p) => ({ ...p, followedByMe: res.data.following, followers: res.data.followers }));
    } finally {
      setBusy(false);
    }
  };

  const confirmLogout = () => {
    if (window.confirm(t('map.logoutConfirm'))) logout().then(() => navigate('/map'));
  };

  if (state !== 'ready') {
    return (
      <div className="admin-page social-page">
        <PageBar title={t('social.profile')} />
        <main className="social-main">
          {state === 'loading'
            ? <span className="spinner spinner-ink spinner-center" aria-label={t('popup.loading')} />
            : <p className="social-empty">{state === 'missing' ? t('social.userNotFound') : t('social.loadFailed')}</p>}
        </main>
      </div>
    );
  }

  const counts = { spots: profile.spots, followers: profile.followers, following: profile.following };

  return (
    <div className="admin-page social-page">
      <PageBar title={t('social.profile')}>
        {profile.me && (
          <button type="button" className="bar-pill" onClick={confirmLogout} aria-label={t('map.logout')}>
            <LogoutIcon size={20} />
          </button>
        )}
      </PageBar>

      <main className="social-main">
        <section className="profile-card">
          <Avatar username={profile.username} url={profile.avatarUrl} size={88} />
          <div className="profile-head">
            <h2 className="profile-name">{profile.username}</h2>
            <p className="profile-since">{t('social.memberSince', { date: formatMonthYear(profile.createdAt, i18n.language) })}</p>
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          </div>
          <div className="profile-actions">
            {profile.me ? (
              <>
                <button type="button" className="btn-outline btn-small" onClick={() => setEditing(true)}>
                  <EditIcon size={18} />
                  <span>{t('social.editProfile')}</span>
                </button>
                <Link className="btn-outline btn-small" to="/saved">
                  <BookmarkIcon size={18} />
                  <span>{t('social.savedSpots')}</span>
                </Link>
              </>
            ) : (
              <>
                {!profile.blockedByMe && (
                  <button type="button" className={profile.followedByMe ? 'btn-outline btn-small' : 'btn-primary btn-small'}
                          onClick={toggleFollow} disabled={busy} aria-pressed={profile.followedByMe}>
                    {profile.followedByMe ? t('social.followingState') : t('social.follow')}
                  </button>
                )}
                {user && (
                  <>
                    <button type="button" className="btn-outline btn-small" onClick={toggleBlock} disabled={busy}>
                      <span>{profile.blockedByMe ? t('safety.unblock') : t('safety.block')}</span>
                    </button>
                    <button type="button" className="btn-outline btn-small" onClick={() => setReporting(true)}>
                      <FlagIcon size={18} />
                      <span>{t('report.title')}</span>
                    </button>
                  </>
                )}
              </>
            )}
          </div>
          <dl className="profile-stats">
            <div><dt>{t('social.ratingsCount')}</dt><dd>{profile.ratings}</dd></div>
            <div><dt>{t('social.commentsCount')}</dt><dd>{profile.comments}</dd></div>
          </dl>
        </section>

        {profile.me && <ActiveSessions reloadKey={reloadKey} />}

        <nav className="admin-tabs social-tabs" aria-label={t('social.profile')}>
          {TABS.map((key) => (
            <button key={key} type="button" className={`admin-tab${tab === key ? ' is-active' : ''}`}
                    onClick={() => setTab(key)} aria-pressed={tab === key}>
              {t(`social.${key}Count`)}
              <span className="admin-tab-count">{counts[key]}</span>
            </button>
          ))}
        </nav>

        <section className="social-list">
          {list === null && <span className="spinner spinner-ink spinner-center" aria-label={t('popup.loading')} />}
          {list?.length === 0 && (
            <p className="social-empty">{tab === 'spots' ? t('social.noSpotsYet') : t('social.nobodyYet')}</p>
          )}
          {tab === 'spots' && list?.map((spot) => <SpotCard key={spot.id} spot={spot} />)}
          {tab !== 'spots' && list?.map((person) => (
            <Link key={person.username} className="person-row" to={`/u/${encodeURIComponent(person.username)}`}>
              <Avatar username={person.username} url={person.avatarUrl} size={40} />
              <span className="person-name">{person.username}</span>
              {person.followedByMe && <span className="person-tag">{t('social.followingState')}</span>}
            </Link>
          ))}
        </section>
      </main>

      {reporting && (
        <ReportSheet endpoint={`/users/${encodeURIComponent(username)}/reports`} subject={username} onClose={() => setReporting(false)} />
      )}

      {editing && (
        <EditProfileSheet
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); setReloadKey((k) => k + 1); }}
          onDeleted={() => { logout().then(() => navigate('/map')); }}
        />
      )}
    </div>
  );
}

function EditProfileSheet({ profile, onClose, onSaved, onDeleted }) {
  const { t } = useTranslation();
  const [bio, setBio] = useState(profile.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const pickPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setAvatarUrl(await uploadImage(file));
    } catch {
      setError(t('errors.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.patch('/users/me', { bio, avatarUrl });
      onSaved();
    } catch (err) {
      setError(apiErrorText(err, t, { text_rejected: 'social.bioRejected' }));
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm(t('social.deleteAccountConfirm'))) return;
    try {
      await api.delete('/users/me');
      onDeleted();
    } catch (err) {
      setError(apiErrorText(err, t));
    }
  };

  return (
    <Sheet open onClose={onClose} title={t('social.editProfile')}>
      <form className="social-form" onSubmit={save}>
        <div className="avatar-edit">
          <Avatar username={profile.username} url={avatarUrl} size={72} />
          <label className="btn-outline btn-small">
            {uploading ? <span className="spinner spinner-ink" aria-label={t('popup.loading')} /> : t('social.changePhoto')}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickPhoto} disabled={uploading} />
          </label>
          {avatarUrl && (
            <button type="button" className="btn-outline btn-small" onClick={() => setAvatarUrl('')}>{t('social.removePhoto')}</button>
          )}
        </div>

        <label className="social-label" htmlFor="profile-bio">{t('social.bio')}</label>
        <textarea id="profile-bio" className="comment-input" rows={3} maxLength={280} value={bio}
                  placeholder={t('social.bioPlaceholder')} onChange={(e) => setBio(e.target.value)} />
        <p className="social-hint">{bio.length} / 280</p>

        {error && <p className="comment-error" role="alert">{error}</p>}
        <button type="submit" className="btn-primary" disabled={saving || uploading}>
          {saving ? <span className="spinner spinner-ink" aria-label={t('popup.sending')} /> : t('social.save')}
        </button>

        <div className="danger-zone">
          <p className="social-hint">{t('social.deleteAccountHint')}</p>
          <button type="button" className="btn-outline btn-small btn-danger" onClick={deleteAccount}>
            {t('social.deleteAccount')}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
