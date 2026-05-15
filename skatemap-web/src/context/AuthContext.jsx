import { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/axiosConfig';

// Creamos el contexto
const AuthContext = createContext();

// Hook personalizado para usar el contexto facil
export const useAuth = () => useContext(AuthContext);

// El proveedor que envolvera la app
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

    const login = async (username, password) => {
        try {
            const response = await api.post('/auth/login', { username, password });
            
            // MIRAR EN LA CONSOLA QUÉ LLEGA EXACTAMENTE
            console.log("RESPUESTA DEL LOGIN:", response.data); 

            // BUSCAR EL TOKEN CON VARIOS NOMBRES POSIBLES
            // Si no está en 'accessToken', mira en 'token', y si no en 'jwt'
            const elToken = response.data.accessToken || response.data.token || response.data.jwt;

            if (!elToken) {
                alert("ERROR CRÍTICO: El backend no ha devuelto ningún token válido.");
                throw new Error("Token no encontrado en la respuesta");
            }
            
            // GUARDAR EL TOKEN
            localStorage.setItem('token', elToken);
            localStorage.setItem('username', username);
            
            setUser({ username });
            return true; 
        } catch (error) {
            console.error("Error login:", error);
            throw error; 
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