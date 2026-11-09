import { createContext, useState, useEffect, useContext } from 'react';
import api, { clearAccessToken, setAccessToken } from '../api/axiosConfig';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// La respuesta de sesión (login, Google, refresh) trae el rol: ROLE_USER o ROLE_ADMIN
const toUser = (data, fallbackUsername) => ({
    id: data.id,
    username: data.username || fallbackUsername,
    email: data.email,
    role: data.role || 'ROLE_USER',
});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.post('/auth/refresh')
            .then((response) => {
                setAccessToken(response.data.token);
                setUser(toUser(response.data));
            })
            .catch((error) => {
                clearAccessToken();
                if (error.response?.status !== 401) {
                    console.error('Error restoring session:', error);
                }
            })
            .finally(() => setLoading(false));
    }, []);

    const login = async (username, password) => {
        try {
            const response = await api.post('/auth/login', { username, password });
            const token = response.data.accessToken || response.data.token || response.data.jwt;

            if (!token) {
                throw new Error('Token no encontrado en la respuesta');
            }

            setAccessToken(token);
            setUser(toUser(response.data, username));
            return true;
        } catch (error) {
            console.error('Error login:', error);
            throw error;
        }
    };

    // Login con Google: el backend verifica el ID token y devuelve la misma sesión que /auth/login
    const loginWithGoogle = async (idToken) => {
        const response = await api.post('/auth/google', { idToken });
        setAccessToken(response.data.token);
        setUser(toUser(response.data));
        return true;
    };

    const logout = async () => {
        clearAccessToken();
        setUser(null);
        try {
            await api.post('/auth/logout');
        } catch (error) {
            if (error.response?.status !== 401) {
                console.error('Error logging out:', error);
            }
        }
    };

    // Solo decide qué pantallas se muestran: el backend comprueba el rol en cada petición de admin
    const isAdmin = user?.role === 'ROLE_ADMIN';

    return (
        <AuthContext.Provider value={{ user, isAdmin, login, loginWithGoogle, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
