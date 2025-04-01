import { SqliteCollection } from './db';
import { v4 as uuidv4 } from 'uuid';
import { isUsingMongo } from './db';

export interface PairingCode {
  _id?: string;
  code: string;
  orgId: string;
  createdAt: string | Date;  // Can be either string (SQLite) or Date (MongoDB)
  expiresAt: string | Date;  // Can be either string (SQLite) or Date (MongoDB)
  isActive: boolean;
}

const pairingCollection = new SqliteCollection<PairingCode>('pairing_codes');

export function generatePairingCode(orgId: string): PairingCode {
  // Generate a 6-character code
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours from now

  const pairingCode: PairingCode = {
    code,
    orgId,
    createdAt: isUsingMongo() ? now : now.toISOString(),
    expiresAt: isUsingMongo() ? expiresAt : expiresAt.toISOString(),
    isActive: true
  };

  console.log("[PAIRING] Generated code:", {
    code,
    orgId,
    createdAt: isUsingMongo() ? pairingCode.createdAt : (pairingCode.createdAt as string),
    expiresAt: isUsingMongo() ? pairingCode.expiresAt : (pairingCode.expiresAt as string),
    now: now.toISOString(),
    isMongo: isUsingMongo()
  });

  // Note: this is now async but we're keeping the sync interface for compatibility
  pairingCollection.insertOne(pairingCode);
  return pairingCode;
}

export async function validatePairingCode(code: string): Promise<PairingCode | null> {
  const now = new Date();
  console.log("[PAIRING] Validating code:", {
    code,
    now: now.toISOString(),
    isMongo: isUsingMongo()
  });

  const pairingCode = await pairingCollection.findOne({ 
    code,
    isActive: true
  });

  if (pairingCode) {
    console.log("[PAIRING] Found code:", {
      code: pairingCode.code,
      createdAt: isUsingMongo() ? pairingCode.createdAt : (pairingCode.createdAt as string),
      expiresAt: isUsingMongo() ? pairingCode.expiresAt : (pairingCode.expiresAt as string),
      isActive: pairingCode.isActive,
      isMongo: isUsingMongo()
    });
  }

  if (!pairingCode) {
    console.log("[PAIRING] Code not found");
    return null;
  }

  const expiresAt = isUsingMongo() 
    ? pairingCode.expiresAt as Date 
    : new Date(pairingCode.expiresAt as string);

  if (expiresAt <= now) {
    console.log("[PAIRING] Code expired:", {
      code,
      now: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    });
    return null;
  }

  return pairingCode;
}

export async function getOrgIdFromPairingCode(code: string): Promise<string | null> {
  const pairingCode = await validatePairingCode(code);
  return pairingCode?.orgId || null;
} 