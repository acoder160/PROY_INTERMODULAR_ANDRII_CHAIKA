import { createContext, useState, useEffect, useContext } from 'react';
import api, { clearAccessToken, setAccessToken } from '../api/axiosConfig';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.post('/auth/refresh')
            .then((response) => {
                setAccessToken(response.data.token);
                setUser({
                    id: response.data.id,
                    username: response.data.username,
                    email: response.data.email,
                });
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
            setUser({
                id: response.data.id,
                username: response.data.username || username,
                email: response.data.email,
            });
            return true;
        } catch (error) {
            console.error('Error login:', error);
            throw error;
        }
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

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
