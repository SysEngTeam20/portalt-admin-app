'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, FileText, Trash2, Upload, Library } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity } from '@/types/activity';
import { Document } from '@/types/document';

interface RagPanelProps {
  activity: Activity;
}

export function RagPanel({ activity }: RagPanelProps) {
  const { toast } = useToast();
  const [isEnabled, setIsEnabled] = useState(activity.ragEnabled);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [libraryDocuments, setLibraryDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
    fetchLibraryDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/documents?activityId=${activity._id}`);
      if (!response.ok) throw new Error('Failed to fetch documents');
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load documents",
        variant: "destructive",
      });
    }
  };

  const fetchLibraryDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      if (!response.ok) throw new Error('Failed to fetch library');
      const data = await response.json();
      setLibraryDocuments(data);
      setIsLoading(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load asset library",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleRagToggle = async (enabled: boolean) => {
    try {
      const response = await fetch(`/api/activities/${activity._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activity.title,
          description: activity.description,
          bannerUrl: activity.bannerUrl,
          format: activity.format,
          platform: activity.platform,
          ragEnabled: enabled,
        }),
      });

      if (!response.ok) throw new Error('Failed to update RAG setting');
      setIsEnabled(enabled);
      toast({
        title: "Success",
        description: `RAG ${enabled ? 'enabled' : 'disabled'} successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update RAG setting",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('activityId', activity._id);

      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload document');
      
      const newDocument = await response.json();
      setDocuments([...documents, newDocument]);
      await fetchLibraryDocuments();
      setDialogOpen(false);

      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload document",
        variant: "destructive",
      });
    }
  };

  const handleLibrarySelect = async (document: Document) => {
    try {
      const response = await fetch(`/api/documents/${document._id}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId: activity._id }),
      });

      if (!response.ok) throw new Error('Failed to link document');
      await fetchDocuments();
      setDialogOpen(false);

      toast({
        title: "Success",
        description: "Document linked successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to link document",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/unlink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId: activity._id }),
      });

      if (!response.ok) throw new Error('Failed to unlink document');
      await fetchDocuments();

      toast({
        title: "Success",
        description: "Document removed from activity",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove document",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-8">
        {/* RAG Enable Switch */}
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="space-y-1">
            <h3 className="text-lg font-medium">Enable RAG on activity</h3>
            <p className="text-sm text-gray-500">
              Enable participants to interact with your documents via a chatbot.
            </p>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={handleRagToggle}
          />
        </div>

        {/* Source Documents */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Source Documents</h3>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Document</DialogTitle>
                  <DialogDescription>
                    Choose how you want to add a document
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  {/* Upload Option */}
                  <Button
                    variant="outline"
                    className="h-32 flex flex-col items-center justify-center gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8" />
                    <span>Upload New</span>
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileUpload}
                  />

                  {/* Select from Library Option */}
                  <Button
                    variant="outline"
                    className="h-32 flex flex-col items-center justify-center gap-2"
                    onClick={() => setDialogOpen(true)}
                  >
                    <Library className="h-8 w-8" />
                    <span>Select from Library</span>
                  </Button>
                </div>

                {/* Library Documents List */}
                {dialogOpen && (
                  <ScrollArea className="h-72 mt-4">
                    <div className="space-y-2">
                      {libraryDocuments.map((doc) => (
                        <div
                          key={doc._id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
                          onClick={() => handleLibrarySelect(doc)}
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-gray-400" />
                            <span>{doc.filename}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {/* Documents List */}
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc._id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <span>{doc.filename}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(doc._id)}
                  className="text-gray-400 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {documents.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No documents added yet
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}