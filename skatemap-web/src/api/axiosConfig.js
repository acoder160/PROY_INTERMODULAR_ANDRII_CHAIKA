import axios from 'axios';

// 1. Crear una instancia de Axios con la dirección de tu Backend
const api = axios.create({
    baseURL: 'http://localhost:8080/api', // ¿Recuerdas? Tu backend corre aquí
    headers: {
        'Content-Type': 'application/json',
    },
});

// 2. Interceptor: Antes de cada petición, inyectar el Token si existe
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token'); // Buscamos el token en la caja fuerte del navegador
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`; // ¡Pum! Token pegado automáticamente
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;