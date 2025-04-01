import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetCard } from '../../components/asset/asset-card';
import { ActivityForm } from '../../components/activity/activity-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe('Frontend Components', () => {
  describe('AssetCard', () => {
    const mockAsset = {
      id: 'test-asset-1',
      name: 'Test Asset',
      type: '3d',
      path: '/test/path',
      organizationId: 'org-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should render asset information correctly', () => {
      render(<AssetCard asset={mockAsset} />);
      
      expect(screen.getByText('Test Asset')).toBeInTheDocument();
      expect(screen.getByText('3D Model')).toBeInTheDocument();
    });

    it('should handle delete action', () => {
      const onDelete = vi.fn();
      render(<AssetCard asset={mockAsset} onDelete={onDelete} />);
      
      fireEvent.click(screen.getByRole('button', { name: /delete/i }));
      expect(onDelete).toHaveBeenCalledWith(mockAsset.id);
    });
  });

  describe('ActivityForm', () => {
    it('should handle form submission', async () => {
      const onSubmit = vi.fn();
      render(<ActivityForm onSubmit={onSubmit} />);
      
      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: 'New Activity' },
      });
      
      fireEvent.change(screen.getByLabelText(/description/i), {
        target: { value: 'Test Description' },
      });
      
      fireEvent.click(screen.getByRole('button', { name: /create/i }));
      
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'New Activity',
        description: 'Test Description',
      });
    });

    it('should validate required fields', async () => {
      const onSubmit = vi.fn();
      render(<ActivityForm onSubmit={onSubmit} />);
      
      fireEvent.click(screen.getByRole('button', { name: /create/i }));
      
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
}); 