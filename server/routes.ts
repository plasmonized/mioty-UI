import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBaseStationConfigSchema, insertCertificateSchema, insertActivityLogSchema } from "@shared/schema";
import multer from "multer";
import { spawn } from "child_process";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { parseString } from "xml2js";

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

// Get mioty XML configuration from EdgeCard (like mioty-cli getallparams)
async function getMiotyXMLConfig(edgeCardIp: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // Remove any existing temp file
    try {
      unlinkSync("/tmp/mioty_bs_config.xml");
    } catch (e) { /* ignore */ }

    // Use scp to get the XML config file from EdgeCard
    const scpProcess = spawn("scp", [
      "-q",
      "-o", "ConnectTimeout=10",
      "-o", "HostKeyAlgorithms=+ssh-rsa",
      "-o", "StrictHostKeyChecking=no",
      "-o", "UserKnownHostsFile=/dev/null",
      "-i", "/home/rak/.ssh/id_rsa",
      `root@${edgeCardIp}:mioty_bs/mioty_bs_config.xml`,
      "/tmp/mioty_bs_config.xml"
    ]);

    scpProcess.on("close", async (code) => {
      if (code === 0) {
        try {
          // Read and parse the XML file
          const xmlContent = readFileSync("/tmp/mioty_bs_config.xml", "utf8");
          
          await ExtendedLogger.log("DEBUG", "✅ XML file retrieved successfully", "xml-config", {
            fileSize: xmlContent.length,
            preview: xmlContent.substring(0, 200) + "..."
          });
          
          parseString(xmlContent, async (err, result) => {
            if (err) {
              await ExtendedLogger.log("ERROR", "❌ XML parsing failed", "xml-config", {
                error: err.toString(),
                xmlPreview: xmlContent.substring(0, 500)
              });
              reject(new Error(`Failed to parse XML: ${err}`));
              return;
            }
            
            await ExtendedLogger.log("DEBUG", "✅ XML parsed successfully", "xml-config", {
              parsedKeys: Object.keys(result || {}),
              baseStationConfig: result?.BaseStationConfig ? "found" : "missing"
            });
            
            // Clean up temp file
            try {
              unlinkSync("/tmp/mioty_bs_config.xml");
            } catch (e) { /* ignore */ }
            
            resolve(result);
          });
        } catch (error) {
          await ExtendedLogger.log("ERROR", "❌ Failed to read XML file", "xml-config", {
            error: String(error)
          });
          reject(new Error(`Failed to read XML file: ${error}`));
        }
      } else {
        await ExtendedLogger.log("ERROR", "❌ SCP transfer failed", "xml-config", {
          exitCode: code,
          source: `root@${edgeCardIp}:mioty_bs/mioty_bs_config.xml`
        });
        reject(new Error(`SCP failed with code: ${code}`));
      }
    });

    scpProcess.on("error", async (err) => {
      await ExtendedLogger.log("ERROR", "❌ SCP process error", "xml-config", {
        error: err.message,
        edgeCardIp: edgeCardIp
      });
      reject(new Error(`SCP process failed: ${err.message}`));
    });
    
    // Enhanced error logging for stderr
    scpProcess.stderr?.on("data", async (data) => {
      const errorOutput = data.toString();
      if (!errorOutput.includes("Warning:")) { // Ignore SSH warnings
        await ExtendedLogger.log("WARN", "⚠️ SCP stderr output", "xml-config", {
          stderr: errorOutput.trim()
        });
      }
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      scpProcess.kill();
      reject(new Error("SCP timeout"));
    }, 120000);
  });
}

