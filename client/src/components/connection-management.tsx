import { EthernetPort, Settings, Play, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMioty } from "@/hooks/use-mioty";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ConnectionManagementProps {
  onShowLoading: (text: string) => void;
  onHideLoading: () => void;
  onShowToast: (title: string, description: string, variant?: "default" | "destructive") => void;
}

export default function ConnectionManagement({ 
  onShowLoading, 
  onHideLoading, 
  onShowToast 
}: ConnectionManagementProps) {
  const { connection } = useMioty();
  const queryClient = useQueryClient();

  const setupMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/connection/setup"),
    onMutate: () => onShowLoading("Setting up connection..."),
    onSuccess: () => {
      onHideLoading();
      onShowToast("Success", "Connection setup completed");
      queryClient.invalidateQueries({ queryKey: ["/api/connection"] });
    },
    onError: () => {
      onHideLoading();
      onShowToast("Error", "Failed to setup connection", "destructive");
    },
  });

  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/connection/start"),
    onMutate: () => onShowLoading("Establishing connection..."),
    onSuccess: () => {
      onHideLoading();
      onShowToast("Success", "Connection established");
      queryClient.invalidateQueries({ queryKey: ["/api/connection"] });
    },
    onError: () => {
      onHideLoading();
      onShowToast("Error", "Failed to start connection", "destructive");
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/connection/stop"),
    onMutate: () => onShowLoading("Disconnecting..."),
    onSuccess: () => {
      onHideLoading();
      onShowToast("Success", "Connection stopped");
      queryClient.invalidateQueries({ queryKey: ["/api/connection"] });
    },
    onError: () => {
      onHideLoading();
      onShowToast("Error", "Failed to stop connection", "destructive");
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/connection"),
    onMutate: () => onShowLoading("Removing connection..."),
    onSuccess: () => {
      onHideLoading();
      onShowToast("Success", "Connection removed");
      queryClient.invalidateQueries({ queryKey: ["/api/connection"] });
    },
    onError: () => {
      onHideLoading();
      onShowToast("Error", "Failed to remove connection", "destructive");
    },
  });

  const handleRemove = () => {
    if (confirm("Are you sure you want to remove the connection? This will delete firewall rules and network configuration.")) {
      removeMutation.mutate();
    }
  };

  return (
    <Card data-testid="connection-management-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Host Connection</span>
          <EthernetPort className="h-5 w-5 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Interface:</span>
            <Badge variant="secondary" className="font-mono text-xs" data-testid="interface-badge">
              {connection?.interface || "eth1"}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">IP Address:</span>
            <Badge variant="secondary" className="font-mono text-xs" data-testid="ip-address-badge">
              {connection?.ipAddress || "172.30.1.1"}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">EdgeCard IP:</span>
            <Badge variant="secondary" className="font-mono text-xs" data-testid="edge-card-ip-badge">
              {connection?.edgeCardIp || "172.30.1.2"}
            </Badge>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => setupMutation.mutate()}
            disabled={setupMutation.isPending}
            className="text-sm"
            data-testid="button-setup"
          >
            <Settings className="h-4 w-4 mr-1" />
            Setup
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            className="text-sm bg-accent text-accent-foreground hover:bg-accent/90"
            data-testid="button-connect"
          >
            <Play className="h-4 w-4 mr-1" />
            Connect
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => stopMutation.mutate()}
            disabled={stopMutation.isPending}
            className="text-sm"
            data-testid="button-disconnect"
          >
            <Square className="h-4 w-4 mr-1" />
            Disconnect
          </Button>
          
          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={removeMutation.isPending}
            className="text-sm"
            data-testid="button-remove"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
