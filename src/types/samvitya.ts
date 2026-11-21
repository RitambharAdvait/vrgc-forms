export interface SamvityaPassHolder {
  id?: string;
  email: string;
  name: string;
  regNumber: string;
  vtopTransactionId?: string;
  passType: 'SAMVITYA_FEST_PASS' | 'VIP_ALL_ACCESS' | string;
  importedAt?: string;
  importedBy?: string;
}

export interface GeneratedGtaTicket {
  ticketId: string;
  userEmail: string;
  userName: string;
  regNumber: string;
  vtopTransactionId: string;
  eventTitle: string;
  venue: string;
  issuedAt: string;
  slotTime: string;
  category: string;
  qrPayload: string;
  verificationCode: string;
  verifiedAtVenue?: boolean;
  admittedAt?: string;
  admittedBy?: string;
}
