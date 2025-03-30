import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface JoinCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  activityId: string;
}

export function JoinCodeModal({ isOpen, onClose, activityId }: JoinCodeModalProps) {
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && !joinCode) {
      generateJoinCode();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!expiresAt) return;

    const updateTimeLeft = () => {
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const generateJoinCode = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/activities/${activityId}/join-code`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to generate join code');
      }

      const data = await response.json();
      setJoinCode(data.joinCode);
      setExpiresAt(new Date(data.expiresAt));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate join code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!joinCode) return;
    
    try {
      await navigator.clipboard.writeText(joinCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      
      toast({
        title: "Success",
        description: "Join code copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy join code",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join Activity</DialogTitle>
          <DialogDescription>
            This code is valid for 24 hours. Share it with others to let them join this activity.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating join code...</span>
            </div>
          ) : joinCode ? (
            <>
              <div className="w-full p-4 bg-gray-50 rounded-lg text-center font-mono text-lg">
                {joinCode}
              </div>
              <div className="text-sm text-gray-500">
                Expires in: {timeLeft}
              </div>
              <Button
                onClick={copyToClipboard}
                className="w-full flex items-center justify-center space-x-2"
              >
                {isCopied ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy Code</span>
                  </>
                )}
              </Button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
} 