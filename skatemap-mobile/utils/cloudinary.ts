import { File } from 'expo-file-system';
import api from './api';

export const uploadImageToCloudinary = async (imageUri: string): Promise<string> => {
  try {
    const signatureResponse = await api.get('/cloudinary/signature');
    const { signature, timestamp, api_key, cloud_name } = signatureResponse.data;

    const formData = new FormData();
    // Con el fetch de Expo el archivo debe ser un File/Blob, no un descriptor {uri,type,name}
    // @ts-ignore expo-file-system File implementa la interfaz Blob.
    formData.append('file', new File(imageUri));
    formData.append('api_key', String(api_key));
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);
    formData.append('folder', 'skatemap_spots');

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Error en la subida');
    }
    return data.secure_url;
  } catch (error) {
    console.error('Error en Signed Upload de Cloudinary:', error);
    throw error;
  }
};
