import { SqliteCollection } from './db';
import { v4 as uuidv4 } from 'uuid';

export interface PairingCode {
  _id?: string;
  code: string;
  orgId: string;
  createdAt: number;
  expiresAt: number;
  isActive: boolean;
}

const pairingCollection = new SqliteCollection<PairingCode>('pairing_codes');

export function generatePairingCode(orgId: string): PairingCode {
  // Generate a 6-character code
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  const pairingCode: PairingCode = {
    code,
    orgId,
    createdAt: Date.now(),
    expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours from now
    isActive: true
  };

  // Note: this is now async but we're keeping the sync interface for compatibility
  pairingCollection.insertOne(pairingCode);
  return pairingCode;
}

export async function validatePairingCode(code: string): Promise<PairingCode | null> {
  const now = Date.now();
  const pairingCode = await pairingCollection.findOne({ 
    code,
    isActive: true
  });

  if (!pairingCode || pairingCode.expiresAt <= now) {
    return null;
  }

  return pairingCode;
}

export async function getOrgIdFromPairingCode(code: string): Promise<string | null> {
  const pairingCode = await validatePairingCode(code);
  return pairingCode?.orgId || null;
} 