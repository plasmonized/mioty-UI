import { Satellite, Play, Square, RotateCcw, ToggleLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMioty } from "@/hooks/use-mioty";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface BaseStationControlProps {
  onShowLoading: (text: string) => void;
  onHideLoading: () => void;
  onShowToast: (title: string, description: string, variant?: "default" | "destructive") => void;
  onShowFactoryReset: () => void;
}

export default function BaseStationControl({ 
  onShowLoading, 
  onHideLoading, 
  onShowToast,
  onShowFactoryReset 
}: BaseStationControlProps) {
  const { baseStationStatus, connection } = useMioty();
  const queryClient = useQueryClient();

  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/base-station/start"),
    onMutate: () => onShowLoading("Starting base station..."),
    onSuccess: () => {
      onHideLoading();
      onShowToast("Success", "Base station started");
      queryClient.invalidateQueries({ queryKey: ["/api/base-station/status"] });
    },
    onError: () => {
      onHideLoading();
      onShowToast("Error", "Failed to start base station", "destructive");
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/base-station/stop"),
    onMutate: () => onShowLoading("Stopping base station..."),
    onSuccess: () => {
      onHideLoading();
      onShowToast("Success", "Base station stopped");
      queryClient.invalidateQueries({ queryKey: ["/api/base-station/status"] });
    },
    onError: () => {
      onHideLoading();
      onShowToast("Error", "Failed to stop base station", "destructive");
    },
  });

  const restartMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/base-station/restart"),
    onMutate: () => onShowLoading("Restarting base station..."),
    onSuccess: () => {
      onHideLoading();
      onShowToast("Success", "Base station restarted");
      queryClient.invalidateQueries({ queryKey: ["/api/base-station/status"] });
    },
    onError: () => {
      onHideLoading();
      onShowToast("Error", "Failed to restart base station", "destructive");
    },
  });

  const toggleAutoStartMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/base-station/toggle-autostart"),
    onMutate: () => onShowLoading("Updating auto-start setting..."),
    onSuccess: () => {
      onHideLoading();
      onShowToast("Success", "Auto-start setting updated");
      queryClient.invalidateQueries({ queryKey: ["/api/base-station/status"] });
    },
    onError: () => {
      onHideLoading();
      onShowToast("Error", "Failed to update auto-start setting", "destructive");
    },
  });

  const handleStart = () => {
    if (connection?.status !== "connected") {
      onShowToast("Error", "Please establish connection first", "destructive");
      return;
    }
    startMutation.mutate();
  };

  const getStatusBadge = () => {
    const status = baseStationStatus?.status || "stopped";
    const variant = status === "running" ? "default" : "secondary";
    const className = status === "running" 
      ? "bg-accent/10 text-accent border-accent/20" 
      : "bg-muted text-muted-foreground";
    
    return (
      <Badge variant={variant} className={className} data-testid="base-station-status">
        <span className={`status-indicator ${status === "running" ? "status-connected" : "status-disconnected"}`} />
        {status === "running" ? "Running" : "Stopped"}
      </Badge>
    );
  };

  const getAutoStartBadge = () => {
    const autoStart = baseStationStatus?.autoStart || false;
    const className = autoStart 
      ? "bg-accent/10 text-accent border-accent/20" 
      : "bg-muted text-muted-foreground";
    
    return (
      <Badge variant={autoStart ? "default" : "secondary"} className={className} data-testid="auto-start-status">
        {autoStart ? "Enabled" : "Disabled"}
      </Badge>
    );
  };

  return (
    <Card data-testid="base-station-control-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Base Station Control</span>
          <Satellite className="h-5 w-5 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Service Status:</span>
            {getStatusBadge()}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Auto-start:</span>
            {getAutoStartBadge()}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={handleStart}
            disabled={startMutation.isPending}
            className="text-sm bg-accent text-accent-foreground hover:bg-accent/90"
            data-testid="button-start-base-station"
          >
            <Play className="h-4 w-4 mr-1" />
            Start
          </Button>
          
          <Button
            variant="destructive"
            onClick={() => stopMutation.mutate()}
            disabled={stopMutation.isPending}
            className="text-sm"
            data-testid="button-stop-base-station"
          >
            <Square className="h-4 w-4 mr-1" />
            Stop
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => restartMutation.mutate()}
            disabled={restartMutation.isPending}
            className="text-sm"
            data-testid="button-restart-base-station"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Restart
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => toggleAutoStartMutation.mutate()}
            disabled={toggleAutoStartMutation.isPending}
            className="text-sm"
            data-testid="button-toggle-auto-start"
          >
            <ToggleLeft className="h-4 w-4 mr-1" />
            Auto
          </Button>
        </div>
        
        <div className="pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={onShowFactoryReset}
            className="w-full text-sm text-destructive border-destructive/20 hover:bg-destructive/10"
            data-testid="button-factory-reset"
          >
            <AlertTriangle className="h-4 w-4 mr-1" />
            Factory Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
