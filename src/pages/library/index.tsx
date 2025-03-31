'use client';

import { useState, useEffect } from 'react';
import { Eye, Upload, Search, MoreVertical, FileBox, Image as ImageIcon, FileText, Box } from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Asset, AssetType } from '@/types/asset';

// Utility function for formatting file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function LibraryPage() {
    const { toast } = useToast();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<Set<AssetType>>(new Set()); // Removed default filter
    const [sortBy, setSortBy] = useState<'uploadDate' | 'name' | 'size'>('uploadDate');
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [newName, setNewName] = useState('');
  
  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const response = await fetch('/api/assets');
      if (!response.ok) throw new Error('Failed to fetch assets');
      const data = await response.json();
      setAssets(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load assets",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    const file = files[0];
    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "File size exceeds 50MB limit. Please choose a smaller file.",
        variant: "destructive",
      });
      event.target.value = '';
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/assets', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload asset');
      }
      
      const newAsset = await response.json();
      setAssets(prev => [newAsset, ...prev]);
      
      toast({
        title: "Success",
        description: "Asset uploaded successfully",
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload asset. Please try again.",
        variant: "destructive",
      });
    } finally {
      event.target.value = '';
    }
  };

  const handleRename = async () => {
    if (!selectedAsset || !newName.trim()) return;

    try {
      const response = await fetch(`/api/assets/${selectedAsset._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });

      if (!response.ok) throw new Error('Failed to rename asset');

      setAssets(prev => prev.map(asset => 
        asset._id === selectedAsset._id ? { ...asset, name: newName } : asset
      ));

      setIsRenameDialogOpen(false);
      toast({
        title: "Success",
        description: "Asset renamed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to rename asset",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (assetId: string) => {
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete asset');

      setAssets(prev => prev.filter(asset => asset._id !== assetId));
      toast({
        title: "Success",
        description: "Asset deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete asset",
        variant: "destructive",
      });
    }
  };

  const filteredAssets = assets
    .filter(asset => 
      (selectedTypes.size === 0 || selectedTypes.has(asset.type)) &&
      asset.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return b.size - a.size;
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    const handleViewAsset = async (asset: Asset) => {
        if (asset.type === '3D Objects') {
          toast({
            title: "Info",
            description: "3D objects can only be viewed in the scene editor",
          });
          return;
        }
    
        try {
          const response = await fetch(`/api/assets/${asset._id}/access`);
          if (!response.ok) throw new Error('Failed to get asset access');
          
          const { url } = await response.json();
          window.open(url, '_blank');
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to open asset",
            variant: "destructive",
          });
        }
      };
    
      // Helper function to get the appropriate icon for each asset type
      const getAssetIcon = (type: AssetType) => {
        switch (type) {
          case '3D Objects':
            return <Box className="h-12 w-12 text-blue-400" />;
          case 'Images':
            return <ImageIcon className="h-12 w-12 text-green-400" />;
          case 'RAG Documents':
            return <FileText className="h-12 w-12 text-purple-400" />;
          default:
            return <FileBox className="h-12 w-12 text-gray-400" />;
        }
      };
    

  return (
    <div className=" space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Asset Library</h1>
        <div>
          <input
            type="file"
            id="fileUpload"
            className="hidden"
            onChange={handleUpload}
          />
          <Button onClick={() => document.getElementById('fileUpload')?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex space-x-6">
        <div className="w-64">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Filter</h3>
              <div className="space-y-2">
                {['3D Objects', 'Images', 'RAG Documents'].map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={type}
                      checked={selectedTypes.has(type as AssetType)}
                      onCheckedChange={(checked) => {
                        const newTypes = new Set(selectedTypes);
                        if (checked) {
                          newTypes.add(type as AssetType);
                        } else {
                          newTypes.delete(type as AssetType);
                        }
                        setSelectedTypes(newTypes);
                      }}
                    />
                    <Label htmlFor={type}>{type}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Sort</h3>
              <div className="space-y-2">
                {[
                  { value: 'uploadDate', label: 'Upload Date' },
                  { value: 'name', label: 'Name' },
                  { value: 'size', label: 'Size' },
                ].map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={option.value}
                      name="sort"
                      value={option.value}
                      checked={sortBy === option.value}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                      className="rounded-full"
                    />
                    <Label htmlFor={option.value}>{option.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1">
          {/* Search */}
          <div className="mb-4">
            <Input
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
              prefix={<Search className="h-4 w-4 text-gray-400" />}
            />
          </div>

          {/* Assets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {filteredAssets.map((asset) => (
  <div
    key={asset._id}
    className="relative group border rounded-lg p-4 hover:shadow-md transition-shadow"
  >
    <div className="relative"> {/* Added container for preview and overlay */}
      <div 
        className="aspect-square bg-gray-50 rounded-md flex items-center justify-center mb-2"
      >
        {getAssetIcon(asset.type)}
        {asset.type !== '3D Objects' && (
          <button
            onClick={() => handleViewAsset(asset)}
            className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/5 transition-colors"
          >
            <Eye className="opacity-0 group-hover:opacity-100 text-gray-700 h-6 w-6 transition-opacity" />
          </button>
        )}
      </div>
    </div>
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{asset.name}</p>
        <p className="text-xs text-gray-500">{formatFileSize(asset.size)}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {asset.type !== '3D Objects' && (
            <>
              <DropdownMenuItem onClick={() => handleViewAsset(asset)}>
                View
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onClick={() => {
              setSelectedAsset(asset);
              setNewName(asset.name);
              setIsRenameDialogOpen(true);
            }}
          >
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600"
            onClick={() => handleDelete(asset._id)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
))}
      </div>
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Asset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter new name"
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsRenameDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleRename}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}