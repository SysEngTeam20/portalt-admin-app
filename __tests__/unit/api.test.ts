import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMocks } from 'node-mocks-http';
import { GET, POST } from '../../app/api/assets/route';
import { generateLLMToken } from '../../lib/tokens';

vi.mock('../../lib/cos', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://test-signed-url.com'),
  uploadFile: vi.fn().mockResolvedValue({ key: 'test-key' }),
}));

describe('API Routes', () => {
  describe('Assets API', () => {
    it('should return 401 for unauthorized requests', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        headers: {},
      });

      await GET(req);
      expect(res._getStatusCode()).toBe(401);
    });

    it('should return assets for authorized requests', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer test-token',
        },
      });

      await GET(req);
      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(Array.isArray(data)).toBe(true);
    });

    it('should handle file uploads', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token',
        },
        body: {
          file: 'test-file',
          type: 'image',
        },
      });

      await POST(req);
      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.url).toBeDefined();
    });
  });

  describe('RAG API', () => {
    it('should generate valid LLM tokens', async () => {
      const token = await generateLLMToken('test-activity-id');
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should validate LLM tokens', async () => {
      const token = await generateLLMToken('test-activity-id');
      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      await GET(req);
      expect(res._getStatusCode()).toBe(200);
    });
  });
}); 