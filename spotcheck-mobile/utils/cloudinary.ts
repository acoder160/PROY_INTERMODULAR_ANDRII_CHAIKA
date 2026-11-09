import { File } from 'expo-file-system';
import api from './api';

export const uploadImageToCloudinary = async (imageUri: string): Promise<string> => {
  try {
    const signatureResponse = await api.get('/cloudinary/signature');
    const { signature, timestamp, api_key, cloud_name, params } = signatureResponse.data;

    const formData = new FormData();
    // Expo's fetch needs a File/Blob here, not a {uri, type, name} descriptor
    // @ts-ignore expo-file-system File implements the Blob interface.
    formData.append('file', new File(imageUri));
    formData.append('api_key', String(api_key));
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);
    // Every signed parameter (folder, allowed formats, size limit) must be sent back unchanged
    Object.entries((params ?? {}) as Record<string, unknown>).forEach(([key, value]) => {
      formData.append(key, String(value));
    });

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Upload failed');
    }
    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary signed upload failed:', error);
    throw error;
  }
};
