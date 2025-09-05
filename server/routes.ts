import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBaseStationConfigSchema, insertCertificateSchema, insertActivityLogSchema } from "@shared/schema";
import multer from "multer";
import { spawn } from "child_process";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  
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
        // Kill any existing SSH tunnel on port 8888
        try {
          await spawn("pkill", ["-f", "8888:localhost:8080"], { stdio: "ignore" });
        } catch (e) { /* ignore */ }

        const sshProcess = spawn("ssh", [
          "-o", "ConnectTimeout=10",
          "-o", "HostKeyAlgorithms=+ssh-rsa",
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
          await storage.addActivityLog({
            level: "ERROR",
            message: `SSH tunnel stderr: ${data.toString().trim()}`,
            source: "dashboard",
          });
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

  // Base station management
  app.get("/api/base-station/status", async (req, res) => {
    try {
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
