import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMioty } from "@/hooks/use-mioty";

export default function SystemInfo() {
  const { systemInfo } = useMioty();

  const formatUptime = () => {
    // Mock uptime calculation - in real implementation this would come from the backend
    return "2d 14h 30m";
  };

  const formatTimestamp = (timestamp: string | Date | null | undefined) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit", 
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "UTC",
      timeZoneName: "short"
    });
  };

  return (
    <Card data-testid="system-info-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>System Information</span>
          <Info className="h-5 w-5 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">CLI Version:</span>
              <span className="font-mono" data-testid="cli-version">
                {systemInfo?.cliVersion || "0.2.5"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">EdgeCard Model:</span>
              <span className="font-mono" data-testid="edge-card-model">
                {systemInfo?.edgeCardModel || "GWC-62-MY-868"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Firmware Version:</span>
              <span className="font-mono" data-testid="firmware-version">
                {systemInfo?.firmwareVersion || "1.2.3"}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Sync:</span>
              <span className="font-mono text-xs" data-testid="last-sync">
                {formatTimestamp(systemInfo?.lastSync)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Uptime:</span>
              <span className="font-mono text-xs" data-testid="uptime">
                {formatUptime()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Memory Usage:</span>
              <span className="font-mono text-xs" data-testid="memory-usage">
                45%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
