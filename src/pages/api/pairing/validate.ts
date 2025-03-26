import { NextApiRequest, NextApiResponse } from 'next';
import { getOrgIdFromPairingCode } from '../../../lib/pairing';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Invalid code' });
    }

    const orgId = getOrgIdFromPairingCode(code);
    
    if (!orgId) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    return res.status(200).json({ orgId });
  } catch (error) {
    console.error('Error validating pairing code:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 