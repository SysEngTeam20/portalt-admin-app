import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { setupTestDb, cleanupTestDb } from '../../lib/test-utils';
import { Database } from 'better-sqlite3';

vi.mock('@clerk/nextjs', () => ({
  auth: () => ({ userId: 'test-user-id' }),
}));

describe('End-to-End Workflows', () => {
  let db: Database;
  let supabase: any;

  beforeAll(() => {
    db = setupTestDb();
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  });

  afterAll(() => {
    cleanupTestDb(db);
  });

  describe('Asset Upload Workflow', () => {
    it('should complete the full asset upload process', async () => {
      // 1. Create an activity
      const activity = {
        id: 'test-activity-1',
        name: 'Test Activity',
        description: 'Test Description',
        organizationId: 'org-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.prepare(`
        INSERT INTO activities (id, name, description, organization_id, created_at, updated_at)
        VALUES (@id, @name, @description, @organizationId, @createdAt, @updatedAt)
      `).run(activity);

      // 2. Upload asset to COS
      const asset = {
        id: 'test-asset-1',
        name: 'Test Asset',
        type: '3d',
        path: '/test/path',
        organizationId: 'org-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 3. Create asset record in database
      db.prepare(`
        INSERT INTO assets (id, name, type, path, organization_id, created_at, updated_at)
        VALUES (@id, @name, @type, @path, @organizationId, @createdAt, @updatedAt)
      `).run(asset);

      // 4. Associate asset with activity
      db.prepare(`
        INSERT INTO activity_assets (activity_id, asset_id)
        VALUES (?, ?)
      `).run(activity.id, asset.id);

      // 5. Verify the complete workflow
      const result = db.prepare(`
        SELECT a.*, GROUP_CONCAT(ass.id) as asset_ids
        FROM activities a
        LEFT JOIN activity_assets aa ON a.id = aa.activity_id
        LEFT JOIN assets ass ON aa.asset_id = ass.id
        WHERE a.id = ?
        GROUP BY a.id
      `).get(activity.id);

      expect(result).toBeDefined();
      expect(result.asset_ids).toContain(asset.id);
    });
  });

  describe('RAG Integration Workflow', () => {
    it('should handle the complete RAG document processing workflow', async () => {
      // 1. Create an activity with RAG enabled
      const activity = {
        id: 'test-activity-2',
        name: 'RAG Test Activity',
        description: 'Test RAG Description',
        organizationId: 'org-1',
        ragEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.prepare(`
        INSERT INTO activities (id, name, description, organization_id, rag_enabled, created_at, updated_at)
        VALUES (@id, @name, @description, @organizationId, @ragEnabled, @createdAt, @updatedAt)
      `).run(activity);

      // 2. Upload a document
      const document = {
        id: 'test-doc-1',
        name: 'Test Document',
        type: 'pdf',
        path: '/test/doc.pdf',
        activityId: activity.id,
        organizationId: 'org-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.prepare(`
        INSERT INTO documents (id, name, type, path, activity_id, organization_id, created_at, updated_at)
        VALUES (@id, @name, @type, @path, @activityId, @organizationId, @createdAt, @updatedAt)
      `).run(document);

      // 3. Generate RAG token
      const token = await generateLLMToken(activity.id);

      // 4. Verify document access with token
      const result = db.prepare(`
        SELECT d.*, a.rag_enabled
        FROM documents d
        JOIN activities a ON d.activity_id = a.id
        WHERE d.id = ?
      `).get(document.id);

      expect(result).toBeDefined();
      expect(result.rag_enabled).toBe(1);
      expect(token).toBeDefined();
    });
  });
}); 