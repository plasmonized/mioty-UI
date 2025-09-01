import { useQuery } from "@tanstack/react-query";
import type { 
  Connection, 
  BaseStationConfig, 
  Certificate, 
  BaseStationStatus, 
  ActivityLog, 
  SystemInfo 
} from "@shared/schema";

export function useMioty() {
  const { data: connection } = useQuery<Connection>({
    queryKey: ["/api/connection"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: config } = useQuery<BaseStationConfig>({
    queryKey: ["/api/config"],
  });

  const { data: certificates } = useQuery<Certificate[]>({
    queryKey: ["/api/certificates"],
  });

  const { data: baseStationStatus } = useQuery<BaseStationStatus>({
    queryKey: ["/api/base-station/status"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: activityLogs } = useQuery<ActivityLog[]>({
    queryKey: ["/api/logs"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: systemInfo } = useQuery<SystemInfo>({
    queryKey: ["/api/system"],
  });

  return {
    connection,
    config,
    certificates,
    baseStationStatus,
    activityLogs,
    systemInfo,
  };
}
