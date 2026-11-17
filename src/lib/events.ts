import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { ClubEvent } from '@/types/events';

// Isolated collection reference strictly for public events
export const EVENTS_COLLECTION = 'events';

/**
 * Subscribes in real-time to the public events collection.
 * Completely isolated from any other club collections.
 */
export function subscribeToEvents(
  callback: (events: ClubEvent[]) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const eventsRef = collection(db, EVENTS_COLLECTION);
    const q = query(eventsRef, orderBy('eventDate', 'asc'));

    const unsubscribe = onSnapshot(
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
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || '',
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || '',
          });
        });
        callback(list);
      },
      (err) => {
        console.warn('Real-time listener on events collection warning:', err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err: any) {
    console.error('Failed to initialize events listener:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Creates a new event in the Firestore events collection.
 */
export async function createEvent(
  eventData: Omit<ClubEvent, 'id' | 'createdAt' | 'updatedAt'>,
  userEmail?: string
): Promise<string> {
  const eventsRef = collection(db, EVENTS_COLLECTION);
  const payload = {
    name: eventData.name.trim(),
    description: eventData.description.trim(),
    venue: eventData.venue.trim(),
    eventDate: eventData.eventDate,
    eventTime: eventData.eventTime?.trim() || '',
    eventType: eventData.eventType,
    registrationLink: eventData.registrationLink.trim(),
    status: eventData.status || 'upcoming',
    bannerUrl: eventData.bannerUrl || '',
    createdBy: userEmail || 'admin',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(eventsRef, payload);
  return docRef.id;
}

/**
 * Updates an existing event document in the Firestore events collection.
 */
export async function updateEvent(
  eventId: string,
  eventData: Partial<ClubEvent>
): Promise<void> {
  if (!eventId) throw new Error('Missing eventId for update operation');
  const eventDocRef = doc(db, EVENTS_COLLECTION, eventId);

  const cleanPayload: Record<string, any> = {
    updatedAt: serverTimestamp(),
  };

  if (eventData.name !== undefined) cleanPayload.name = eventData.name.trim();
  if (eventData.description !== undefined) cleanPayload.description = eventData.description.trim();
  if (eventData.venue !== undefined) cleanPayload.venue = eventData.venue.trim();
  if (eventData.eventDate !== undefined) cleanPayload.eventDate = eventData.eventDate;
  if (eventData.eventTime !== undefined) cleanPayload.eventTime = eventData.eventTime.trim();
  if (eventData.eventType !== undefined) cleanPayload.eventType = eventData.eventType;
  if (eventData.registrationLink !== undefined) cleanPayload.registrationLink = eventData.registrationLink.trim();
  if (eventData.status !== undefined) cleanPayload.status = eventData.status;
  if (eventData.bannerUrl !== undefined) cleanPayload.bannerUrl = eventData.bannerUrl;

  await updateDoc(eventDocRef, cleanPayload);
}

/**
 * Deletes an event document from the Firestore events collection.
 */
export async function deleteEvent(eventId: string): Promise<void> {
  if (!eventId) throw new Error('Missing eventId for delete operation');
  const eventDocRef = doc(db, EVENTS_COLLECTION, eventId);
  await deleteDoc(eventDocRef);
}
