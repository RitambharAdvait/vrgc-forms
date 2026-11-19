import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { ClubEvent } from '@/types/events';

export const EVENTS_COLLECTION = 'events';

/**
 * Fetch all events from Firestore (sorted by eventDate ascending)
 */
export async function fetchClubEvents(): Promise<ClubEvent[]> {
  try {
    const colRef = collection(db, EVENTS_COLLECTION);
    const q = query(colRef, orderBy('eventDate', 'asc'));
    const snap = await getDocs(q);
    const list: ClubEvent[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        name: data.name || 'Untitled Event',
        description: data.description || '',
        venue: data.venue || 'TBA',
        eventDate: data.eventDate || '',
        eventTime: data.eventTime || '',
        eventType: data.eventType || 'Other',
        registrationLink: data.registrationLink || '',
        status: data.status || 'upcoming',
        bannerUrl: data.bannerUrl || '',
        createdBy: data.createdBy || '',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || '',
      });
    });

    return list;
  } catch (err) {
    console.error('Error fetching club events:', err);
    return [];
  }
}

/**
 * Subscribe to real-time events collection updates
 */
export function subscribeToClubEvents(
  callback: (events: ClubEvent[]) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const colRef = collection(db, EVENTS_COLLECTION);
    const q = query(colRef, orderBy('eventDate', 'asc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: ClubEvent[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            name: data.name || 'Untitled Event',
            description: data.description || '',
            venue: data.venue || 'TBA',
            eventDate: data.eventDate || '',
            eventTime: data.eventTime || '',
            eventType: data.eventType || 'Other',
            registrationLink: data.registrationLink || '',
            status: data.status || 'upcoming',
            bannerUrl: data.bannerUrl || '',
            createdBy: data.createdBy || '',
            createdAt: data.createdAt || '',
            updatedAt: data.updatedAt || '',
          });
        });
        callback(list);
      },
      (err) => {
        console.warn('Real-time events subscription error:', err);
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    console.error('Failed to subscribe to club events:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Create a new event that instantly publishes to vrgc.live
 */
export async function createClubEvent(
  eventData: Omit<ClubEvent, 'id' | 'createdAt' | 'updatedAt'>,
  creatorEmail: string
): Promise<ClubEvent | null> {
  try {
    const newDocRef = doc(collection(db, EVENTS_COLLECTION));
    const nowIso = new Date().toISOString();

    const newEvent: ClubEvent = {
      id: newDocRef.id,
      name: eventData.name.trim(),
      description: eventData.description.trim(),
      venue: eventData.venue?.trim() || 'TBA',
      eventDate: eventData.eventDate.trim(),
      eventTime: eventData.eventTime?.trim() || '',
      eventType: eventData.eventType || 'Other',
      registrationLink: eventData.registrationLink?.trim() || '',
      status: eventData.status || 'upcoming',
      bannerUrl: eventData.bannerUrl?.trim() || '',
      createdBy: creatorEmail,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await setDoc(newDocRef, newEvent);
    return newEvent;
  } catch (err) {
    console.error('Error creating club event:', err);
    return null;
  }
}

/**
 * Update an existing event in Firestore (instantly reflected on vrgc.live)
 */
export async function updateClubEvent(
  eventId: string,
  updates: Partial<Omit<ClubEvent, 'id' | 'createdAt'>>
): Promise<boolean> {
  try {
    const docRef = doc(db, EVENTS_COLLECTION, eventId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.error('Error updating club event:', err);
    return false;
  }
}

/**
 * Delete an event from Firestore (instantly removed from vrgc.live)
 */
export async function deleteClubEvent(eventId: string): Promise<boolean> {
  try {
    const docRef = doc(db, EVENTS_COLLECTION, eventId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error('Error deleting club event:', err);
    return false;
  }
}
