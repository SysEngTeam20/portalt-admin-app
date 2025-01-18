'use client';

import { useState } from 'react';
import { Plus, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Activity } from '@/types/activity';

interface RagPanelProps {
  activity: Activity;
}

export function RagPanel({ activity }: RagPanelProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [documents, setDocuments] = useState<{ id: string; name: string }[]>([
    { id: '1', name: 'document1.pdf' },
    { id: '2', name: 'document2.pdf' },
  ]);

  const handleFileUpload = () => {
    // Implement file upload logic
  };

  const handleDelete = (id: string) => {
    setDocuments(documents.filter(doc => doc.id !== id));
  };

  return (
    <Card className="bg-white border-gray-200 p-6 shadow-sm">
      <div className="space-y-8">
        {/* RAG Enable Switch */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="space-y-1">
            <h3 className="text-lg font-medium text-gray-900">Enable RAG on activity</h3>
            <p className="text-sm text-gray-500">
              Enable participants to interact with your documents via a chatbot.
            </p>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
        </div>

        {/* Source Documents */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Source Documents</h3>
            <Button 
              onClick={handleFileUpload}
              variant="outline" 
              size="sm"
              className="text-gray-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>

          <div className="grid gap-4">
            {documents.map((doc) => (
              <div 
                key={doc.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-600">{doc.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(doc.id)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}