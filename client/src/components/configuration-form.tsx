import { useState, useEffect } from "react";
import { Settings, RefreshCw, Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMioty } from "@/hooks/use-mioty";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBaseStationConfigSchema } from "@shared/schema";
import { z } from "zod";

interface ConfigurationFormProps {
  onShowLoading: (text: string) => void;
  onHideLoading: () => void;
  onShowToast: (title: string, description: string, variant?: "default" | "destructive") => void;
}

type ConfigFormData = z.infer<typeof insertBaseStationConfigSchema>;

export default function ConfigurationForm({ 
  onShowLoading, 
  onHideLoading, 
  onShowToast 
}: ConfigurationFormProps) {
  const { config } = useMioty();
  const queryClient = useQueryClient();

  const form = useForm<ConfigFormData>({
    resolver: zodResolver(insertBaseStationConfigSchema),
    defaultValues: {
      uniqueBaseStationId: "",
      baseStationName: "",
      baseStationVendor: "",
      baseStationModel: "",
      serviceCenterAddr: "",
      serviceCenterPort: 8883,
      profile: "EU1",
      tlsAuthRequired: true,
    },
  });

  // Update form values when config data is loaded
  useEffect(() => {
    if (config) {
      form.reset({
        uniqueBaseStationId: config.uniqueBaseStationId || "",
        baseStationName: config.baseStationName || "",
        baseStationVendor: config.baseStationVendor || "",
        baseStationModel: config.baseStationModel || "",
        serviceCenterAddr: config.serviceCenterAddr || "",
        serviceCenterPort: config.serviceCenterPort || 8883,
        profile: config.profile || "EU1",
        tlsAuthRequired: config.tlsAuthRequired !== undefined ? config.tlsAuthRequired : true,
      });
    }
  }, [config, form]);

  const saveMutation = useMutation({
    mutationFn: (data: ConfigFormData) => apiRequest("PUT", "/api/config", data),
    onMutate: () => onShowLoading("Saving configuration..."),
    onSuccess: () => {
      onHideLoading();
      onShowToast("Success", "Configuration saved successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
    },
    onError: () => {
      onHideLoading();
      onShowToast("Error", "Failed to save configuration", "destructive");
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest("GET", "/api/config"),
    onMutate: () => onShowLoading("Fetching configuration..."),
    onSuccess: () => {
      onHideLoading();
      onShowToast("Success", "Configuration refreshed");
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
    },
    onError: () => {
      onHideLoading();
      onShowToast("Error", "Failed to refresh configuration", "destructive");
    },
  });

  const onSubmit = (data: ConfigFormData) => {
    saveMutation.mutate(data);
  };

  const InfoTooltip = ({ content }: { content: string }) => (
    <Tooltip>
      <TooltipTrigger>
        <Info className="h-4 w-4 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs">{content}</p>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <Card data-testid="configuration-form-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Base Station Configuration</span>
          <div className="flex space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              data-testid="button-refresh-config"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={form.handleSubmit(onSubmit)}
              disabled={saveMutation.isPending}
              data-testid="button-save-config"
            >
              <Save className="h-4 w-4 mr-1" />
              Save Changes
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <Label className="flex items-center gap-2">
                  Unique Base Station ID
                  <InfoTooltip content="Unique identifier for this base station" />
                </Label>
                <Input
                  {...form.register("uniqueBaseStationId")}
                  className="font-mono text-sm"
                  data-testid="input-unique-base-station-id"
                />
              </div>
              
              <div>
                <Label className="flex items-center gap-2">
                  Base Station Name
                  <InfoTooltip content="Human-readable name for this base station" />
                </Label>
                <Input
                  {...form.register("baseStationName")}
                  data-testid="input-base-station-name"
                />
              </div>
              
              <div>
                <Label className="flex items-center gap-2">
                  Base Station Vendor
                  <InfoTooltip content="Vendor information" />
                </Label>
                <Input
                  {...form.register("baseStationVendor")}
                  data-testid="input-base-station-vendor"
                />
              </div>
              
              <div>
                <Label className="flex items-center gap-2">
                  Base Station Model
                  <InfoTooltip content="Hardware model identifier" />
                </Label>
                <Input
                  {...form.register("baseStationModel")}
                  data-testid="input-base-station-model"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label className="flex items-center gap-2">
                  Service Center Address
                  <InfoTooltip content="Server address for mioty backend service" />
                </Label>
                <Input
                  {...form.register("serviceCenterAddr")}
                  className="font-mono text-sm"
                  data-testid="input-service-center-addr"
                />
              </div>
              
              <div>
                <Label className="flex items-center gap-2">
                  Service Center Port
                  <InfoTooltip content="Port number for backend service" />
                </Label>
                <Input
                  {...form.register("serviceCenterPort", { valueAsNumber: true })}
                  type="number"
                  className="font-mono text-sm"
                  data-testid="input-service-center-port"
                />
              </div>
              
              <div>
                <Label className="flex items-center gap-2">
                  Profile
                  <InfoTooltip content="Operating profile for the base station" />
                </Label>
                <Select 
                  value={form.watch("profile")} 
                  onValueChange={(value) => form.setValue("profile", value)}
                >
                  <SelectTrigger data-testid="select-profile">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EU1">EU1 (868 MHz)</SelectItem>
                    <SelectItem value="US1">US1 (915 MHz)</SelectItem>
                    <SelectItem value="AS1">AS1 (923 MHz)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="flex items-center gap-2">
                  TLS Authentication
                  <InfoTooltip content="Enable TLS authentication for secure communication" />
                </Label>
                <div className="flex items-center space-x-2 mt-2">
                  <Checkbox
                    id="tlsAuth"
                    checked={form.watch("tlsAuthRequired") || false}
                    onCheckedChange={(checked) => form.setValue("tlsAuthRequired", !!checked)}
                    data-testid="checkbox-tls-auth"
                  />
                  <Label htmlFor="tlsAuth" className="text-sm">Required</Label>
                </div>
              </div>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
