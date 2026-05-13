import axios from 'axios';
import { API_BASE_URL } from '../constants/api';

export const uploadImageToCloudinary = async (imageUri: string, userToken: string): Promise<string> => {
  try {
    console.log("1. Pedimos la firma segura a nuestro backend");
    const signatureResponse = await axios.get(`${API_BASE_URL}/api/cloudinary/signature`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    const { signature, timestamp, api_key, cloud_name } = signatureResponse.data;
    console.log("2. Firma obtenida:", signatureResponse.data);

    const formData = new FormData();
    
    // En Android, a veces el uri necesita ser tratado con cuidado
    const fileToUpload = {
      uri: imageUri,
      type: 'image/jpeg',
      name: `upload_${Date.now()}.jpg`,
    };

    // @ts-ignore
    formData.append('file', fileToUpload);
    formData.append('api_key', String(api_key)); // Forzamos string
    formData.append('timestamp', String(timestamp)); // Forzamos string
    formData.append('signature', signature);
    formData.append('folder', 'skatemap_spots');

    console.log("3. Subiendo foto a Cloudinary...");

    // Usamos fetch sin headers manuales para que el navegador/móvil 
    // gestione el 'boundary' del FormData automáticamente
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (response.ok) {
        console.log("4. ¡Subida éxito!");
        return data.secure_url;
    } else {
        console.error("Error respuesta Cloudinary:", data);
        throw new Error(data.error?.message || "Error en la subida");
    }

  } catch (error) {
    console.error('Error en Signed Upload de Cloudinary:', error);
    throw error;
  }
};