import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';

const AdminPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [spots, setSpots] = useState([]);
  const navigate = useNavigate();
  const isAdmin = user?.username === 'a';

  useEffect(() => {
    if (isAdmin) fetchSpots();
  }, [isAdmin]);

  if (!isAdmin) {
    return <Navigate to="/map" />;
  }

  const fetchSpots = async () => {
    try {
      const response = await axios.get('/spots');
      setSpots(response.data);
    } catch (error) {
      console.error('Error cargando spots', error);
    }
  };

  const handleDelete = async (spotId, spotName) => {
    if (window.confirm(t('admin.confirmDelete', { name: spotName }))) {
      try {
        await axios.delete(`/spots/${spotId}`);
        alert(t('admin.deleted'));
        fetchSpots();
      } catch (error) {
        alert(t('admin.deleteError'));
        console.error(error);
      }
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto', color: '#333' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{t('admin.title')}</h2>
        <button onClick={() => navigate('/map')} style={{ padding: '10px 15px', background: '#2f3542', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
          {t('admin.backToMap')}
        </button>
      </div>
      <table style={{ width: '100%', marginTop: '20px', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
        <thead>
          <tr style={{ background: '#f8f9fa', textAlign: 'start', color: '#495057' }}>
            <th style={{ padding: '12px 15px', borderBottom: '2px solid #dee2e6' }}>{t('admin.id')}</th>
            <th style={{ padding: '12px 15px', borderBottom: '2px solid #dee2e6' }}>{t('admin.name')}</th>
            <th style={{ padding: '12px 15px', borderBottom: '2px solid #dee2e6' }}>{t('admin.creator')}</th>
            <th style={{ padding: '12px 15px', borderBottom: '2px solid #dee2e6' }}>{t('admin.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {spots.length === 0 ? (
            <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>{t('admin.loadingSpots')}</td></tr>
          ) : spots.map((spot) => (
            <tr key={spot.id} style={{ borderBottom: '1px solid #dee2e6' }}>
              <td style={{ padding: '12px 15px' }}>{spot.id}</td>
              <td style={{ padding: '12px 15px' }}><strong>{spot.name}</strong></td>
              <td style={{ padding: '12px 15px' }}>{spot.createdBy}</td>
              <td style={{ padding: '12px 15px' }}>
                <button onClick={() => handleDelete(spot.id, spot.name)} style={{ background: '#ff4757', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  🗑️ {t('admin.delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminPage;
