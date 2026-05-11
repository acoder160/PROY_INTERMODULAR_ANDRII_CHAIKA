import React, { useState, useEffect } from 'react';
import axios from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext'; // 🟢 CORRECCIÓN: Usamos tu custom hook
import { useNavigate, Navigate } from 'react-router-dom';
// import './AdminPage.css'; // Mantenlo comentado si no creaste el archivo CSS de la Opción 2

const AdminPage = () => {
  const { user } = useAuth(); // 🟢 Obtenemos solo el usuario
  const [spots, setSpots] = useState([]);
  const navigate = useNavigate();
  
  const token = localStorage.getItem('token'); // 🟢 Leemos el token del localStorage

  // 🔒 SEGURIDAD FRONTEND: Validamos user.username en vez de user
  if (user?.username !== 'a') {
    return <Navigate to="/map" />;
  }

  useEffect(() => {
    fetchSpots();
  }, []);

  const fetchSpots = async () => {
    try {
      const response = await axios.get('/spots', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSpots(response.data);
    } catch (error) {
      console.error("Error cargando spots", error);
    }
  };

  const handleDelete = async (spotId, spotName) => {
    if (window.confirm(`¿Estás seguro de que quieres borrar el spot "${spotName}" y todos sus comentarios?`)) {
      try {
        await axios.delete(`/spots/${spotId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert("Spot borrado correctamente");
        fetchSpots(); // Recargamos la tabla
      } catch (error) {
        alert("Error al borrar. Revisa tus permisos o la consola.");
        console.error(error);
      }
    }
  };

  return (
   <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto', color: '#333' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>🛡️ Panel de Administración</h2>
        <button onClick={() => navigate('/map')} style={{ padding: '10px 15px', background: '#2f3542', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
          Volver al Mapa
        </button>
      </div>

      <table style={{ width: '100%', marginTop: '20px', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
        <thead>
          <tr style={{ background: '#f8f9fa', textAlign: 'left', color: '#495057' }}>
            <th style={{ padding: '12px 15px', borderBottom: '2px solid #dee2e6' }}>ID</th>
            <th style={{ padding: '12px 15px', borderBottom: '2px solid #dee2e6' }}>Nombre</th>
            <th style={{ padding: '12px 15px', borderBottom: '2px solid #dee2e6' }}>Creador</th>
            <th style={{ padding: '12px 15px', borderBottom: '2px solid #dee2e6' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {spots.length === 0 ? (
            <tr>
              <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Cargando spots...</td>
            </tr>
          ) : (
            spots.map(spot => (
              <tr key={spot.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '12px 15px' }}>{spot.id}</td>
                <td style={{ padding: '12px 15px' }}><strong>{spot.name}</strong></td>
                <td style={{ padding: '12px 15px' }}>{spot.createdBy}</td>
                <td style={{ padding: '12px 15px' }}>
                  <button 
                    onClick={() => handleDelete(spot.id, spot.name)}
                    style={{ background: '#ff4757', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    🗑️ Borrar
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AdminPage;