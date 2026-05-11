// skatemap-mobile/utils/cloudinary.ts
import axios from 'axios';

export const uploadImageToCloudinary = async (imageUri: string, cloudName: string, uploadPreset: string) => {
  const data = new FormData();
  data.append('file', { uri: imageUri, type: 'image/jpeg', name: 'spot_image.jpg' } as any);
  data.append('upload_preset', uploadPreset);
  data.append('cloud_name', cloudName);

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    data,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  
  return response.data.secure_url;
};