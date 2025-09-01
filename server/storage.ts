import { 
  type Connection, type InsertConnection,
  type BaseStationConfig, type InsertBaseStationConfig,
  type Certificate, type InsertCertificate,
  type BaseStationStatus, type InsertBaseStationStatus,
  type ActivityLog, type InsertActivityLog,
  type SystemInfo, type InsertSystemInfo
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Connection management
  getConnection(): Promise<Connection | undefined>;
  createConnection(connection: InsertConnection): Promise<Connection>;
  updateConnectionStatus(status: string): Promise<Connection | undefined>;
  
  // Base station configuration
  getBaseStationConfig(): Promise<BaseStationConfig | undefined>;
  updateBaseStationConfig(config: InsertBaseStationConfig): Promise<BaseStationConfig>;
  
  // Certificate management
  getCertificates(): Promise<Certificate[]>;
  getCertificate(filename: string): Promise<Certificate | undefined>;
  uploadCertificate(cert: InsertCertificate): Promise<Certificate>;
  deleteCertificate(filename: string): Promise<boolean>;
  
  // Base station status
  getBaseStationStatus(): Promise<BaseStationStatus | undefined>;
  updateBaseStationStatus(status: InsertBaseStationStatus): Promise<BaseStationStatus>;
  
  // Activity logs
  getActivityLogs(limit?: number): Promise<ActivityLog[]>;
  addActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  clearActivityLogs(): Promise<void>;
  
  // System info
  getSystemInfo(): Promise<SystemInfo | undefined>;
  updateSystemInfo(info: InsertSystemInfo): Promise<SystemInfo>;
}

export class MemStorage implements IStorage {
  private connections: Map<string, Connection> = new Map();
  private baseStationConfigs: Map<string, BaseStationConfig> = new Map();
  private certificates: Map<string, Certificate> = new Map();
  private baseStationStatuses: Map<string, BaseStationStatus> = new Map();
  private activityLogs: ActivityLog[] = [];
  private systemInfos: Map<string, SystemInfo> = new Map();

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Initialize default connection
    const defaultConnection: Connection = {
      id: randomUUID(),
      name: "mioty",
      interface: "eth1",
      status: "disconnected",
      ipAddress: "172.30.1.1",
      edgeCardIp: "172.30.1.2",
      autoConnect: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.connections.set("default", defaultConnection);

    // Initialize default base station config
    const defaultConfig: BaseStationConfig = {
      id: randomUUID(),
      uniqueBaseStationId: "9C-65-F9-FF-FE-55-44-33",
      baseStationName: "Sentinum Edge mioty",
      baseStationVendor: "Miromico",
      baseStationModel: "EDGE-GW-MY-868",
      serviceCenterAddr: "eu3.loriot.io",
      serviceCenterPort: 727,
      profile: "EU1",
      tlsAuthRequired: true,
      updatedAt: new Date(),
    };
    this.baseStationConfigs.set("default", defaultConfig);

    // Initialize default certificates
    const defaultCerts: Certificate[] = [
      {
        id: randomUUID(),
        filename: "root_ca.cer",
        type: "certificate",
        description: "Root CA Certificate",
        status: "valid",
        uploadedAt: new Date(),
        content: "",
      },
      {
        id: randomUUID(),
        filename: "bstation.cer",
        type: "certificate",
        description: "Base Station Certificate",
        status: "valid",
        uploadedAt: new Date(),
        content: "",
      },
      {
        id: randomUUID(),
        filename: "bstation.key",
        type: "key",
        description: "Base Station Private Key",
        status: "missing",
        uploadedAt: new Date(),
        content: "",
      },
    ];
    defaultCerts.forEach(cert => this.certificates.set(cert.filename, cert));

    // Initialize default base station status
    const defaultStatus: BaseStationStatus = {
      id: randomUUID(),
      status: "running",
      autoStart: true,
      lastStarted: new Date(),
      lastStopped: null,
      uptime: "2d 14h 30m",
      memoryUsage: "45%",
      updatedAt: new Date(),
    };
    this.baseStationStatuses.set("default", defaultStatus);

    // Initialize default system info
    const defaultSystemInfo: SystemInfo = {
      id: randomUUID(),
      cliVersion: "0.2.5",
      edgeCardModel: "EDGE-GW-MY-868",
      firmwareVersion: "1.2.3",
      lastSync: new Date(),
      updatedAt: new Date(),
    };
    this.systemInfos.set("default", defaultSystemInfo);

    // Initialize some activity logs
    const defaultLogs: ActivityLog[] = [
      {
        id: randomUUID(),
        timestamp: new Date(),
        level: "INFO",
        message: "Base station started successfully",
        source: "system",
      },
      {
        id: randomUUID(),
        timestamp: new Date(Date.now() - 45000),
        level: "CONN",
        message: "Connection established to EdgeCard",
        source: "connection",
      },
      {
        id: randomUUID(),
        timestamp: new Date(Date.now() - 75000),
        level: "INFO",
        message: "Certificate bstation.cer uploaded successfully",
        source: "certificate",
      },
      {
        id: randomUUID(),
        timestamp: new Date(Date.now() - 105000),
        level: "WARN",
        message: "TLS authentication required but certificate missing",
        source: "security",
      },
    ];
    this.activityLogs = defaultLogs;
  }

