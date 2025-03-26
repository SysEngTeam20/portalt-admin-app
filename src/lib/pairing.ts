import { Collection } from './db';
import { v4 as uuidv4 } from 'uuid';

export interface PairingCode {
  _id?: string;
  code: string;
  orgId: string;
  createdAt: number;
  expiresAt: number;
  isActive: boolean;
}

const pairingCollection = new Collection<PairingCode>('pairing_codes');

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

  pairingCollection.insertOne(pairingCode);
  return pairingCode;
}

export function validatePairingCode(code: string): PairingCode | null {
  const now = Date.now();
  const pairingCode = pairingCollection.findOne({ 
    code,
    isActive: true
  });

  if (!pairingCode || pairingCode.expiresAt <= now) {
    return null;
  }

  return pairingCode;
}

export function getOrgIdFromPairingCode(code: string): string | null {
  const pairingCode = validatePairingCode(code);
  return pairingCode?.orgId || null;
} 