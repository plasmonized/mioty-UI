import { Loader2 } from "lucide-react";

interface LoadingOverlayProps {
  isVisible: boolean;
  text?: string;
}

export default function LoadingOverlay({ isVisible, text = "Processing..." }: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      data-testid="loading-overlay"
    >
      <div className="bg-card rounded-lg border border-border p-6 flex items-center space-x-4 shadow-lg">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-card-foreground font-medium" data-testid="loading-text">
          {text}
        </span>
      </div>
    </div>
  );
}
