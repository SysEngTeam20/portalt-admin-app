import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  activityId: string;
}

export function PairingModal({ isOpen, onClose, activityId }: PairingModalProps) {
  const [code, setCode] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const generateCode = async () => {
    try {
      const response = await fetch('/api/pairing/generate', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to generate code');
      const data = await response.json();
      setCode(data.code);
    } catch (error) {
      console.error('Error generating code:', error);
    }
  };

  const copyToClipboard = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pair Activity Editor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-gray-500">
            Enter this code in your Activity Editor to pair it with this activity.
          </p>
          {!code ? (
            <Button onClick={generateCode} className="w-full">
              Generate Code
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 p-2 bg-gray-100 rounded-md font-mono text-center">
                  {code}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyToClipboard}
                  className="shrink-0"
                >
                  {isCopied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="text-sm text-gray-500 space-y-2">
                <p>In your Unity Editor:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Enter this code in the pairing dialog</li>
                  <li>The editor will be paired with your organization for the next 24 hours</li>
                  <li>You will then be able to use the editor for any of your organization's activities</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 