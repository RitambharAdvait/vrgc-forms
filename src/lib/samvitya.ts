import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { SamvityaPassHolder, GeneratedGtaTicket } from '@/types/samvitya';

export const SAMVITYA_BUYERS_COLLECTION = 'samvitya_passholders';
export const GTA6_TICKETS_COLLECTION = 'gta6_event_tickets';

// ── Passholders / VTOP Whitelist ─────────────────────────────────────────────

export function subscribeToPassholders(
  onUpdate: (passholders: SamvityaPassHolder[]) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const q = query(collection(db, SAMVITYA_BUYERS_COLLECTION));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: SamvityaPassHolder[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<SamvityaPassHolder, 'id'>),
        }));
        onUpdate(list);
      },
      (err) => {
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    if (onError) onError(err);
    return () => {};
  }
}

export async function addPassholder(
  passholder: Omit<SamvityaPassHolder, 'id'>,
  adminEmail: string
): Promise<boolean> {
  try {
    const cleanEmail = passholder.email.trim().toLowerCase();
    const docId = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
    const docRef = doc(db, SAMVITYA_BUYERS_COLLECTION, docId);

    await setDoc(docRef, {
      ...passholder,
      email: cleanEmail,
      regNumber: (passholder.regNumber || '').trim().toUpperCase(),
      name: passholder.name.trim(),
      vtopTransactionId: (passholder.vtopTransactionId || 'VTOP-MANUAL').trim(),
      importedAt: new Date().toISOString(),
      importedBy: adminEmail,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('Failed to add passholder:', err);
    return false;
  }
}

export async function deletePassholder(id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, SAMVITYA_BUYERS_COLLECTION, id));
    return true;
  } catch (err) {
    console.error('Failed to delete passholder:', err);
    return false;
  }
}

export async function bulkImportPassholders(
  passholders: Array<Omit<SamvityaPassHolder, 'id'>>,
  adminEmail: string
): Promise<{ added: number; failed: number }> {
  let added = 0;
  let failed = 0;

  // Process in chunks of 450 (Firestore batch limit is 500)
  const chunkSize = 400;
  for (let i = 0; i < passholders.length; i += chunkSize) {
    const chunk = passholders.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    chunk.forEach((p) => {
      const cleanEmail = (p.email || '').trim().toLowerCase();
      if (!cleanEmail) {
        failed++;
        return;
      }
      const docId = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
      const docRef = doc(db, SAMVITYA_BUYERS_COLLECTION, docId);
      batch.set(docRef, {
        email: cleanEmail,
        name: (p.name || 'Participant').trim(),
        regNumber: (p.regNumber || '').trim().toUpperCase(),
        vtopTransactionId: (p.vtopTransactionId || 'VTOP-BULK').trim(),
        passType: p.passType || 'SAMVITYA_FEST_PASS',
        importedAt: new Date().toISOString(),
        importedBy: adminEmail,
        updatedAt: serverTimestamp(),
      });
      added++;
    });

    try {
      await batch.commit();
    } catch (err) {
      console.error('Batch commit failed:', err);
      failed += chunk.length;
      added -= chunk.length;
    }
  }

  return { added, failed };
}

// ── GTA 6 Issued Tickets & Venue Check-In ────────────────────────────────────

export function subscribeToGtaTickets(
  onUpdate: (tickets: GeneratedGtaTicket[]) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const q = query(collection(db, GTA6_TICKETS_COLLECTION));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: GeneratedGtaTicket[] = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as GeneratedGtaTicket),
          ticketId: docSnap.id,
        }));
        onUpdate(list);
      },
      (err) => {
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    if (onError) onError(err);
    return () => {};
  }
}

export async function verifyAndAdmitTicket(
  ticketQueryStr: string,
  crewEmail: string
): Promise<{
  success: boolean;
  ticket?: GeneratedGtaTicket;
  alreadyAdmitted?: boolean;
  message: string;
}> {
  const cleanQuery = ticketQueryStr.trim();
  if (!cleanQuery) {
    return { success: false, message: 'Please enter or scan a valid Ticket ID or Verification Code.' };
  }

  try {
    // 1. Direct doc lookup by ticketId
    const directRef = doc(db, GTA6_TICKETS_COLLECTION, cleanQuery);
    const ticketsCol = collection(db, GTA6_TICKETS_COLLECTION);

    // Try finding by ticketId first
    let foundDoc: any = null;
    const directSnap = await getDocs(query(ticketsCol, where('ticketId', '==', cleanQuery)));

    if (!directSnap.empty) {
      foundDoc = directSnap.docs[0];
    } else {
      // Try finding by verificationCode (e.g. VCPD-123456)
      const codeSnap = await getDocs(query(ticketsCol, where('verificationCode', '==', cleanQuery.toUpperCase())));
      if (!codeSnap.empty) {
        foundDoc = codeSnap.docs[0];
      } else {
        // Try finding by student regNumber
        const regSnap = await getDocs(query(ticketsCol, where('regNumber', '==', cleanQuery.toUpperCase())));
        if (!regSnap.empty) {
          foundDoc = regSnap.docs[0];
        }
      }
    }

    if (!foundDoc) {
      return {
        success: false,
        message: `No GTA 6 ticket found matching "${cleanQuery}". Confirm attendee has claimed on vrgc.live.`,
      };
    }

    const ticketData = foundDoc.data() as GeneratedGtaTicket;

    if (ticketData.verifiedAtVenue) {
      return {
        success: false,
        alreadyAdmitted: true,
        ticket: ticketData,
        message: `⚠️ ALREADY ADMITTED! This pass was scanned on ${ticketData.admittedAt ? new Date(ticketData.admittedAt).toLocaleTimeString() : 'earlier'} by ${ticketData.admittedBy || 'crew'}.`,
      };
    }

    // Mark as admitted
    const updatePayload = {
      verifiedAtVenue: true,
      admittedAt: new Date().toISOString(),
      admittedBy: crewEmail,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, GTA6_TICKETS_COLLECTION, foundDoc.id), updatePayload);

    return {
      success: true,
      ticket: { ...ticketData, ...updatePayload },
      message: `✓ ADMITTED: ${ticketData.userName} (${ticketData.regNumber}) admitted to GTA VI Arena!`,
    };
  } catch (err: any) {
    console.error('Error admitting ticket:', err);
    return {
      success: false,
      message: `Error verifying ticket: ${err.message || 'Firestore query failed'}`,
    };
  }
}
