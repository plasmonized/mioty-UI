import { useState } from "react";
import { Key, Copy, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface Credentials {
  username: string;
  password: string;
  note: string;
}

interface CredentialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CredentialsModal({
  open,
  onOpenChange,
}: CredentialsModalProps) {
  const { toast } = useToast();

  const { data: credentials } = useQuery<Credentials>({
    queryKey: ["/api/credentials"],
    enabled: open,
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Success",
        description: "Copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="credentials-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <Key className="h-5 w-5" />
              <span>Default Credentials</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-credentials"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <div className="flex items-center space-x-2 mt-1">
              <Input
                id="username"
                value={credentials?.username || "root"}
                readOnly
                className="font-mono bg-muted"
                data-testid="input-username"
              />
              <Button
                variant="secondary"
                size="icon"
                onClick={() => copyToClipboard(credentials?.username || "root")}
                data-testid="button-copy-username"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div>
            <Label htmlFor="password">Password (based on uniqueBaseStationId)</Label>
            <div className="flex items-center space-x-2 mt-1">
              <Input
                id="password"
                value={credentials?.password || "00-80-E1-01-02-03"}
                readOnly
                className="font-mono bg-muted"
                data-testid="input-password"
              />
              <Button
                variant="secondary"
                size="icon"
                onClick={() => copyToClipboard(credentials?.password || "00-80-E1-01-02-03")}
                data-testid="button-copy-password"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-start space-x-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>{credentials?.note || "Password is derived from the first 6 bytes of the unique base station ID"}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
