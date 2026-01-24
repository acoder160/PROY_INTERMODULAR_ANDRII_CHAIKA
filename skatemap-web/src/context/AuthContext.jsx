import { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/axiosConfig';

// Creamos el contexto
const AuthContext = createContext();

// Hook personalizado para usar el contexto fácil
export const useAuth = () => useContext(AuthContext);

// El proveedor que envolverá la app
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Al arrancar, miramos si hay token guardado
    useEffect(() => {
        const token = localStorage.getItem('token');
        const username = localStorage.getItem('username');
        
        if (token && username) {
            setUser({ username }); // Si hay token, restauramos al usuario
        }
        setLoading(false);
    }, []);

    // Función de Login
    const login = async (username, password) => {
        try {
            const response = await api.post('/auth/login', { username, password });
            const { accessToken } = response.data; // Tu backend devuelve "accessToken"
            
            // Guardamos en la "Caja Fuerte" del navegador
            localStorage.setItem('token', accessToken);
            localStorage.setItem('username', username);
            
            setUser({ username });
            return true; // Éxito
        } catch (error) {
            console.error("Error login:", error);
            throw error; // Lanzamos error para que lo maneje el formulario
        }
    };

    // Función de Logout
    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};