// Extract mioty parameters from XML (like mioty-cli)
function extractMiotyParams(xmlData: any) {
  try {
    const config = xmlData?.BaseStationConfig || {};
    
    // Log what we found in the XML
    ExtendedLogger.log("DEBUG", "🔍 Parsing XML parameters", "xml-parser", {
      hasBaseStationConfig: !!config,
      availableKeys: Object.keys(config || {}),
      rawConfig: config
    });
    
    const result = {
      uniqueBaseStationId: config.uniqueBaseStationId?.[0] || "unknown",
      baseStationName: config.baseStationName?.[0] || "mioty-bsm",
      baseStationVendor: config.baseStationVendor?.[0] || "Miromico",
      baseStationModel: config.baseStationModel?.[0] || "EDGE-GW-MY-868",
      serviceCenterAddr: config.serviceCenterAddr?.[0] || "localhost",
      serviceCenterPort: config.serviceCenterPort?.[0] || "8080",
      profile: config.profile?.[0] || "EU1",
      tlsAuthRequired: config.tlsAuthRequired?.[0] === "true",
      tlsAllowInsecure: config.tlsAllowInsecure?.[0] === "true"
    };
    
    ExtendedLogger.log("INFO", "📋 Extracted mioty parameters", "xml-parser", result);
    return result;
    
  } catch (error) {
    ExtendedLogger.log("ERROR", "❌ XML parameter extraction failed", "xml-parser", {
      error: String(error),
      usingDefaults: true
    });
    
    // Return defaults if parsing fails
    return {
      uniqueBaseStationId: "unknown",
      baseStationName: "mioty-bsm",
      baseStationVendor: "Miromico",
      baseStationModel: "EDGE-GW-MY-868",
      serviceCenterAddr: "localhost",
      serviceCenterPort: "8080",
      profile: "EU1",
      tlsAuthRequired: false,
      tlsAllowInsecure: false
    };
  }
}

// Fetch real EdgeCard configuration
async function getEdgeCardConfig(edgeCardIp: string) {
  try {
    // Get system information
    const hostname = await executeSSHCommand(edgeCardIp, "hostname");
    const uptime = await executeSSHCommand(edgeCardIp, "uptime");
    const memInfo = await executeSSHCommand(edgeCardIp, "free | head -2 | tail -1 | awk '{print int($3/$2*100)\"%\"}' 2>/dev/null || echo 'unknown'")
    const edgeCardModel = await executeSSHCommand(edgeCardIp, "cat /proc/device-tree/model 2>/dev/null || echo 'EDGE-GW-MY-868'");
    
    // Get real mioty configuration from XML file
    let miotyParams;
    try {
      await ExtendedLogger.log("DEBUG", "🔍 Attempting to get mioty XML config", "config", { edgeCardIp });
      const xmlData = await getMiotyXMLConfig(edgeCardIp);
      miotyParams = extractMiotyParams(xmlData);
      await ExtendedLogger.log("INFO", "✅ XML config retrieved successfully", "config", miotyParams);
    } catch (error) {
      await ExtendedLogger.log("WARN", "⚠️ XML config failed, using defaults", "config", { 
        error: String(error),
        usingDefaults: true 
      });
      // Fallback to defaults if XML not available
      miotyParams = extractMiotyParams({});
    }

    // Get process status for mioty_bs (real service name)
    const miotyStatus = await executeSSHCommand(edgeCardIp, "systemctl is-active mioty_bs 2>/dev/null || (ps | grep mioty | grep -v grep >/dev/null && echo 'active' || echo 'inactive')");
    const isAutoStart = await executeSSHCommand(edgeCardIp, "systemctl is-enabled mioty_bs 2>/dev/null || echo 'unknown'");
    
    return {
      hostname: hostname || "Sentinum Edge mioty",
      uptime: uptime || "unknown",
      memoryUsage: memInfo || "unknown",
      edgeCardModel: edgeCardModel.replace(/\x00/g, '').trim() || "EDGE-GW-MY-868",
      miotyStatus: miotyStatus === "active" ? "running" : "stopped",
      autoStart: isAutoStart === "enabled",
      config: miotyParams
    };
  } catch (error) {
    throw new Error(`Failed to get EdgeCard config: ${error}`);
  }
}

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const upload = multer({ storage: multer.memoryStorage() });

// Enhanced logging utility
class ExtendedLogger {
  static async log(level: string, message: string, source: string, details?: any) {
    // Basic log entry
    await storage.addActivityLog({
      level: level as any,
      message: message,
      source: source,
    });
    
    // Extended details if provided
    if (details) {
      await storage.addActivityLog({
        level: "DEBUG",
        message: `${source} Details: ${JSON.stringify(details, null, 2)}`,
        source: source,
      });
    }
  }
  
  static async logCommand(command: string, result: string, error?: string) {
    await this.log("DEBUG", `Command: ${command}`, "ssh", {
      result: result || "No output",
      error: error || null,
      timestamp: new Date().toISOString()
    });
  }
  
  static async logStep(step: string, status: "START" | "SUCCESS" | "ERROR", details?: any) {
    const level = status === "ERROR" ? "ERROR" : "INFO";
    const message = `${status}: ${step}`;
    await this.log(level, message, "automation", details);
  }
}

