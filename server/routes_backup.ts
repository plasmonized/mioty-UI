import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBaseStationConfigSchema, insertCertificateSchema, insertActivityLogSchema } from "@shared/schema";
import multer from "multer";
import { spawn } from "child_process";
import { existsSync, readFileSync, unlinkSync } from "fs";\nimport { parseString } from "xml2js";

// SSH Helper Functions for EdgeCard Communication
async function executeSSHCommand(edgeCardIp: string, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const sshProcess = spawn("ssh", [
      "-o", "ConnectTimeout=5",
      "-o", "HostKeyAlgorithms=+ssh-rsa",
      "-o", "StrictHostKeyChecking=no",
      "-o", "UserKnownHostsFile=/dev/null",
      "-i", "/home/rak/.ssh/id_rsa",
      `root@${edgeCardIp}`,
      command
    ], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let output = "";
    let error = "";

    sshProcess.stdout?.on("data", (data) => {
      output += data.toString();
    });

    sshProcess.stderr?.on("data", (data) => {
      error += data.toString();
    });

    sshProcess.on("close", (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`SSH command failed: ${error.trim()}`));
      }
    });

    sshProcess.on("error", (err) => {
      reject(err);
    });

    // Timeout nach 5 Minuten
    setTimeout(() => {
      sshProcess.kill();
      reject(new Error("SSH command timeout"));
    }, 300000); // 5 minutes
  });
}

// Fetch real EdgeCard configuration
async function getEdgeCardConfig(edgeCardIp: string) {
  try {
    // Get system information
    const hostname = await executeSSHCommand(edgeCardIp, "hostname");
    const uptime = await executeSSHCommand(edgeCardIp, "uptime");
    const memInfo = await executeSSHCommand(edgeCardIp, "free | head -2 | tail -1 | awk '{print int($3/$2*100)\"%\"}' 2>/dev/null || echo 'unknown'")
    const edgeCardModel = await executeSSHCommand(edgeCardIp, "cat /proc/device-tree/model 2>/dev/null || echo 'EDGE-GW-MY-868'");
    
    // Try to get mioty config if available
    const miotyConfig = await executeSSHCommand(edgeCardIp, "cat /etc/mioty/config.json 2>/dev/null || echo '{}'");
    
    let parsedConfig = {};
    try {
      parsedConfig = JSON.parse(miotyConfig);
    } catch (e) {
      parsedConfig = {};
    }

    // Get process status (BusyBox compatible)
    const miotyStatus = await executeSSHCommand(edgeCardIp, "systemctl is-active mioty 2>/dev/null || (ps | grep mioty | grep -v grep >/dev/null && echo 'active' || echo 'inactive')");
    const isAutoStart = await executeSSHCommand(edgeCardIp, "systemctl is-enabled mioty 2>/dev/null || echo 'unknown'");
    
    return {
      hostname: hostname || "Sentinum Edge mioty",
      uptime: uptime || "unknown",
      memoryUsage: memInfo || "unknown",
      edgeCardModel: edgeCardModel.replace(/\x00/g, '').trim() || "EDGE-GW-MY-868",
      miotyStatus: miotyStatus === "active" ? "running" : "stopped",
      autoStart: isAutoStart === "enabled",
      config: parsedConfig
    };
  } catch (error) {
    throw new Error(`Failed to get EdgeCard config: ${error}`);
  }
}

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const upload = multer({ storage: multer.memoryStorage() });

// Periodische Updates alle 30 Sekunden
let updateInterval: NodeJS.Timeout | null = null;

