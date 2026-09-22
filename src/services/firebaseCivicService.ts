import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  limit,
  increment,
  Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { IssueReportSample } from '../types/civic';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const COMPLAINTS_COLLECTION = 'complaints';

/**
 * Validates backend connectivity on initial boot using allowed collection
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const q = query(collection(db, COMPLAINTS_COLLECTION), limit(1));
    await getDocs(q);
    return true;
  } catch (error: any) {
    if (error?.message && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or network is unreachable.');
    }
    return false;
  }
}

/**
 * Saves a new civic complaint to the backend Firestore collection
 */
export async function saveComplaintToBackend(complaint: IssueReportSample): Promise<void> {
  const path = `${COMPLAINTS_COLLECTION}/${complaint.id}`;
  try {
    // Sanitize payload ensuring fields conform to schema
    const payload: Record<string, any> = {
      id: complaint.id,
      title: complaint.title.slice(0, 300),
      category: complaint.category,
      latitude: Number(complaint.latitude),
      longitude: Number(complaint.longitude),
      reportedAt: complaint.reportedAt || new Date().toISOString(),
      status: complaint.status || 'Reported',
      upvotes: Number(complaint.upvotes || 0),
      severityScore: Number(complaint.severityScore || 5),
      hazardWeight: Number(complaint.hazardWeight || 1.2),
      vulnerabilityFactor: Number(complaint.vulnerabilityFactor || 1.1),
      daysOpen: Number(complaint.daysOpen || 0),
      address: (complaint.address || '').slice(0, 500),
      ward: (complaint.ward || 'General Locality').slice(0, 120),
      city: (complaint.city || '').slice(0, 100),
      state: (complaint.state || '').slice(0, 100),
      pincode: (complaint.pincode || '').slice(0, 30),
      description: (complaint.description || '').slice(0, 3000),
      reportedBy: (complaint.reportedBy || 'Citizen Reporter').slice(0, 120),
    };

    if (complaint.clusterLabel) {
      payload.clusterLabel = complaint.clusterLabel.slice(0, 150);
    }
    if (complaint.parentClusterId) {
      payload.parentClusterId = complaint.parentClusterId.slice(0, 128);
    }
    if (complaint.imagePreview) {
      payload.imagePreview = complaint.imagePreview.slice(0, 150000);
    }
    if (complaint.imageStorageMetadata) {
      payload.imageStorageMetadata = complaint.imageStorageMetadata;
    }

    await setDoc(doc(db, COMPLAINTS_COLLECTION, complaint.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Updates complaint status in Firestore (handles both existing & fresh documents)
 */
export async function updateComplaintStatusInBackend(
  complaintId: string,
  newStatus: IssueReportSample['status']
): Promise<void> {
  const path = `${COMPLAINTS_COLLECTION}/${complaintId}`;
  try {
    const docRef = doc(db, COMPLAINTS_COLLECTION, complaintId);
    await updateDoc(docRef, { status: newStatus });
  } catch (error) {
    // If not yet present or offline, attempt merge update
    try {
      const docRef = doc(db, COMPLAINTS_COLLECTION, complaintId);
      await setDoc(docRef, { status: newStatus }, { merge: true });
    } catch {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

/**
 * Increments complaint upvote in Firestore atomically
 */
export async function upvoteComplaintInBackend(
  complaintId: string,
  currentUpvotes: number
): Promise<void> {
  const path = `${COMPLAINTS_COLLECTION}/${complaintId}`;
  try {
    const docRef = doc(db, COMPLAINTS_COLLECTION, complaintId);
    await updateDoc(docRef, { upvotes: increment(1) });
  } catch (error) {
    try {
      const docRef = doc(db, COMPLAINTS_COLLECTION, complaintId);
      await setDoc(docRef, { upvotes: (currentUpvotes || 0) + 1 }, { merge: true });
    } catch {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

/**
 * Subscribes to real-time complaint updates from Firestore
 */
export function subscribeToComplaints(
  onUpdate: (complaints: IssueReportSample[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, COMPLAINTS_COLLECTION));
  return onSnapshot(
    q,
    (snapshot) => {
      const results: IssueReportSample[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as IssueReportSample;
        results.push(data);
      });
      onUpdate(results);
    },
    (error) => {
      console.warn('Realtime complaints subscription notice:', error?.message || error);
      if (onError) onError(error);
    }
  );
}

/**
 * Batch seeds initial sample complaints if the backend database is empty or missing records
 */
export async function seedInitialComplaintsIfEmpty(initialSamples: IssueReportSample[]): Promise<boolean> {
  try {
    const snapshot = await getDocs(collection(db, COMPLAINTS_COLLECTION));
    const existingIds = new Set(snapshot.docs.map((d) => d.id));

    let seededCount = 0;
    for (const sample of initialSamples) {
      if (!existingIds.has(sample.id)) {
        await saveComplaintToBackend(sample);
        seededCount++;
      }
    }
    return seededCount > 0;
  } catch (error) {
    console.warn('Initial seeding check completed or skipped:', error);
    return false;
  }
}
