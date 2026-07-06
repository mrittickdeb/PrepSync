import api from './api';

// ===== Types =====

interface UploadSignature {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
  resourceType: string;
}

export interface UploadResult {
  url: string;
  publicId: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
  resourceType: string;
  originalFilename: string;
}

// ===== Get Upload Signature =====

async function getUploadSignature(
  resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto',
  folder = 'prepsync/chat',
): Promise<UploadSignature> {
  const { data } = await api.post('/upload/signature', { folder, resourceType });
  return data;
}

// ===== Determine Cloudinary resource type from file =====

export function getResourceType(file: File): 'image' | 'video' | 'raw' | 'auto' {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'raw';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'video';
  return 'auto';
}

export function getFileDownloadUrl(url: string, filename?: string): string {
  if (!url) return '';
  if (url.includes('cloudinary.com') && url.includes('/raw/upload/')) {
    if (!url.includes('/fl_attachment')) {
      const parts = url.split('/raw/upload/');
      let cleanName = '';
      if (filename) {
        const lastDot = filename.lastIndexOf('.');
        const nameWithoutExt = lastDot !== -1 ? filename.slice(0, lastDot) : filename;
        cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_');
      }
      const flag = cleanName ? `fl_attachment:${cleanName}` : 'fl_attachment';
      return `${parts[0]}/raw/upload/${flag}/${parts[1]}`;
    }
  }
  return url;
}

// ===== Determine attachment type from file =====

export function getAttachmentType(
  file: File | Blob,
): 'image' | 'video' | 'audio' | 'document' | 'voice' {
  const mimeType = file instanceof File ? file.type : (file as Blob).type;
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

// ===== Format file size =====

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ===== Upload to Cloudinary (client-side direct upload) =====

export async function uploadToCloudinary(
  file: File | Blob,
  onProgress?: (percent: number) => void,
  filenameOverride?: string,
): Promise<UploadResult> {
  const resourceType =
    file instanceof File ? getResourceType(file) : 'video'; // Blob = voice recording (audio)
  const sig = await getUploadSignature(resourceType);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', sig.apiKey);
  formData.append('timestamp', sig.timestamp.toString());
  formData.append('signature', sig.signature);
  formData.append('folder', sig.folder);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/${resourceType}/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        const fname =
          filenameOverride ||
          data.original_filename ||
          (file instanceof File ? file.name : 'voice-message');
        resolve({
          url: data.secure_url,
          publicId: data.public_id,
          format: data.format,
          bytes: data.bytes,
          width: data.width,
          height: data.height,
          duration: data.duration,
          resourceType: data.resource_type,
          originalFilename: fname,
        });
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Upload failed: network error'));
    xhr.send(formData);
  });
}

// ===== File validation =====

const MAX_SIZES: Record<string, number> = {
  image: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  audio: 10 * 1024 * 1024,
  document: 20 * 1024 * 1024,
};

export function validateFile(file: File): string | null {
  const type = getAttachmentType(file);
  const maxSize = MAX_SIZES[type] || MAX_SIZES.document;
  if (file.size > maxSize) {
    return `File too large. Max size for ${type}: ${formatFileSize(maxSize)}`;
  }
  return null;
}

// ===== Accepted file types per category =====

export const FILE_ACCEPT: Record<string, string> = {
  image: 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml',
  video: 'video/mp4,video/webm,video/quicktime,video/x-msvideo',
  audio: 'audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4,audio/aac',
  document: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z',
};

// ===== Backward-compatible alias (used by DMsPage) =====

export async function uploadFile(
  file: File,
  _folder?: string,
): Promise<{ url: string; filename: string; filesize: number }> {
  const result = await uploadToCloudinary(file);
  return {
    url: result.url,
    filename: result.originalFilename || file.name,
    filesize: result.bytes,
  };
}

