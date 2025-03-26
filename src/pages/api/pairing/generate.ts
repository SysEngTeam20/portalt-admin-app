import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import { generatePairingCode } from '../../../lib/pairing';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, orgId } = getAuth(req);
    
    if (!userId || !orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const pairingCode = generatePairingCode(orgId);
    
    return res.status(200).json({
      code: pairingCode.code,
      expiresAt: pairingCode.expiresAt
    });
  } catch (error) {
    console.error('Error generating pairing code:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 