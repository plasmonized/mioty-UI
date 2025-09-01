import { useState } from "react";
import { Activity, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMioty } from "@/hooks/use-mioty";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ActivityLogProps {
  onShowLoading: (text: string) => void;
  onHideLoading: () => void;
  onShowToast: (title: string, description: string, variant?: "default" | "destructive") => void;
}

export default function ActivityLog({ 
  onShowLoading, 
  onHideLoading, 
  onShowToast 
}: ActivityLogProps) {
  const { activityLogs } = useMioty();
  const queryClient = useQueryClient();

  const clearLogsMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/logs"),
    onMutate: () => onShowLoading("Clearing activity logs..."),
    onSuccess: () => {
      onHideLoading();
      onShowToast("Success", "Activity logs cleared");
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
    },
    onError: () => {
      onHideLoading();
      onShowToast("Error", "Failed to clear activity logs", "destructive");
    },
  });

  const exportLogs = () => {
    if (!activityLogs || activityLogs.length === 0) {
      onShowToast("Warning", "No logs to export", "destructive");
      return;
    }

    const logText = activityLogs.map(log => {
      const timestamp = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Unknown';
      return `[${timestamp}] ${log.level}: ${log.message} (${log.source || 'system'})`;
    }).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mioty-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onShowToast("Success", "Logs exported successfully");
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "INFO":
        return "text-accent";
      case "WARN":
        return "text-yellow-500";
      case "ERROR":
        return "text-destructive";
      case "CONN":
        return "text-primary";
      default:
        return "text-muted-foreground";
    }
  };

  const formatTimestamp = (timestamp: string | Date | null) => {
    if (!timestamp) return "--:--:--";
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  return (
    <Card data-testid="activity-log-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Activity Log</span>
          <div className="flex space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => clearLogsMutation.mutate()}
              disabled={clearLogsMutation.isPending}
              data-testid="button-clear-logs"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={exportLogs}
              data-testid="button-export-logs"
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48 w-full">
          <div className="space-y-2 font-mono text-sm" data-testid="log-entries">
            {activityLogs?.map((log) => (
              <div key={log.id} className="flex items-start space-x-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatTimestamp(log.timestamp)}
                </span>
                <span className={`font-medium ${getLevelColor(log.level)}`}>
                  {log.level}
                </span>
                <span className="text-card-foreground flex-1">
                  {log.message}
                </span>
              </div>
            ))}
            
            {(!activityLogs || activityLogs.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No activity logs</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