  async getConnection(): Promise<Connection | undefined> {
    return this.connections.get("default");
  }

  async createConnection(insertConnection: InsertConnection): Promise<Connection> {
    const connection: Connection = {
      id: randomUUID(),
      name: insertConnection.name,
      interface: insertConnection.interface || null,
      status: insertConnection.status || "disconnected",
      ipAddress: insertConnection.ipAddress || null,
      edgeCardIp: insertConnection.edgeCardIp || null,
      autoConnect: insertConnection.autoConnect || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.connections.set("default", connection);
    return connection;
  }

  async updateConnectionStatus(status: string): Promise<Connection | undefined> {
    const connection = this.connections.get("default");
    if (connection) {
      connection.status = status;
      connection.updatedAt = new Date();
      this.connections.set("default", connection);
    }
    return connection;
  }

  async getBaseStationConfig(): Promise<BaseStationConfig | undefined> {
    return this.baseStationConfigs.get("default");
  }

  async updateBaseStationConfig(config: InsertBaseStationConfig): Promise<BaseStationConfig> {
    const existing = this.baseStationConfigs.get("default");
    const updated: BaseStationConfig = {
      id: existing?.id || randomUUID(),
      uniqueBaseStationId: config.uniqueBaseStationId,
      baseStationName: config.baseStationName,
      baseStationVendor: config.baseStationVendor,
      baseStationModel: config.baseStationModel,
      serviceCenterAddr: config.serviceCenterAddr,
      serviceCenterPort: config.serviceCenterPort,
      profile: config.profile || "EU1",
      tlsAuthRequired: config.tlsAuthRequired || null,
      updatedAt: new Date(),
    };
    this.baseStationConfigs.set("default", updated);
    return updated;
  }

  async getCertificates(): Promise<Certificate[]> {
    return Array.from(this.certificates.values());
  }

  async getCertificate(filename: string): Promise<Certificate | undefined> {
    return this.certificates.get(filename);
  }

  async uploadCertificate(cert: InsertCertificate): Promise<Certificate> {
    const certificate: Certificate = {
      id: randomUUID(),
      filename: cert.filename,
      type: cert.type,
      description: cert.description || null,
      status: cert.status || "valid",
      content: cert.content || null,
      uploadedAt: new Date(),
    };
    this.certificates.set(cert.filename, certificate);
    
    // Add activity log
    await this.addActivityLog({
      level: "INFO",
      message: `Certificate ${cert.filename} uploaded successfully`,
      source: "certificate",
    });
    
    return certificate;
  }

  async deleteCertificate(filename: string): Promise<boolean> {
    const deleted = this.certificates.delete(filename);
    if (deleted) {
      await this.addActivityLog({
        level: "INFO",
        message: `Certificate ${filename} removed`,
        source: "certificate",
      });
    }
    return deleted;
  }

  async getBaseStationStatus(): Promise<BaseStationStatus | undefined> {
    return this.baseStationStatuses.get("default");
  }

  async updateBaseStationStatus(status: InsertBaseStationStatus): Promise<BaseStationStatus> {
    const existing = this.baseStationStatuses.get("default");
    const updated: BaseStationStatus = {
      id: existing?.id || randomUUID(),
      status: status.status || existing?.status || "stopped",
      autoStart: status.autoStart ?? existing?.autoStart ?? null,
      lastStarted: status.lastStarted ?? existing?.lastStarted ?? null,
      lastStopped: status.lastStopped ?? existing?.lastStopped ?? null,
      uptime: status.uptime ?? existing?.uptime ?? null,
      memoryUsage: status.memoryUsage ?? existing?.memoryUsage ?? null,
      updatedAt: new Date(),
    };
    this.baseStationStatuses.set("default", updated);
    return updated;
  }

  async getActivityLogs(limit: number = 50): Promise<ActivityLog[]> {
    return this.activityLogs
      .sort((a, b) => (b.timestamp ? new Date(b.timestamp).getTime() : 0) - (a.timestamp ? new Date(a.timestamp).getTime() : 0))
      .slice(0, limit);
  }

  async addActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const activityLog: ActivityLog = {
      id: randomUUID(),
      timestamp: new Date(),
      level: log.level,
      message: log.message,
      source: log.source || null,
    };
    this.activityLogs.unshift(activityLog);
    
    // Keep only last 100 logs
    if (this.activityLogs.length > 100) {
      this.activityLogs = this.activityLogs.slice(0, 100);
    }
    
    return activityLog;
  }

  async clearActivityLogs(): Promise<void> {
    this.activityLogs = [];
  }

  async getSystemInfo(): Promise<SystemInfo | undefined> {
    return this.systemInfos.get("default");
  }

  async updateSystemInfo(info: InsertSystemInfo): Promise<SystemInfo> {
    const existing = this.systemInfos.get("default");
    const updated: SystemInfo = {
      id: existing?.id || randomUUID(),
      cliVersion: info.cliVersion ?? existing?.cliVersion ?? null,
      edgeCardModel: info.edgeCardModel ?? existing?.edgeCardModel ?? null,
      firmwareVersion: info.firmwareVersion ?? existing?.firmwareVersion ?? null,
      lastSync: info.lastSync ?? existing?.lastSync ?? null,
      updatedAt: new Date(),
    };
    this.systemInfos.set("default", updated);
    return updated;
  }
}

export const storage = new MemStorage();
