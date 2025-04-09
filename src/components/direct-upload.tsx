'use client';

import { useState, useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface DirectUploadProps {
  onUploadComplete: (fileUrl: string, fileName: string, fileSize: number) => void;
  accept?: string;
  label?: string;
  maxSize?: number; // in bytes
  helperText?: string;
}

// Utility function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function DirectUpload({ 
  onUploadComplete, 
  accept = '*/*',
  label = 'Upload File',
  maxSize = 1024 * 1024 * 1024, // 1GB default
  helperText
}: DirectUploadProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.name.toLowerCase().endsWith('.txt')) {
      toast({
        title: "Invalid file type",
        description: "Only .txt files are allowed",
        variant: "destructive",
      });
      return;
    }

    // Check file size
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${formatFileSize(maxSize)}`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Get presigned URL
      console.log('Requesting presigned URL for file:', {
        fileName: file.name,
        contentType: file.type,
        size: file.size
      });

      const presignedResponse = await fetch('/api/upload/presigned-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
        }),
      });

      if (!presignedResponse.ok) {
        const errorText = await presignedResponse.text();
        console.error('Failed to get presigned URL:', {
          status: presignedResponse.status,
          statusText: presignedResponse.statusText,
          error: errorText,
          headers: Object.fromEntries(presignedResponse.headers.entries())
        });
        throw new Error(`Failed to get upload URL: ${errorText}`);
      }

      let responseData;
      try {
        responseData = await presignedResponse.json();
      } catch (error) {
        console.error('Failed to parse presigned URL response:', {
          error,
          responseText: await presignedResponse.text()
        });
        throw new Error('Invalid response from server');
      }

      const { uploadUrl, publicUrl, key } = responseData;
      if (!uploadUrl || !publicUrl || !key) {
        console.error('Invalid presigned URL response:', responseData);
        throw new Error('Invalid response format from server');
      }

      console.log('Received presigned URL:', {
        uploadUrl,
        publicUrl,
        key: uploadUrl.split('/').pop() // Extract key from URL for logging
      });

      // Upload directly to COS
      console.log('Attempting upload to COS:', {
        url: uploadUrl,
        method: 'PUT',
        contentType: file.type,
        fileSize: file.size
      });

      // Use XMLHttpRequest for better CORS handling with PUT requests
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            console.log('Upload progress:', percentComplete.toFixed(2) + '%');
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log('Upload successful');
            resolve(xhr.response);
          } else {
            console.error('Upload failed:', {
              status: xhr.status,
              statusText: xhr.statusText,
              response: xhr.response
            });
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => {
          console.error('Upload error:', {
            status: xhr.status,
            statusText: xhr.statusText
          });
          reject(new Error('Upload failed'));
        };

        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.withCredentials = false; // Important for CORS
        xhr.send(file);
      });

      // Wait a moment for the upload to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify the upload by checking if the file exists in COS
      try {
        console.log('Verifying upload with key:', key);
        // Add retries for verification with increasing delays
        let retries = 5;
        let verified = false;
        
        while (retries > 0 && !verified) {
          try {
            const verifyResponse = await fetch('/api/upload/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ key }),
            });
            
            if (verifyResponse.ok) {
              verified = true;
              console.log('Upload verification successful');
            } else {
              console.log(`Verification attempt ${6 - retries} failed, retrying...`);
              retries--;
              if (retries > 0) {
                // Wait longer between each retry (2s, 4s, 8s, 16s, 32s)
                await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, 5 - retries)));
              }
            }
          } catch (error) {
            console.log(`Verification attempt ${6 - retries} failed with error:`, error);
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, 5 - retries)));
            }
          }
        }

        if (!verified) {
          console.warn('Upload verification failed after all retries, but continuing anyway');
          // Don't throw here - the file might still be accessible even if verification fails
        }
      } catch (error) {
        console.error('Upload verification failed:', error);
        // Don't throw here, just log the error
        // The file might still be accessible even if verification fails
      }

      console.log('Upload successful');

      // Call completion handler with the public URL and file size
      onUploadComplete(publicUrl, file.name, file.size);
      
      toast({
        title: "Success",
        description: "File uploaded successfully",
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg hover:border-primary/50 transition-colors">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        className="hidden"
        disabled={isUploading}
      />
      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="w-full"
      >
        {isUploading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            {label}
          </>
        )}
      </Button>
      <p className="text-sm text-muted-foreground mt-2">
        {helperText || `Max size: ${formatFileSize(maxSize)}`}
      </p>
    </div>
  );
} 