import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface FactoryResetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowLoading: (text: string) => void;
  onHideLoading: () => void;
  onShowToast: (title: string, description: string, variant?: "default" | "destructive") => void;
}

export default function FactoryResetModal({
  open,
  onOpenChange,
  onShowLoading,
  onHideLoading,
  onShowToast,
}: FactoryResetModalProps) {
  const queryClient = useQueryClient();

  const factoryResetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/base-station/factory-reset"),
    onMutate: () => {
      onOpenChange(false);
      onShowLoading("Performing factory reset...");
    },
    onSuccess: () => {
      onHideLoading();
      onShowToast("Success", "Factory reset completed successfully");
      // Invalidate all queries to refresh the data
      queryClient.invalidateQueries();
    },
    onError: () => {
      onHideLoading();
      onShowToast("Error", "Failed to perform factory reset", "destructive");
    },
  });

  const handleConfirm = () => {
    factoryResetMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="factory-reset-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span>Factory Reset</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will reset all base station parameters to factory defaults and restore original certificates. 
            This action cannot be undone.
          </p>
          
          <div className="flex space-x-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-factory-reset"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleConfirm}
              disabled={factoryResetMutation.isPending}
              data-testid="button-confirm-factory-reset"
            >
              Reset to Factory
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
