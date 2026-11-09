import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { TypeChip } from '../components/PaintBits';
import { TrashIcon } from '../components/Icons';
import '../MapChrome.css';
import '../Admin.css';

const AdminPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [spots, setSpots] = useState(null);
  const [notice, setNotice] = useState(null); // { kind: 'success' | 'error', text }
  const navigate = useNavigate();
  const isAdmin = user?.username === 'a';

  const fetchSpots = useCallback(async () => {
    try {
      const response = await axios.get('/spots');
      setSpots(response.data);
    } catch (error) {
      console.error('Error cargando spots', error);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    axios.get('/spots')
      .then((response) => { if (!cancelled) setSpots(response.data); })
      .catch((error) => console.error('Error cargando spots', error));
    return () => { cancelled = true; };
  }, [isAdmin]);

  if (!isAdmin) {
    return <Navigate to="/map" />;
  }

  const handleDelete = async (spotId, spotName) => {
    if (!window.confirm(t('admin.confirmDelete', { name: spotName }))) return;
    try {
      await axios.delete(`/spots/${spotId}`);
      setNotice({ kind: 'success', text: t('admin.deleted') });
      fetchSpots();
    } catch (error) {
      setNotice({ kind: 'error', text: t('admin.deleteError') });
      console.error(error);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-bar">
        <h1 className="admin-title">{t('admin.title')}</h1>
        <button type="button" className="bar-pill bar-pill-account" onClick={() => navigate('/map')}>
          <span className="bar-pill-text">{t('admin.backToMap')}</span>
        </button>
      </header>

      <main className="admin-main">
        {notice && (
          <div className={`notice notice-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
            <span>{notice.text}</span>
          </div>
        )}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">{t('admin.id')}</th>
                <th scope="col">{t('admin.name')}</th>
                <th scope="col">{t('admin.creator')}</th>
                <th scope="col">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {spots === null || spots.length === 0 ? (
                <tr><td colSpan="4" className="admin-empty">{t('admin.loadingSpots')}</td></tr>
              ) : spots.map((spot) => (
                <tr key={spot.id}>
                  <td className="admin-num">{spot.id}</td>
                  <td>
                    <div className="admin-name">
                      <strong>{spot.name}</strong>
                      {spot.spotType && <TypeChip type={spot.spotType} label={t(`types.${spot.spotType}`, { defaultValue: spot.spotType })} />}
                    </div>
                  </td>
                  <td>{spot.createdBy}</td>
                  <td>
                    <button type="button" className="btn-danger" onClick={() => handleDelete(spot.id, spot.name)}>
                      <TrashIcon size={18} />
                      <span>{t('admin.delete')}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default AdminPage;
