import { useState, useRef } from "react";
import { Tag, Upload, Trash2, FileCheck, FileX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMioty } from "@/hooks/use-mioty";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface CertificateManagementProps {
  onShowLoading: (text: string) => void;
  onHideLoading: () => void;
  onShowToast: (title: string, description: string, variant?: "default" | "destructive") => void;
}

export default function CertificateManagement({ 
  onShowLoading, 
  onHideLoading, 
  onShowToast 
}: CertificateManagementProps) {
  const { certificates } = useMioty();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("certificate", file);
      
      const response = await fetch("/api/certificates/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
      
      return response.json();
    },
    onMutate: (file) => onShowLoading(`Uploading ${file.name}...`),
    onSuccess: (_, file) => {
      onHideLoading();
      onShowToast("Success", `Tag ${file.name} uploaded successfully`);
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
    },
    onError: (error: Error) => {
      onHideLoading();
      onShowToast("Error", error.message || "Failed to upload certificate", "destructive");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (filename: string) => apiRequest("DELETE", `/api/certificates/${filename}`),
    onMutate: (filename) => onShowLoading(`Removing ${filename}...`),
    onSuccess: (_, filename) => {
      onHideLoading();
      onShowToast("Success", `Tag ${filename} removed`);
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
    },
    onError: () => {
      onHideLoading();
      onShowToast("Error", "Failed to remove certificate", "destructive");
    },
  });

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const validExtensions = [".cer", ".key"];
      const validFilenames = ["bstation.cer", "bstation.key", "root_ca.cer"];
      
      if (!validExtensions.some(ext => file.name.endsWith(ext))) {
        onShowToast("Error", `Invalid file type: ${file.name}. Only .cer and .key files are supported.`, "destructive");
        return;
      }
      
      if (!validFilenames.includes(file.name)) {
        onShowToast("Error", `Invalid filename: ${file.name}. Valid names are: ${validFilenames.join(", ")}`, "destructive");
        return;
      }
      
      uploadMutation.mutate(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleRemove = (filename: string) => {
    if (confirm(`Are you sure you want to remove ${filename}?`)) {
      deleteMutation.mutate(filename);
    }
  };

  const getCertificateIcon = (type: string, status: string) => {
    if (status === "missing") {
      return <FileX className="h-5 w-5 text-muted-foreground" />;
    }
    return type === "key" ? 
      <FileCheck className="h-5 w-5 text-muted-foreground" /> : 
      <Tag className="h-5 w-5 text-accent" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "valid":
        return (
          <Badge className="bg-accent/10 text-accent border-accent/20" data-testid={`status-${status}`}>
            <span className="status-indicator status-connected" />
            Valid
          </Badge>
        );
      case "missing":
        return (
          <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20" data-testid={`status-${status}`}>
            <span className="status-indicator status-disconnected" />
            Missing
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" data-testid={`status-${status}`}>
            {status}
          </Badge>
        );
    }
  };

  return (
    <Card data-testid="certificate-management-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Tag Management</span>
          <Tag className="h-5 w-5 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div 
          className={`drag-zone p-6 rounded-lg text-center transition-colors ${
            dragOver ? "drag-over" : ""
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          data-testid="certificate-upload-area"
        >
          <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-2">Drag and drop certificate files here</p>
          <p className="text-xs text-muted-foreground mb-3">Supported: .cer, .key files</p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            data-testid="button-select-files"
          >
            <Upload className="h-4 w-4 mr-1" />
            Select Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".cer,.key"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
            data-testid="file-input"
          />
        </div>
        
        {/* Tag List */}
        <div className="space-y-3">
          {certificates?.map((cert) => (
            <div 
              key={cert.filename} 
              className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
              data-testid={`certificate-${cert.filename}`}
            >
              <div className="flex items-center space-x-3">
                {getCertificateIcon(cert.type, cert.status)}
                <div>
                  <p className="text-sm font-medium text-card-foreground">{cert.filename}</p>
                  <p className="text-xs text-muted-foreground">{cert.description}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusBadge(cert.status)}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(cert.filename)}
                  disabled={cert.status === "missing" || deleteMutation.isPending}
                  className="p-1 h-auto"
                  data-testid={`button-remove-${cert.filename}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          
          {(!certificates || certificates.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No certificates uploaded</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