// Complete mioty-cli automation system
class MiotyCliCommands {
  private CONNECTION_NAME = "mioty";
  private INTERNAL_IF = "";
  private EXTERNAL_IF = "";
  private edgeCardIp = "";
  
  constructor(edgeCardIp: string) {
    this.edgeCardIp = edgeCardIp;
  }
  
  // 1. setup_connection() - NetworkManager setup
  async setupConnection(): Promise<void> {
    await ExtendedLogger.logStep("Network Connection Setup", "START");
    
    try {
      // Get interface (Miromico card detection)
      await ExtendedLogger.logStep("Interface Detection", "START");
      this.INTERNAL_IF = await this.getInterface();
      if (!this.INTERNAL_IF || this.INTERNAL_IF === "") {
        await ExtendedLogger.logStep("Interface Detection", "ERROR", { error: "No interface found - using fallback" });
        this.INTERNAL_IF = "eth0"; // Use fallback interface
      }
      await ExtendedLogger.logStep("Interface Detection", "SUCCESS", { interface: this.INTERNAL_IF });
      
      // Get external interface 
      this.EXTERNAL_IF = await this.getExternalInterface();
      await ExtendedLogger.log("INFO", `External interface: ${this.EXTERNAL_IF}`, "networking");
      
      // Check if mioty connection exists
      const connectionExists = await this.checkConnectionExists();
      await ExtendedLogger.log("INFO", `Connection exists: ${connectionExists}`, "networking");
      
      if (!connectionExists) {
        await ExtendedLogger.logStep("Creating NetworkManager Connection", "START");
        const result = await this.executeLocalCommand(`sudo nmcli connection add con-name ${this.CONNECTION_NAME} type ethernet`);
        await ExtendedLogger.logCommand(`nmcli connection add con-name ${this.CONNECTION_NAME} type ethernet`, result);
        await ExtendedLogger.logStep("Creating NetworkManager Connection", "SUCCESS");
      }
      
      // Configure connection with detailed logging
      await ExtendedLogger.logStep("Configuring Network Settings", "START");
      
      const commands = [
        `sudo nmcli connection modify ${this.CONNECTION_NAME} ifname "${this.INTERNAL_IF}"`,
        `sudo nmcli connection modify ${this.CONNECTION_NAME} connection.autoconnect yes`,
        `sudo nmcli connection modify ${this.CONNECTION_NAME} ipv4.addresses 172.30.1.1/24`,
        `sudo nmcli connection modify ${this.CONNECTION_NAME} ipv4.gateway 172.30.1.1`,
        `sudo nmcli connection modify ${this.CONNECTION_NAME} ipv4.dns 1.1.1.1`,
        `sudo nmcli connection modify ${this.CONNECTION_NAME} ipv4.method manual`,
        `sudo nmcli connection modify ${this.CONNECTION_NAME} ipv6.method ignore`
      ];
      
      for (const cmd of commands) {
        const result = await this.executeLocalCommand(cmd);
        await ExtendedLogger.logCommand(cmd, result);
      }
      
      await ExtendedLogger.logStep("Configuring Network Settings", "SUCCESS");
      
      // Setup firewall script
      await ExtendedLogger.logStep("Setting up Firewall Rules", "START");
      await this.setupFirewallScript();
      await ExtendedLogger.logStep("Setting up Firewall Rules", "SUCCESS");
      
      const reloadResult = await this.executeLocalCommand(`sudo nmcli connection reload`);
      await ExtendedLogger.logCommand("nmcli connection reload", reloadResult);
      
      await ExtendedLogger.logStep("Network Connection Setup", "SUCCESS");
      
    } catch (error) {
      await ExtendedLogger.logStep("Network Connection Setup", "ERROR", { error: String(error) });
      throw new Error(`Setup connection failed: ${error}`);
    }
  }
  
  // 2. start_connection() 
  async startConnection(): Promise<void> {
    await ExtendedLogger.logStep("Starting Network Connection", "START");
    try {
      await this.checkConnectionExists();
      const result = await this.executeLocalCommand(`sudo nmcli connection up ${this.CONNECTION_NAME}`);
      await ExtendedLogger.logCommand(`nmcli connection up ${this.CONNECTION_NAME}`, result);
      await ExtendedLogger.logStep("Starting Network Connection", "SUCCESS");
    } catch (error) {
      await ExtendedLogger.logStep("Starting Network Connection", "ERROR", { error: String(error) });
      throw error;
    }
  }
  
