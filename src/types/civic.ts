export interface IssueReportSample {
  id: string;
  title: string;
  category: 'pothole' | 'streetlight' | 'garbage' | 'drainage' | 'water_leak';
  latitude: number;
  longitude: number;
  reportedAt: string;
  status: 'Reported' | 'Under Review' | 'Verified' | 'Assigned' | 'In Progress' | 'Resolved' | 'Corroborated';
  upvotes: number;
  parentClusterId?: string;
  severityScore: number;
  hazardWeight: number;
  vulnerabilityFactor: number;
  daysOpen: number;
  address?: string;
  ward?: string;
  city?: string;
  state?: string;
  pincode?: string;
  description?: string;
  clusterLabel?: string;
  imagePreview?: string;
  imageStorageMetadata?: {
    storageBucket: string;
    objectKey: string;
    fileSizeBytes?: number;
    capturedAt?: string;
    deviceSource?: 'camera_api' | 'device_upload' | 'verified_catalog';
    resolution?: string;
  };
  reportedBy?: string;
}
