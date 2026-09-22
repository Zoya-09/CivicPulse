/**
 * Simulated Cloud & Local Storage Engine for Civic Hazard Evidence Photos.
 * Provides resilient client-side caching with simulated cloud bucket persistence.
 */

export interface SimulatedMediaRecord {
  reportId: string;
  dataUrl: string;
  storageBucket: string;
  objectKey: string;
  fileSizeBytes: number;
  capturedAt: string;
  deviceSource: 'camera_api' | 'device_upload' | 'verified_catalog';
  resolution: string;
  hashChecksum: string;
}

const MEMORY_MEDIA_STORAGE = new Map<string, SimulatedMediaRecord>();

/**
 * Generates a mock SHA-256 hash for spatial evidence verification.
 */
function generateSimulatedChecksum(input: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(input.length, 500); i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `sha256_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Saves a captured photo to simulated persistent storage (localStorage + memory map).
 */
export function simulateSaveIncidentPhoto(
  reportId: string,
  imageDataUrl: string,
  options?: {
    deviceSource?: 'camera_api' | 'device_upload' | 'verified_catalog';
    resolution?: string;
  }
): SimulatedMediaRecord {
  // Approximate byte size from Base64 string
  const approxBytes = Math.round((imageDataUrl.length * 3) / 4);
  const now = new Date().toISOString();
  const bucketName = 'civic-resilience-evidence-vault.s3.ap-south-1.amazonaws.com';
  const objectKey = `reports/${reportId}/field_capture_${Date.now()}.jpg`;

  const record: SimulatedMediaRecord = {
    reportId,
    dataUrl: imageDataUrl,
    storageBucket: bucketName,
    objectKey,
    fileSizeBytes: approxBytes,
    capturedAt: now,
    deviceSource: options?.deviceSource || 'camera_api',
    resolution: options?.resolution || '1280x720 (HD)',
    hashChecksum: generateSimulatedChecksum(imageDataUrl),
  };

  // 1. Store in memory map
  MEMORY_MEDIA_STORAGE.set(reportId, record);

  // 2. Attempt lightweight storage in localStorage for reload survival
  try {
    // If size is under 2MB, store in localStorage
    if (approxBytes < 2 * 1024 * 1024) {
      localStorage.setItem(`civic_evidence_${reportId}`, JSON.stringify(record));
    }
  } catch (err) {
    console.warn('LocalStorage quota limit reached, stored in memory cache:', err);
  }

  return record;
}

/**
 * Retrieves a stored photo record for a given report ID.
 */
export function getStoredIncidentPhoto(reportId: string): SimulatedMediaRecord | null {
  if (MEMORY_MEDIA_STORAGE.has(reportId)) {
    return MEMORY_MEDIA_STORAGE.get(reportId)!;
  }

  try {
    const raw = localStorage.getItem(`civic_evidence_${reportId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as SimulatedMediaRecord;
      MEMORY_MEDIA_STORAGE.set(reportId, parsed);
      return parsed;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Returns overall storage metrics for the simulated municipal photo vault.
 */
export function getSimulatedStorageStats(): {
  totalStoredImages: number;
  totalSizeBytes: number;
  formattedSize: string;
} {
  let count = MEMORY_MEDIA_STORAGE.size;
  let totalBytes = 0;

  MEMORY_MEDIA_STORAGE.forEach((item) => {
    totalBytes += item.fileSizeBytes;
  });

  const formatted =
    totalBytes > 1024 * 1024
      ? `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`
      : `${(totalBytes / 1024).toFixed(1)} KB`;

  return {
    totalStoredImages: count,
    totalSizeBytes: totalBytes,
    formattedSize: formatted,
  };
}
