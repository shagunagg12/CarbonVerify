import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

export interface QueueItem {
  id: string;
  filename: string;
  fileBlob: Blob;
  userId: string;
  userName: string;
  status: 'pending' | 'uploading' | 'failed';
  error?: string;
  timestamp: Date;
}

interface EvidenceCaptureDB extends DBSchema {
  uploadQueue: {
    key: string;
    value: QueueItem;
    indexes: { 'by-status': string };
  };
}

let dbPromise: Promise<IDBPDatabase<EvidenceCaptureDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<EvidenceCaptureDB>('EvidenceCaptureDB', 1, {
      upgrade(db) {
        const store = db.createObjectStore('uploadQueue', {
          keyPath: 'id',
        });
        store.createIndex('by-status', 'status');
      },
    });
  }
  return dbPromise;
}

export async function addToQueue(file: File, userId: string, userName: string): Promise<QueueItem> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const item: QueueItem = {
    id,
    filename: file.name,
    fileBlob: file, // File is a subclass of Blob, safe to store
    userId,
    userName,
    status: 'pending',
    timestamp: new Date(),
  };
  await db.put('uploadQueue', item);
  return item;
}

export async function getQueue(): Promise<QueueItem[]> {
  const db = await getDB();
  return db.getAll('uploadQueue');
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('uploadQueue', id);
}

export async function updateQueueStatus(
  id: string,
  status: 'pending' | 'uploading' | 'failed',
  error?: string
): Promise<void> {
  const db = await getDB();
  const item = await db.get('uploadQueue', id);
  if (item) {
    item.status = status;
    item.error = error;
    await db.put('uploadQueue', item);
  }
}