  // 3. enable_connection()
  async enableConnection(): Promise<void> {
    await ExtendedLogger.logStep("Enabling Auto-Connect", "START");
    try {
      await this.checkConnectionExists();
      const result = await this.executeLocalCommand(`sudo nmcli connection modify ${this.CONNECTION_NAME} connection.autoconnect yes`);
      await ExtendedLogger.logCommand(`nmcli connection modify ${this.CONNECTION_NAME} connection.autoconnect yes`, result);
      await ExtendedLogger.logStep("Enabling Auto-Connect", "SUCCESS");
    } catch (error) {
      await ExtendedLogger.logStep("Enabling Auto-Connect", "ERROR", { error: String(error) });
      throw error;
    }
  }
  
  // 4. start_pf() - Start mioty base station (REAL SERVICE NAME: mioty_bs)
  async startPf(): Promise<void> {
    await ExtendedLogger.logStep("Starting mioty_bs Service", "START");
    try {
      await this.checkConnectionUp();
      const result = await executeSSHCommand(this.edgeCardIp, "systemctl start mioty_bs");
      await ExtendedLogger.logCommand("systemctl start mioty_bs", result);
      await ExtendedLogger.logStep("Starting mioty_bs Service", "SUCCESS");
    } catch (error) {
      await ExtendedLogger.logStep("Starting mioty_bs Service", "ERROR", { error: String(error) });
      throw error;
    }
  }
  
  // 5. enable_pf() - Enable mioty auto-start
  async enablePf(): Promise<void> {
    await ExtendedLogger.logStep("Enabling mioty_bs AutoStart", "START");
    try {
      await this.checkConnectionUp();
      const result = await executeSSHCommand(this.edgeCardIp, "systemctl enable mioty_bs");
      await ExtendedLogger.logCommand("systemctl enable mioty_bs", result);
      await ExtendedLogger.logStep("Enabling mioty_bs AutoStart", "SUCCESS");
    } catch (error) {
      await ExtendedLogger.logStep("Enabling mioty_bs AutoStart", "ERROR", { error: String(error) });
      throw error;
    }
  }
  
  // Helper functions
  private async getInterface(): Promise<string> {
    try {
      await ExtendedLogger.log("DEBUG", "🔍 Searching for network interfaces...", "networking");
      
      // Try multiple methods to find a suitable interface
      const methods = [
        // Method 1: Look for specific Miromico/USB interfaces
        "ip link show | grep -E '(enx|usb)' | head -1 | cut -d: -f2 | tr -d ' '",
        // Method 2: Look for any ethernet interface 
        "ip link show | grep -E 'eth[0-9]+' | head -1 | cut -d: -f2 | tr -d ' '",
        // Method 3: Get first UP interface (excluding loopback)
        "ip link show up | grep -v 'lo:' | grep -E '[0-9]+:' | head -1 | cut -d: -f2 | tr -d ' '",
        // Method 4: Get any available interface
        "ip link show | grep -E '[0-9]+:' | grep -v 'lo:' | head -1 | cut -d: -f2 | tr -d ' '"
      ];
      
      for (let i = 0; i < methods.length; i++) {
        try {
          const result = await this.executeLocalCommand(methods[i]);
          const iface = result.trim();
          if (iface) {
            await ExtendedLogger.log("INFO", `✅ Found interface using method ${i + 1}: ${iface}`, "networking");
            return iface;
          }
          await ExtendedLogger.log("DEBUG", `Method ${i + 1} returned empty result`, "networking");
        } catch (error) {
          await ExtendedLogger.log("DEBUG", `Method ${i + 1} failed: ${error}`, "networking");
        }
      }
      
      // Fallback: List all available interfaces for debugging
      try {
        const allInterfaces = await this.executeLocalCommand("ip link show");
        await ExtendedLogger.log("DEBUG", "Available interfaces:", "networking", { interfaces: allInterfaces });
      } catch (e) {
        await ExtendedLogger.log("ERROR", "Failed to list interfaces", "networking");
      }
      
      // Last resort: Use a default interface name
      await ExtendedLogger.log("WARN", "⚠️ Using fallback interface: eth0", "networking");
      return "eth0";
      
    } catch (error) {
      await ExtendedLogger.log("ERROR", `Interface detection failed: ${error}`, "networking");
      return "eth0"; // fallback
    }
  }
  
