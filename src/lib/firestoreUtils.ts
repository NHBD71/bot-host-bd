import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { db, auth } from "../firebase";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Custom CRUD abstractions to ensure strict safety
export async function secureSetDoc(path: string, docId: string, data: any) {
  try {
    const docRef = doc(db, path, docId);
    await setDoc(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${docId}`);
  }
}

export async function secureAddDoc(path: string, data: any) {
  try {
    const colRef = collection(db, path);
    const docRef = await addDoc(colRef, { ...data, createdAt: serverTimestamp() });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// Recursive helper to map any Firestore Timestamps to ISO date strings
export function parseTimestamps(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  // Check if it is a Firestore Timestamp
  if (typeof data.toDate === "function") {
    return data.toDate().toISOString();
  }

  // Handle timestamp object containing seconds/nanoseconds
  if (data.seconds !== undefined && data.nanoseconds !== undefined) {
    return new Date(data.seconds * 1000).toISOString();
  }

  if (Array.isArray(data)) {
    return data.map(item => parseTimestamps(item));
  }

  const result: any = {};
  for (const key of Object.keys(data)) {
    result[key] = parseTimestamps(data[key]);
  }
  return result;
}

export async function secureGetDoc(path: string, docId: string) {
  try {
    const docRef = doc(db, path, docId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? parseTimestamps(snapshot.data()) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${path}/${docId}`);
  }
}

export async function secureUpdateDoc(path: string, docId: string, data: any) {
  try {
    const docRef = doc(db, path, docId);
    await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${path}/${docId}`);
  }
}

export async function secureDeleteDoc(path: string, docId: string) {
  try {
    const docRef = doc(db, path, docId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${path}/${docId}`);
  }
}

export async function secureGetDocs(path: string, whereFilters?: { field: string; operator: any; value: any }[]) {
  try {
    const colRef = collection(db, path);
    if (whereFilters && whereFilters.length > 0) {
      const q = query(colRef, ...whereFilters.map(f => where(f.field, f.operator, f.value)));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => parseTimestamps({ id: d.id, ...d.data() }));
    } else {
      const snapshot = await getDocs(colRef);
      return snapshot.docs.map(d => parseTimestamps({ id: d.id, ...d.data() }));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
