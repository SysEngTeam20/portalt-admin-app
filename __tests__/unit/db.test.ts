import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from 'better-sqlite3';
import { setupTestDb, cleanupTestDb } from '../../lib/test-utils';

describe('Database Operations', () => {
  let db: Database;

  beforeEach(() => {
    db = setupTestDb();
  });

  afterEach(() => {
    cleanupTestDb(db);
  });

  describe('Asset Management', () => {
    it('should create a new asset', () => {
      const asset = {
        id: 'test-asset-1',
        name: 'Test Asset',
        type: '3d',
        path: '/test/path',
        organizationId: 'org-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = db.prepare(`
        INSERT INTO assets (id, name, type, path, organization_id, created_at, updated_at)
        VALUES (@id, @name, @type, @path, @organizationId, @createdAt, @updatedAt)
      `).run(asset);

      expect(result.changes).toBe(1);
    });

    it('should retrieve an asset by id', () => {
      const asset = {
        id: 'test-asset-2',
        name: 'Test Asset 2',
        type: 'image',
        path: '/test/path2',
        organizationId: 'org-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.prepare(`
        INSERT INTO assets (id, name, type, path, organization_id, created_at, updated_at)
        VALUES (@id, @name, @type, @path, @organizationId, @createdAt, @updatedAt)
      `).run(asset);

      const result = db.prepare('SELECT * FROM assets WHERE id = ?').get(asset.id);
      expect(result).toEqual(asset);
    });
  });

  describe('Activity Management', () => {
    it('should create a new activity', () => {
      const activity = {
        id: 'test-activity-1',
        name: 'Test Activity',
        description: 'Test Description',
        organizationId: 'org-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = db.prepare(`
        INSERT INTO activities (id, name, description, organization_id, created_at, updated_at)
        VALUES (@id, @name, @description, @organizationId, @createdAt, @updatedAt)
      `).run(activity);

      expect(result.changes).toBe(1);
    });

    it('should associate an asset with an activity', () => {
      const assetId = 'test-asset-3';
      const activityId = 'test-activity-2';

      const result = db.prepare(`
        INSERT INTO activity_assets (activity_id, asset_id)
        VALUES (?, ?)
      `).run(activityId, assetId);

      expect(result.changes).toBe(1);
    });
  });
}); 