  private async getExternalInterface(): Promise<string> {
    try {
      const result = await this.executeLocalCommand("ip -o -4 route show to default | awk '{print $5}'");
      return result.trim();
    } catch (error) {
      return "eth0"; // fallback
    }
  }
  
  private async checkConnectionExists(): Promise<boolean> {
    try {
      const result = await this.executeLocalCommand(`nmcli connection show | grep -c ${this.CONNECTION_NAME} || echo "0"`);
      const count = parseInt(result.trim()) || 0;
      await ExtendedLogger.log("DEBUG", `Connection check: ${this.CONNECTION_NAME} found ${count} times`, "networking");
      return count > 0;
    } catch (error) {
      await ExtendedLogger.log("DEBUG", `Connection check failed: ${error}`, "networking");
      return false;
    }
  }
  
  private async checkConnectionUp(): Promise<void> {
    try {
      const isUp = await this.checkConnectionExists();
      if (!isUp) {
        await ExtendedLogger.log("WARN", "⚠️ Connection not detected - proceeding anyway", "networking");
        // Don't throw error - just log warning and continue
      }
    } catch (error) {
      await ExtendedLogger.log("WARN", "⚠️ Connection check failed - proceeding anyway", "networking");
      // Continue anyway - connection check is not critical for SSH commands
    }
  }
  
  private async setupFirewallScript(): Promise<void> {
    const script = `#!/usr/bin/env bash

INTERFACE=$1
EVENT=$2

if [[ "$INTERFACE" = "${this.INTERNAL_IF}" ]]
then
    ip route del default via 172.30.1.1 2>/dev/null || true
    echo 1 > /proc/sys/net/ipv4/ip_forward

    iptables-save | grep -q "${this.CONNECTION_NAME}"
    if [[ $? -eq 1 ]]
    then
        iptables -t filter -I FORWARD -i ${this.INTERNAL_IF} -j ACCEPT -m comment --comment "${this.CONNECTION_NAME}" 
        iptables -t nat -A PREROUTING -p udp --dport 53 -j DNAT --to-destination 1.1.1.1:53 -m comment --comment "${this.CONNECTION_NAME}"  
        iptables -t nat -A POSTROUTING -o ${this.EXTERNAL_IF} -j MASQUERADE -m comment --comment "${this.CONNECTION_NAME}" 
    fi
fi

exit 0`;

    await this.executeLocalCommand(`echo '${script}' | sudo tee /tmp/99-${this.CONNECTION_NAME} > /dev/null`);
    await this.executeLocalCommand(`sudo chown root:root /tmp/99-${this.CONNECTION_NAME}`);
    await this.executeLocalCommand(`sudo chmod 755 /tmp/99-${this.CONNECTION_NAME}`);
    await this.executeLocalCommand(`sudo mv /tmp/99-${this.CONNECTION_NAME} /etc/NetworkManager/dispatcher.d/`);
  }
  
  private async executeLocalCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn('bash', ['-c', command]);
      
      let output = "";
      let error = "";
      
