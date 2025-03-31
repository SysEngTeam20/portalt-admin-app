'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  onUpload: (file: File) => Promise<void> | void;
  accept?: string;
  label?: string;
}

export function FileUpload({ onUpload, accept = '*', label = 'Upload File' }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const inputId = `file-upload-${Math.random().toString(36).substr(2, 9)}`;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "File size exceeds 50MB limit. Please choose a smaller file.",
        variant: "destructive",
      });
      e.target.value = '';
      return;
    }

    try {
      setIsUploading(true);
      await onUpload(file);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset input to allow same file selection again
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Input
        id={inputId}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={isUploading}
      />
      <label htmlFor={inputId} className="w-full">
        <Button
          variant="outline"
          className="w-full flex gap-2"
          asChild
          disabled={isUploading}
        >
          <div>
            <Upload className="h-4 w-4" />
            {isUploading ? 'Uploading...' : label}
          </div>
        </Button>
      </label>
      <p className="text-xs text-muted-foreground text-center">
        Maximum file size: 50MB
      </p>
    </div>
  );
} 