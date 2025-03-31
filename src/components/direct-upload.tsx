'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface DirectUploadProps {
  onUploadComplete: (fileUrl: string, fileName: string) => Promise<void> | void;
  accept?: string;
  label?: string;
  maxSize?: number; // in bytes
}

export function DirectUpload({ 
  onUploadComplete, 
  accept = '*', 
  label = 'Upload File',
  maxSize = 50 * 1024 * 1024 // 50MB default
}: DirectUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const inputId = `direct-upload-${Math.random().toString(36).substr(2, 9)}`;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: `File size exceeds ${maxSize / (1024 * 1024)}MB limit. Please choose a smaller file.`,
        variant: "destructive",
      });
      e.target.value = '';
      return;
    }

    try {
      setIsUploading(true);

      // Get pre-signed URL
      const presignedResponse = await fetch('/api/upload/presigned-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      });

      if (!presignedResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, key, publicUrl } = await presignedResponse.json();

      // Upload directly to COS
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      // Call the completion handler with the public URL from the server
      await onUploadComplete(publicUrl, file.name);

      toast({
        title: "Success",
        description: "File uploaded successfully",
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
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
        Maximum file size: {maxSize / (1024 * 1024)}MB
      </p>
    </div>
  );
} 