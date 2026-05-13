import axios from 'axios';
import { API_BASE_URL } from '../constants/api';

export const uploadImageToCloudinary = async (imageUri: string, userToken: string): Promise<string> => {
  try {
    // 1. Pedimos la firma segura a nuestro backend de Spring Boot
    const signatureResponse = await axios.get(`${API_BASE_URL}/api/cloudinary/signature`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    const { signature, timestamp, api_key, cloud_name } = signatureResponse.data;

    // 2. Preparamos la imagen para subir
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: `spot_${timestamp}.jpg`,
    } as any);

    // 3. Adjuntamos la firma en lugar del upload_preset "Unsigned"
    formData.append('api_key', api_key);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('folder', 'skatemap_spots');

    // 4. Subimos la foto a Cloudinary
    const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await cloudinaryResponse.json();

    if (data.secure_url) {
      return data.secure_url;
    } else {
      throw new Error("Cloudinary no devolvió una URL válida");
    }
  } catch (error) {
    console.error('Error en Signed Upload de Cloudinary:', error);
    throw error;
  }
};