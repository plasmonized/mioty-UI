import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ConnectionManagement from "@/components/connection-management";
import BaseStationControl from "@/components/base-station-control";
import ConfigurationForm from "@/components/configuration-form";
import CertificateManagement from "@/components/certificate-management";
import ActivityLog from "@/components/activity-log";
import SystemInfo from "@/components/system-info";
import FactoryResetModal from "@/components/modals/factory-reset-modal";
import CredentialsModal from "@/components/modals/credentials-modal";
import LoadingOverlay from "@/components/ui/loading-overlay";
import { useMioty } from "@/hooks/use-mioty";
import { apiRequest } from "@/lib/queryClient";

export default function Dashboard() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showFactoryReset, setShowFactoryReset] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Processing...");
  
  const { toast } = useToast();
  const { connection, systemInfo } = useMioty();

  useEffect(() => {
    // Check for saved dark mode preference
    const savedDarkMode = localStorage.getItem("darkMode") === "true";
    setIsDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem("darkMode", newDarkMode.toString());
    
    if (newDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const showLoadingOverlay = (text: string) => {
    setLoadingText(text);
    setIsLoading(true);
  };

  const hideLoadingOverlay = () => {
    setIsLoading(false);
  };

  const showToast = (title: string, description: string, variant: "default" | "destructive" = "default") => {
    toast({
      title,
      description,
      variant,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <img 
                  src="/sentinum-logo.png" 
                  alt="Sentinum Logo" 
                  className="h-8 w-auto"
                  data-testid="logo-icon" 
                />
                <h1 className="text-xl font-bold text-foreground" data-testid="app-title">
                  Sentinum mioty Console for RAKPiOS
                </h1>
              </div>
              <span className="text-sm text-muted-foreground" data-testid="version-text">
                mioty-cli v{systemInfo?.cliVersion || "0.2.5"}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span 
                  className={`status-indicator ${connection?.status === "connected" ? "status-connected" : "status-disconnected"}`}
                  data-testid="connection-indicator"
                />
                <span 
                  className="text-sm font-medium" 
                  data-testid="connection-status"
                >
                  {connection?.status === "connected" ? "Connected" : "Disconnected"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                data-testid="toggle-dark-mode"
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Connection & Status */}
          <div className="lg:col-span-1 space-y-6">
            <ConnectionManagement 
              onShowLoading={showLoadingOverlay}
              onHideLoading={hideLoadingOverlay}
              onShowToast={showToast}
            />
            
            <BaseStationControl 
              onShowLoading={showLoadingOverlay}
              onHideLoading={hideLoadingOverlay}
              onShowToast={showToast}
              onShowFactoryReset={() => setShowFactoryReset(true)}
            />
            
            {/* Quick Actions Card */}
            <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-card-foreground">Quick Actions</h2>
                <i className="fas fa-bolt text-muted-foreground"></i>
              </div>
              
              <div className="space-y-2">
                <Button
                  className="w-full justify-center"
                  data-testid="button-ssh"
                  onClick={() => {
                    if (connection?.status !== "connected") {
                      showToast("Error", "Please establish connection first", "destructive");
                      return;
                    }
                    showToast("SSH Initiated", "SSH connection to EdgeCard initiated. Check your terminal.");
                  }}
                >
                  <i className="fas fa-terminal mr-2"></i> SSH to EdgeCard
                </Button>
                
                <Button
                  className="w-full justify-center"
                  data-testid="button-dashboard"
                  onClick={async () => {
                    if (connection?.status !== "connected") {
                      showToast("Error", "Please establish connection first", "destructive");
                      return;
                    }
                    
                    showLoadingOverlay("Creating SSH tunnel to EdgeCard...");
                    
                    try {
                      // Create SSH tunnel to EdgeCard dashboard
                      const response = await apiRequest("POST", "/api/connection/dashboard");
                      const result = await response.json();
                      hideLoadingOverlay();
                      
                      if (result.success) {
                        showToast("SSH Tunnel Created", 
                          "Please open your browser and go to: http://172.30.1.1:8888 to access the EdgeCard dashboard");
                      } else {
                        showToast("Error", result.message || "Failed to create dashboard tunnel", "destructive");
                      }
                    } catch (error) {
                      hideLoadingOverlay();
                      showToast("Error", "Failed to create dashboard tunnel", "destructive");
                    }
                  }}
                >
                  <i className="fas fa-chart-line mr-2"></i> EdgeCard Dashboard
                </Button>
                
                <Button
                  variant="secondary"
                  className="w-full justify-center"
                  data-testid="button-credentials"
                  onClick={() => setShowCredentials(true)}
                >
                  <i className="fas fa-key mr-2"></i> View Credentials
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column: Configuration & Certificates */}
          <div className="lg:col-span-2 space-y-6">
            <ConfigurationForm 
              onShowLoading={showLoadingOverlay}
              onHideLoading={hideLoadingOverlay}
              onShowToast={showToast}
            />
            
            <CertificateManagement 
              onShowLoading={showLoadingOverlay}
              onHideLoading={hideLoadingOverlay}
              onShowToast={showToast}
            />
            
            <SystemInfo />
          </div>
        </div>

        {/* Activity Log Card */}
        <div className="mt-6">
          <ActivityLog 
            onShowLoading={showLoadingOverlay}
            onHideLoading={hideLoadingOverlay}
            onShowToast={showToast}
          />
        </div>
      </div>

      {/* Modals */}
      <FactoryResetModal 
        open={showFactoryReset}
        onOpenChange={setShowFactoryReset}
        onShowLoading={showLoadingOverlay}
        onHideLoading={hideLoadingOverlay}
        onShowToast={showToast}
      />
      
      <CredentialsModal 
        open={showCredentials}
        onOpenChange={setShowCredentials}
      />

      {/* Loading Overlay */}
      <LoadingOverlay isVisible={isLoading} text={loadingText} />
    </div>
  );
}