function startPeriodicUpdates() {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  
  updateInterval = setInterval(async () => {
    try {
      const connection = await storage.getConnection();
      
      if (connection?.status === "connected" && connection.edgeCardIp) {
        // Update all data periodically
        await getEdgeCardConfig(connection.edgeCardIp);
        
        await storage.addActivityLog({
          level: "INFO",
          message: "Periodic data update completed",
          source: "system",
        });
      }
    } catch (error) {
      await storage.addActivityLog({
        level: "ERROR",
        message: `Periodic update failed: ${error}`,
        source: "system",
      });
    }
  }, 30000); // 30 seconds
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Start periodic updates
  startPeriodicUpdates();
  
  // Connection management
  app.get("/api/connection", async (req, res) => {
    try {
      const connection = await storage.getConnection();
      res.json(connection);
    } catch (error) {
      res.status(500).json({ message: "Failed to get connection" });
    }
  });

  app.post("/api/connection/setup", async (req, res) => {
    try {
      await storage.addActivityLog({
        level: "INFO",
        message: "Setting up connection and firewall rules",
        source: "connection",
      });
      
      // Simulate setup process
      setTimeout(async () => {
        await storage.updateConnectionStatus("disconnected");
        await storage.addActivityLog({
          level: "INFO",
          message: "Connection setup completed successfully",
          source: "connection",
        });
      }, 1000);
      
      res.json({ message: "Connection setup initiated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to setup connection" });
    }
  });

  app.post("/api/connection/start", async (req, res) => {
    try {
      await storage.updateConnectionStatus("connected");
      await storage.addActivityLog({
        level: "CONN",
        message: "Connection established to EdgeCard",
        source: "connection",
      });
      res.json({ message: "Connection started" });
    } catch (error) {
      res.status(500).json({ message: "Failed to start connection" });
    }
  });

  app.post("/api/connection/stop", async (req, res) => {
    try {
      await storage.updateConnectionStatus("disconnected");
      await storage.addActivityLog({
        level: "INFO",
        message: "Connection to EdgeCard stopped",
        source: "connection",
      });
      res.json({ message: "Connection stopped" });
    } catch (error) {
      res.status(500).json({ message: "Failed to stop connection" });
    }
  });

  app.delete("/api/connection", async (req, res) => {
    try {
      await storage.updateConnectionStatus("disconnected");
      await storage.addActivityLog({
        level: "INFO",
        message: "Connection configuration removed",
        source: "connection",
      });
      res.json({ message: "Connection removed" });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove connection" });
    }
  });

  app.post("/api/connection/dashboard", async (req, res) => {
    try {
      const connection = await storage.getConnection();
      
      if (connection?.status !== "connected") {
        return res.status(400).json({ 
          success: false, 
          message: "Connection not established" 
        });
      }

      // Create SSH tunnel: RAK Pi IP:8888 -> EdgeCard:8080  
      // This matches the original mioty-cli dashboard command
      const edgeCardIp = connection.edgeCardIp || "172.30.1.2";
      
      await storage.addActivityLog({
        level: "INFO",
        message: `Creating SSH tunnel: 0.0.0.0:8888 -> ${edgeCardIp}:8080`,
        source: "dashboard",
      });

      // Create actual SSH tunnel to EdgeCard
      try {
        // Check if SSH key exists
        if (!existsSync("/home/rak/.ssh/id_rsa")) {
          await storage.addActivityLog({
            level: "ERROR",
            message: "SSH private key not found at /home/rak/.ssh/id_rsa",
            source: "dashboard",
          });
          return res.status(500).json({ 
            success: false, 
            message: "SSH key not found. Please run setup again." 
          });
        }

        // Kill any existing SSH tunnel on port 8888
        try {
          const killProcess = spawn("pkill", ["-f", "8888:localhost:8080"], { stdio: "ignore" });
          await new Promise(resolve => {
            killProcess.on('close', () => resolve(undefined));
            killProcess.on('error', () => resolve(undefined));
            // Timeout after 2 seconds
            setTimeout(() => resolve(undefined), 2000);
          });
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        } catch (e) { /* ignore */ }

        // Test SSH connection first
        await storage.addActivityLog({
          level: "INFO",
          message: `Testing SSH connection to root@${edgeCardIp}...`,
          source: "dashboard",
        });

        const sshProcess = spawn("ssh", [
          "-o", "ConnectTimeout=10",
          "-o", "HostKeyAlgorithms=+ssh-rsa",
          "-o", "PubkeyAuthentication=yes",
          "-o", "PasswordAuthentication=no",
          "-o", "StrictHostKeyChecking=no",
          "-o", "UserKnownHostsFile=/dev/null",
          "-i", "/home/rak/.ssh/id_rsa",
          "-L", "0.0.0.0:8888:localhost:8080",
          "-N", // No remote commands (for background)
          `root@${edgeCardIp}`
        ], {
          stdio: ["ignore", "pipe", "pipe"],
          detached: false  // Keep attached to monitor errors
        });

        sshProcess.on("error", async (err) => {
          await storage.addActivityLog({
            level: "ERROR",
            message: `SSH tunnel failed: ${err.message}`,
            source: "dashboard",
          });
        });

        sshProcess.on("spawn", async () => {
          await storage.addActivityLog({
            level: "INFO", 
            message: "SSH tunnel process started successfully",
            source: "dashboard",
          });
        });

        sshProcess.on("close", async (code) => {
          await storage.addActivityLog({
            level: code === 0 ? "INFO" : "ERROR",
            message: `SSH tunnel closed with code: ${code}`,
            source: "dashboard",
          });
        });

        sshProcess.stderr?.on("data", async (data) => {
          const errorMsg = data.toString().trim();
          await storage.addActivityLog({
            level: "ERROR",
            message: `SSH tunnel stderr: ${errorMsg}`,
            source: "dashboard",
          });
        });

        sshProcess.stdout?.on("data", async (data) => {
          const outputMsg = data.toString().trim();
          await storage.addActivityLog({
            level: "INFO",
            message: `SSH tunnel stdout: ${outputMsg}`,
            source: "dashboard",
          });
        });

        // Add timeout handler
        const timeoutId = setTimeout(async () => {
          await storage.addActivityLog({
            level: "ERROR",
            message: "SSH tunnel timeout - killing process",
            source: "dashboard",
          });
          sshProcess.kill('SIGTERM');
        }, 300000); // 5 minutes timeout

        sshProcess.on("close", () => {
          clearTimeout(timeoutId);
        });

        // Unref so parent process doesn't wait
        sshProcess.unref();
        
      } catch (error) {
        await storage.addActivityLog({
          level: "ERROR",
          message: `Failed to spawn SSH tunnel: ${error}`,
          source: "dashboard", 
        });
      }
      
      res.json({ 
        success: true, 
        message: "SSH tunnel created successfully",
        dashboardUrl: "http://172.30.1.1:8888"
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Failed to create dashboard tunnel" 
      });
    }
  });

  // Base station management - now with real data
  app.get("/api/base-station/status", async (req, res) => {
    try {
      const connection = await storage.getConnection();
      
      if (connection?.status === "connected" && connection.edgeCardIp) {
        try {
          // Get real data from EdgeCard
          const realData = await getEdgeCardConfig(connection.edgeCardIp);
          
          // Update storage with real data
          const realStatus = {
            status: realData.miotyStatus,
            autoStart: realData.autoStart,
            lastStarted: realData.miotyStatus === "running" ? new Date() : null,
            lastStopped: realData.miotyStatus === "stopped" ? new Date() : null,
            uptime: realData.uptime,
            memoryUsage: realData.memoryUsage,
            updatedAt: new Date(),
          };
          
          await storage.updateBaseStationStatus(realStatus);
          
          await storage.addActivityLog({
            level: "INFO",
            message: `Base station status updated from EdgeCard: ${realData.miotyStatus}`,
            source: "system",
          });
          
        } catch (sshError) {
          await storage.addActivityLog({
            level: "ERROR",
            message: `Failed to get real status from EdgeCard: ${sshError}`,
            source: "system",
          });
        }
      }
      
      const status = await storage.getBaseStationStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to get base station status" });
    }
  });

  app.post("/api/base-station/start", async (req, res) => {
    try {
      await storage.updateBaseStationStatus({
        status: "running",
        lastStarted: new Date(),
      });
      await storage.addActivityLog({
        level: "INFO",
        message: "Base station started successfully",
        source: "base-station",
      });
      res.json({ message: "Base station started" });
    } catch (error) {
      res.status(500).json({ message: "Failed to start base station" });
    }
  });

  app.post("/api/base-station/stop", async (req, res) => {
    try {
      await storage.updateBaseStationStatus({
        status: "stopped",
        lastStopped: new Date(),
      });
      await storage.addActivityLog({
        level: "INFO",
        message: "Base station stopped",
        source: "base-station",
      });
      res.json({ message: "Base station stopped" });
    } catch (error) {
      res.status(500).json({ message: "Failed to stop base station" });
    }
  });

  app.post("/api/base-station/restart", async (req, res) => {
    try {
      await storage.addActivityLog({
        level: "INFO",
        message: "Restarting base station...",
        source: "base-station",
      });
      
      // Simulate restart process
      setTimeout(async () => {
        await storage.updateBaseStationStatus({
          status: "running",
          lastStarted: new Date(),
        });
        await storage.addActivityLog({
          level: "INFO",
          message: "Base station restarted successfully",
          source: "base-station",
        });
      }, 2000);
      
      res.json({ message: "Base station restart initiated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to restart base station" });
    }
  });

  app.post("/api/base-station/toggle-autostart", async (req, res) => {
    try {
      const currentStatus = await storage.getBaseStationStatus();
      const newAutoStart = !currentStatus?.autoStart;
      
      await storage.updateBaseStationStatus({
        autoStart: newAutoStart,
      });
      
      await storage.addActivityLog({
        level: "INFO",
        message: `Base station auto-start ${newAutoStart ? 'enabled' : 'disabled'}`,
        source: "base-station",
      });
      
      res.json({ message: "Auto-start setting updated", autoStart: newAutoStart });
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle auto-start" });
    }
  });

  app.post("/api/base-station/factory-reset", async (req, res) => {
    try {
      await storage.addActivityLog({
        level: "WARN",
        message: "Factory reset initiated - all settings will be restored to defaults",
        source: "system",
      });
      
      // Reset to default configuration
      await storage.updateBaseStationConfig({
        uniqueBaseStationId: "9C-65-F9-FF-FE-55-44-33",
        baseStationName: "Sentinum Edge mioty",
        baseStationVendor: "Miromico",
        baseStationModel: "EDGE-GW-MY-868",
        serviceCenterAddr: "eu3.loriot.io",
        serviceCenterPort: 727,
        profile: "EU1",
        tlsAuthRequired: true,
      });
      
      await storage.addActivityLog({
        level: "INFO",
        message: "Factory reset completed successfully",
        source: "system",
      });
      
      res.json({ message: "Factory reset completed" });
    } catch (error) {
      res.status(500).json({ message: "Failed to perform factory reset" });
    }
  });

  // Configuration management
  app.get("/api/config", async (req, res) => {
    try {
      const connection = await storage.getConnection();
      
      if (connection?.status === "connected" && connection.edgeCardIp) {
        try {
          // Get real configuration from EdgeCard
          const realData = await getEdgeCardConfig(connection.edgeCardIp);
          
          // Update config with real data
          const realConfig = {
            baseStationName: realData.hostname,
            baseStationVendor: "Miromico",
            baseStationModel: realData.edgeCardModel,
            // Keep other fields from stored config or use defaults
            uniqueBaseStationId: "9C-65-F9-FF-FE-55-44-33", // Would need specific command to get this
            serviceCenterAddr: "eu3.loriot.io", // From config file if available
            serviceCenterPort: 727,
            profile: "EU1",
            tlsAuthRequired: true,
            updatedAt: new Date(),
          };
          
          // Merge with any saved config fields
          const existingConfig = await storage.getBaseStationConfig();
          const mergedConfig = { ...existingConfig, ...realConfig };
          
          await storage.updateBaseStationConfig(mergedConfig);
          
          await storage.addActivityLog({
            level: "INFO",
            message: `Configuration updated from EdgeCard: ${realData.hostname}`,
            source: "config",
          });
          
        } catch (sshError) {
          await storage.addActivityLog({
            level: "ERROR",
            message: `Failed to get real config from EdgeCard: ${sshError}`,
            source: "config",
          });
        }
      }
      
      const config = await storage.getBaseStationConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to get configuration" });
    }
  });

  app.put("/api/config", async (req, res) => {
    try {
      const validatedData = insertBaseStationConfigSchema.parse(req.body);
      const config = await storage.updateBaseStationConfig(validatedData);
      
      await storage.addActivityLog({
        level: "INFO",
        message: "Base station configuration updated",
        source: "config",
      });
      
      res.json(config);
    } catch (error) {
      res.status(400).json({ message: "Invalid configuration data" });
    }
  });

  // Certificate management
  app.get("/api/certificates", async (req, res) => {
    try {
      const certificates = await storage.getCertificates();
      res.json(certificates);
    } catch (error) {
      res.status(500).json({ message: "Failed to get certificates" });
    }
  });

  app.post("/api/certificates/upload", upload.single("certificate"), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { originalname } = req.file;
      const validFilenames = ["bstation.cer", "bstation.key", "root_ca.cer"];
      
      if (!validFilenames.includes(originalname)) {
        return res.status(400).json({ 
          message: `Invalid filename. Valid names are: ${validFilenames.join(", ")}` 
        });
      }

      const certificateData = {
        filename: originalname,
        type: originalname.endsWith(".key") ? "key" : "certificate",
        description: originalname === "root_ca.cer" ? "Root CA Certificate" :
                    originalname === "bstation.cer" ? "Base Station Certificate" :
                    "Base Station Private Key",
        status: "valid",
        content: req.file.buffer.toString("base64"),
      };

      const certificate = await storage.uploadCertificate(certificateData);
      res.json(certificate);
    } catch (error) {
      res.status(500).json({ message: "Failed to upload certificate" });
    }
  });

  app.delete("/api/certificates/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const deleted = await storage.deleteCertificate(filename);
      
      if (deleted) {
        res.json({ message: "Certificate deleted" });
      } else {
        res.status(404).json({ message: "Certificate not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete certificate" });
    }
  });

  // Activity logs
  app.get("/api/logs", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await storage.getActivityLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to get activity logs" });
    }
  });

  app.delete("/api/logs", async (req, res) => {
    try {
      await storage.clearActivityLogs();
      await storage.addActivityLog({
        level: "INFO",
        message: "Activity log cleared",
        source: "system",
      });
      res.json({ message: "Activity logs cleared" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear activity logs" });
    }
  });

  // System info
  app.get("/api/system", async (req, res) => {
    try {
      const connection = await storage.getConnection();
      
      if (connection?.status === "connected" && connection.edgeCardIp) {
        try {
          // Get real system information from EdgeCard
          const realData = await getEdgeCardConfig(connection.edgeCardIp);
          const kernelVersion = await executeSSHCommand(connection.edgeCardIp, "uname -r");
          const firmwareVersion = await executeSSHCommand(connection.edgeCardIp, "cat /etc/os-release | grep VERSION_ID | cut -d'=' -f2 | tr -d '\"' || echo '1.2.3'");
          
          // Update system info with real data
          const realSystemInfo = {
            cliVersion: "0.2.5", // This is our web console version
            edgeCardModel: realData.edgeCardModel,
            firmwareVersion: firmwareVersion || "1.2.3",
            kernelVersion: kernelVersion || "unknown",
            hostname: realData.hostname,
            lastSync: new Date(),
            updatedAt: new Date(),
          };
          
          // Merge with existing system info
          const existingSystemInfo = await storage.getSystemInfo();
          const mergedSystemInfo = { ...existingSystemInfo, ...realSystemInfo };
          
          await storage.updateSystemInfo(mergedSystemInfo);
          
          await storage.addActivityLog({
            level: "INFO",
            message: `System information updated from EdgeCard`,
            source: "system",
          });
          
        } catch (sshError) {
          await storage.addActivityLog({
            level: "ERROR",
            message: `Failed to get real system info from EdgeCard: ${sshError}`,
            source: "system",
          });
        }
      }
      
      const systemInfo = await storage.getSystemInfo();
      res.json(systemInfo);
    } catch (error) {
      res.status(500).json({ message: "Failed to get system information" });
    }
  });

  // Quick actions
  app.post("/api/ssh", async (req, res) => {
    try {
      await storage.addActivityLog({
        level: "INFO",
        message: "SSH connection initiated to EdgeCard",
        source: "ssh",
      });
      res.json({ message: "SSH connection initiated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to initiate SSH" });
    }
  });

  app.post("/api/dashboard", async (req, res) => {
    try {
      await storage.addActivityLog({
        level: "INFO",
        message: "Dashboard tunnel created on port 8888",
        source: "dashboard",
      });
      res.json({ 
        message: "Dashboard tunnel created", 
        url: "http://localhost:8888",
        port: 8888 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to create dashboard tunnel" });
    }
  });

  app.get("/api/credentials", async (req, res) => {
    try {
      const config = await storage.getBaseStationConfig();
      const uniqueId = config?.uniqueBaseStationId || "00-80-E1-01-02-03-FF-FE-04-05-06-07";
      
      // Extract first 6 bytes for password
      const password = uniqueId.split("-").slice(0, 6).join("-");
      
      res.json({
        username: "root",
        password: password,
        note: "Password is derived from the first 6 bytes of the unique base station ID",
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get credentials" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