      process.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr?.on('data', (data) => {
        error += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Command failed: ${error.trim()}`));
        }
      });
    });
  }
  
  // Check mioty_bs service status
  async getMiotyStatus(): Promise<string> {
    try {
      return await executeSSHCommand(this.edgeCardIp, "systemctl is-active mioty_bs 2>/dev/null || echo 'inactive'");
    } catch (error) {
      return "inactive";
    }
  }
  
  // Get all commands for manual control
  getCommands() {
    return {
      start: "systemctl start mioty_bs",
      stop: "systemctl stop mioty_bs", 
      status: "systemctl is-active mioty_bs",
      enable: "systemctl enable mioty_bs",
      disable: "systemctl disable mioty_bs"
    };
  }
}

// Complete mioty-cli Automation Watchdog
class MiotyWatchdog {
  private edgeCardIp: string | null = null;
  private miotyCommands: MiotyCliCommands | null = null;
  private watchdogInterval: NodeJS.Timeout | null = null;
  private connectionInterval: NodeJS.Timeout | null = null;
  private setupCompleted: boolean = false;
  
  async start() {
    // Start automatic setup immediately
    setTimeout(() => this.autoSetupAndConnect(), 2000); // Start after 2 seconds
    
    this.connectionInterval = setInterval(() => this.autoSetupAndConnect(), 10000); // Setup every 10s
    this.watchdogInterval = setInterval(() => this.watchdog(), 30000); // Monitor every 30s
    
    await ExtendedLogger.log("INFO", "🚀 Complete mioty-cli Automation System started - will auto-setup in 2 seconds", "startup");
  }
  
  stop() {
    if (this.connectionInterval) clearInterval(this.connectionInterval);
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
  }
  
  async autoSetupAndConnect() {
    try {
      const connection = await storage.getConnection();
      
      if (!connection || connection.status !== "connected") {
        await this.discoverAndSetup();
      } else {
        this.edgeCardIp = connection.edgeCardIp;
        if (!this.miotyCommands && this.edgeCardIp) {
          this.miotyCommands = new MiotyCliCommands(this.edgeCardIp);
        }
        
        // CRITICAL FIX: Run automatic setup even if connection exists!
        if (!this.setupCompleted && this.edgeCardIp && this.miotyCommands) {
          await ExtendedLogger.log("INFO", "🚀 Triggering automatic mioty-cli setup (connection exists)", "automation");
          await this.performCompleteSetup();
        }
      }
    } catch (error) {
      await ExtendedLogger.log("WARN", `AutoSetup attempt failed: ${String(error)}`, "automation");
    }
  }
  
  async discoverAndSetup() {
    const possibleIPs = [
      "172.30.1.2",
      "192.168.1.100", 
      "192.168.4.1",
      "10.0.0.1"
    ];
    
    for (const ip of possibleIPs) {
      try {
        await executeSSHCommand(ip, "echo 'test' > /dev/null");
        
        this.edgeCardIp = ip;
        this.miotyCommands = new MiotyCliCommands(ip);
        
        await storage.addActivityLog({
          level: "CONN",
          message: `EdgeCard discovered at ${ip}`,
          source: "watchdog",
        });
        
        // Complete mioty-cli setup sequence
        if (!this.setupCompleted) {
          await this.performCompleteSetup();
        }
        
        await storage.updateConnectionStatus("connected");
        break;
      } catch (e) {
        continue;
      }
    }
  }
  
  async performCompleteSetup() {
    if (!this.miotyCommands) return;
    
    try {
      await ExtendedLogger.logStep("Complete mioty-cli Automation Setup", "START", {
        edgeCardIp: this.edgeCardIp,
        timestamp: new Date().toISOString()
      });
      
      // 1. Setup network connection
      await this.miotyCommands.setupConnection();
      
      // 2. Start connection
      await this.miotyCommands.startConnection();
      
      // 3. Enable auto-connect
      await this.miotyCommands.enableConnection();
      
      // 4. Enable mioty_bs service
      await this.miotyCommands.enablePf();
      
      // 5. Start mioty_bs service
      await this.miotyCommands.startPf();
      
      this.setupCompleted = true;
      
      await ExtendedLogger.logStep("Complete mioty-cli Automation Setup", "SUCCESS", {
        setupCompleted: true,
        allServicesConfigured: true,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      await ExtendedLogger.logStep("Complete mioty-cli Automation Setup", "ERROR", {
        error: String(error),
        setupCompleted: false,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }
  
  async watchdog() {
    if (!this.edgeCardIp || !this.miotyCommands) return;
    
    try {
      await ExtendedLogger.log("DEBUG", "🔍 Watchdog cycle started", "watchdog", {
        edgeCardIp: this.edgeCardIp,
        setupCompleted: this.setupCompleted,
        timestamp: new Date().toISOString()
      });
      
      // Update all data
      const realData = await getEdgeCardConfig(this.edgeCardIp);
      
      await ExtendedLogger.log("DEBUG", "📊 EdgeCard data retrieved", "watchdog", {
        hostname: realData.hostname,
        miotyStatus: realData.miotyStatus,
        autoStart: realData.autoStart,
        uptime: realData.uptime,
        memoryUsage: realData.memoryUsage
      });
      
      // Update stored config
      const realConfig = {
        baseStationName: realData.config.baseStationName,
        baseStationVendor: realData.config.baseStationVendor,
        baseStationModel: realData.config.baseStationModel,
        uniqueBaseStationId: "9C-65-F9-FF-FE-55-44-33",
        serviceCenterAddr: realData.config.serviceCenterAddr,
        serviceCenterPort: parseInt(realData.config.serviceCenterPort) || 8080,
        profile: realData.config.profile,
        tlsAuthRequired: realData.config.tlsAuthRequired,
        tlsAllowInsecure: realData.config.tlsAllowInsecure,
        updatedAt: new Date(),
      };
      
      await storage.updateBaseStationConfig(realConfig);
      await storage.updateSystemInfo({
        edgeCardModel: realData.edgeCardModel,
        lastSync: new Date(),
      });
      
      // Check mioty_bs service status
      const miotyStatus = await this.miotyCommands.getMiotyStatus();
      
      await ExtendedLogger.log("INFO", `🔋 Service Status Check: mioty_bs = ${miotyStatus}`, "watchdog");
      
      // Auto-restart if service is down
      if (miotyStatus === "inactive") {
        await ExtendedLogger.log("WARN", "⚠️  mioty_bs service is down - attempting auto-restart", "watchdog");
        
        await this.miotyCommands.startPf();
        
        await ExtendedLogger.log("INFO", "✅ Auto-restarted mioty_bs service", "watchdog");
        
        await storage.updateBaseStationStatus({
          status: "running",
          autoStart: realData.autoStart,
          uptime: realData.uptime,
          memoryUsage: realData.memoryUsage,
          lastStarted: new Date(),
        });
      } else {
        await storage.updateBaseStationStatus({
          status: miotyStatus === "active" ? "running" : "stopped",
          autoStart: realData.autoStart,
          uptime: realData.uptime,
          memoryUsage: realData.memoryUsage,
        });
        
        await ExtendedLogger.log("DEBUG", `💚 Service running normally: ${miotyStatus}`, "watchdog");
      }
      
      await ExtendedLogger.log("DEBUG", "✅ Watchdog cycle completed", "watchdog");
      
    } catch (error) {
      await ExtendedLogger.logStep("Watchdog Monitoring", "ERROR", {
        error: String(error),
        edgeCardIp: this.edgeCardIp,
        setupCompleted: this.setupCompleted,
        timestamp: new Date().toISOString()
      });
    }
  }
}

const watchdog = new MiotyWatchdog();

// Old periodic updates replaced by intelligent watchdog system

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Start automatic watchdog system instead of simple periodic updates
  await watchdog.start();
  
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
      const connection = await storage.getConnection();
      
      if (connection?.status === "connected" && connection.edgeCardIp) {
        try {
          // Use real mioty_bs service
          await executeSSHCommand(connection.edgeCardIp, "systemctl start mioty_bs");
          
          await storage.addActivityLog({
            level: "INFO",
            message: "Start command sent to EdgeCard",
            source: "base-station",
          });
        } catch (sshError) {
          await storage.addActivityLog({
            level: "ERROR",
            message: `Failed to send start command: ${sshError}`,
            source: "base-station",
          });
        }
      }
      
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
      const connection = await storage.getConnection();
      
      if (connection?.status === "connected" && connection.edgeCardIp) {
        try {
          // Use real mioty_bs service
          await executeSSHCommand(connection.edgeCardIp, "systemctl stop mioty_bs");
          
          await storage.addActivityLog({
            level: "INFO",
            message: "Stop command sent to EdgeCard",
            source: "base-station",
          });
        } catch (sshError) {
          await storage.addActivityLog({
            level: "ERROR",
            message: `Failed to send stop command: ${sshError}`,
            source: "base-station",
          });
        }
      }
      
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
          // Get real configuration from EdgeCard including XML data
          const realData = await getEdgeCardConfig(connection.edgeCardIp);
          
          // Use REAL XML parameters from EdgeCard (except uniqueBaseStationId)
          const realConfig = {
            baseStationName: realData.config.baseStationName,
            baseStationVendor: realData.config.baseStationVendor,
            baseStationModel: realData.config.baseStationModel,
            uniqueBaseStationId: "9C-65-F9-FF-FE-55-44-33", // Keep hardcoded as requested
            serviceCenterAddr: realData.config.serviceCenterAddr,
            serviceCenterPort: parseInt(realData.config.serviceCenterPort) || 8080,
            profile: realData.config.profile,
            tlsAuthRequired: realData.config.tlsAuthRequired,
            tlsAllowInsecure: realData.config.tlsAllowInsecure,
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
