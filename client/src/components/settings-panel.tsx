import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Cloud, 
  Wifi, 
  Scale, 
  Usb, 
  Save, 
  TestTube,
  CheckCircle,
  XCircle
} from "lucide-react";

interface SettingsCategory {
  api: {
    endpoint: string;
    authMethod: string;
    apiKey: string;
    syncInterval: number;
    retryAttempts: number;
  };
  mqtt: {
    host: string;
    port: number;
    weightTopic: string;
    qos: number;
  };
  serial: {
    port: string;
    baudRate: number;
    dataBits: number;
    stopBits: number;
    parity: string;
  };
  tolerance: {
    toleranceRange: number;
    weightSourcePriority: string;
    validationAction: string;
  };
}

export function SettingsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [settings, setSettings] = useState<SettingsCategory>({
    api: {
      endpoint: "",
      authMethod: "bearer",
      apiKey: "",
      syncInterval: 30,
      retryAttempts: 3
    },
    mqtt: {
      host: "localhost",
      port: 1883,
      weightTopic: "/plc/weight/data",
      qos: 1
    },
    serial: {
      port: "COM1",
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: "none"
    },
    tolerance: {
      toleranceRange: 0.05,
      weightSourcePriority: "plc",
      validationAction: "log"
    }
  });

  const [connectionStatus, setConnectionStatus] = useState<{
    api: boolean | null;
    mqtt: boolean | null;
    serial: boolean | null;
  }>({
    api: null,
    mqtt: null,
    serial: null
  });

  // Load settings for each category
  const { data: apiSettings } = useQuery({
    queryKey: ['/api/settings/api']
  });

  const { data: mqttSettings } = useQuery({
    queryKey: ['/api/settings/mqtt']
  });

  const { data: serialSettings } = useQuery({
    queryKey: ['/api/settings/serial']
  });

  const { data: toleranceSettings } = useQuery({
    queryKey: ['/api/settings/tolerance']
  });

  // Load settings when data is available
  useEffect(() => {
    if (apiSettings) {
      setSettings(prev => ({ ...prev, api: { ...prev.api, ...apiSettings } }));
    }
  }, [apiSettings]);

  useEffect(() => {
    if (mqttSettings) {
      setSettings(prev => ({ ...prev, mqtt: { ...prev.mqtt, ...mqttSettings } }));
    }
  }, [mqttSettings]);

  useEffect(() => {
    if (serialSettings) {
      setSettings(prev => ({ ...prev, serial: { ...prev.serial, ...serialSettings } }));
    }
  }, [serialSettings]);

  useEffect(() => {
    if (toleranceSettings) {
      setSettings(prev => ({ ...prev, tolerance: { ...prev.tolerance, ...toleranceSettings } }));
    }
  }, [toleranceSettings]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async ({ category, data }: { category: keyof SettingsCategory, data: any }) => {
      const response = await apiRequest('POST', `/api/settings/${category}`, data);
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: `${variables.category.toUpperCase()} settings saved successfully`
      });
      // Invalidate and refetch the specific category's settings
      queryClient.invalidateQueries({ 
        queryKey: [`/api/settings/${variables.category}`],
        exact: true
      });
      // Also refetch immediately to update UI
      queryClient.refetchQueries({ 
        queryKey: [`/api/settings/${variables.category}`],
        exact: true
      });
    },
    onError: (_, variables) => {
      toast({
        title: "Error",
        description: `Failed to save ${variables.category.toUpperCase()} settings`,
        variant: "destructive"
      });
    }
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/test-connection');
      return response.json();
    },
    onSuccess: (data) => {
      setConnectionStatus(prev => ({ ...prev, api: data.success }));
      toast({
        title: data.success ? "Success" : "Error",
        description: data.success ? "API connection successful" : `Connection failed: ${data.error}`,
        variant: data.success ? "default" : "destructive"
      });
    },
    onError: () => {
      setConnectionStatus(prev => ({ ...prev, api: false }));
      toast({
        title: "Error",
        description: "Connection test failed",
        variant: "destructive"
      });
    }
  });

  const handleSaveCategory = (category: keyof SettingsCategory) => {
    saveSettingsMutation.mutate({
      category,
      data: settings[category]
    });
  };

  const handleSaveAll = () => {
    Object.keys(settings).forEach(category => {
      handleSaveCategory(category as keyof SettingsCategory);
    });
  };

  const updateSetting = (category: keyof SettingsCategory, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  const getConnectionBadge = (status: boolean | null, label: string) => {
    if (status === null) {
      return <Badge variant="secondary" data-testid={`connection-${label.toLowerCase()}`}>Not Tested</Badge>;
    }
    return (
      <Badge 
        className={status 
          ? "bg-green-500/20 text-green-400 border-green-500/30" 
          : "bg-red-500/20 text-red-400 border-red-500/30"
        }
        data-testid={`connection-${label.toLowerCase()}`}
      >
        {status ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
        {status ? "Connected" : "Failed"}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* API Configuration */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-3" data-testid="heading-api-config">
            <Cloud className="text-accent" />
            API Configuration
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="apiEndpoint" className="text-xs text-muted-foreground">API Endpoint URL</Label>
                <Input
                  id="apiEndpoint"
                  type="url"
                  placeholder="https://api.weighing-service.com/v1"
                  value={settings.api.endpoint}
                  onChange={(e) => updateSetting('api', 'endpoint', e.target.value)}
                  className="mt-2"
                  data-testid="input-api-endpoint"
                />
              </div>
              <div>
                <Label htmlFor="authMethod" className="text-xs text-muted-foreground">Authentication Method</Label>
                <Select 
                  value={settings.api.authMethod} 
                  onValueChange={(value) => updateSetting('api', 'authMethod', value)}
                >
                  <SelectTrigger className="mt-2" data-testid="select-auth-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="apikey">API Key</SelectItem>
                    <SelectItem value="basic">Basic Auth</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="syncInterval" className="text-xs text-muted-foreground">Sync Interval (seconds)</Label>
                <Input
                  id="syncInterval"
                  type="number"
                  value={settings.api.syncInterval}
                  onChange={(e) => updateSetting('api', 'syncInterval', parseInt(e.target.value))}
                  className="mt-2"
                  data-testid="input-sync-interval"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="apiKey" className="text-xs text-muted-foreground">API Key / Token</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter API credentials"
                  value={settings.api.apiKey}
                  onChange={(e) => updateSetting('api', 'apiKey', e.target.value)}
                  className="mt-2"
                  data-testid="input-api-key"
                />
              </div>
              <div>
                <Label htmlFor="retryAttempts" className="text-xs text-muted-foreground">Retry Attempts</Label>
                <Input
                  id="retryAttempts"
                  type="number"
                  value={settings.api.retryAttempts}
                  onChange={(e) => updateSetting('api', 'retryAttempts', parseInt(e.target.value))}
                  className="mt-2"
                  data-testid="input-retry-attempts"
                />
              </div>
              <div className="flex items-center gap-3 pt-4">
                <Button 
                  onClick={() => testConnectionMutation.mutate()}
                  disabled={testConnectionMutation.isPending}
                  data-testid="button-test-connection"
                >
                  <TestTube className="mr-2 h-4 w-4" />
                  Test Connection
                </Button>
                {getConnectionBadge(connectionStatus.api, "API")}
              </div>
              <Button 
                onClick={() => handleSaveCategory('api')}
                disabled={saveSettingsMutation.isPending}
                className="w-full"
                data-testid="button-save-api"
              >
                <Save className="mr-2 h-4 w-4" />
                Save API Settings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MQTT Settings */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-3" data-testid="heading-mqtt-config">
            <Wifi className="text-accent" />
            MQTT Configuration
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="mqttHost" className="text-xs text-muted-foreground">MQTT Broker Host</Label>
                <Input
                  id="mqttHost"
                  type="text"
                  placeholder="mqtt.broker.com"
                  value={settings.mqtt.host}
                  onChange={(e) => updateSetting('mqtt', 'host', e.target.value)}
                  className="mt-2"
                  data-testid="input-mqtt-host"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="mqttPort" className="text-xs text-muted-foreground">Port</Label>
                  <Input
                    id="mqttPort"
                    type="number"
                    value={settings.mqtt.port}
                    onChange={(e) => updateSetting('mqtt', 'port', parseInt(e.target.value))}
                    className="mt-2"
                    data-testid="input-mqtt-port"
                  />
                </div>
                <div>
                  <Label htmlFor="mqttQos" className="text-xs text-muted-foreground">QoS Level</Label>
                  <Select 
                    value={settings.mqtt.qos.toString()} 
                    onValueChange={(value) => updateSetting('mqtt', 'qos', parseInt(value))}
                  >
                    <SelectTrigger className="mt-2" data-testid="select-mqtt-qos">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 - At most once</SelectItem>
                      <SelectItem value="1">1 - At least once</SelectItem>
                      <SelectItem value="2">2 - Exactly once</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="weightTopic" className="text-xs text-muted-foreground">Weight Topic</Label>
                <Input
                  id="weightTopic"
                  type="text"
                  value={settings.mqtt.weightTopic}
                  onChange={(e) => updateSetting('mqtt', 'weightTopic', e.target.value)}
                  className="mt-2"
                  data-testid="input-weight-topic"
                />
              </div>
              <Button 
                onClick={() => handleSaveCategory('mqtt')}
                disabled={saveSettingsMutation.isPending}
                className="w-full"
                data-testid="button-save-mqtt"
              >
                <Save className="mr-2 h-4 w-4" />
                Save MQTT Settings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weight Tolerance Settings */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-3" data-testid="heading-tolerance-config">
            <Scale className="text-accent" />
            Weight Validation Settings
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="toleranceRange" className="text-xs text-muted-foreground">Tolerance Range (kg)</Label>
              <Input
                id="toleranceRange"
                type="number"
                step="0.001"
                value={settings.tolerance.toleranceRange}
                onChange={(e) => updateSetting('tolerance', 'toleranceRange', parseFloat(e.target.value))}
                className="mt-2"
                data-testid="input-tolerance-range"
              />
              <p className="text-xs text-muted-foreground mt-1">Acceptable difference between PLC and Serial</p>
            </div>
            <div>
              <Label htmlFor="weightSource" className="text-xs text-muted-foreground">Weight Source Priority</Label>
              <Select 
                value={settings.tolerance.weightSourcePriority} 
                onValueChange={(value) => updateSetting('tolerance', 'weightSourcePriority', value)}
              >
                <SelectTrigger className="mt-2" data-testid="select-weight-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plc">PLC Weight (Primary)</SelectItem>
                  <SelectItem value="serial">Serial Weight (Primary)</SelectItem>
                  <SelectItem value="average">Average Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="validationAction" className="text-xs text-muted-foreground">Validation Actions</Label>
              <Select 
                value={settings.tolerance.validationAction} 
                onValueChange={(value) => updateSetting('tolerance', 'validationAction', value)}
              >
                <SelectTrigger className="mt-2" data-testid="select-validation-action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="log">Log Warning Only</SelectItem>
                  <SelectItem value="review">Request Manual Review</SelectItem>
                  <SelectItem value="block">Block Weighment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="mt-6">
            <Button 
              onClick={() => handleSaveCategory('tolerance')}
              disabled={saveSettingsMutation.isPending}
              data-testid="button-save-tolerance"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Tolerance Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Serial Port Settings */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-3" data-testid="heading-serial-config">
            <Usb className="text-accent" />
            Serial Port Configuration
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="serialPort" className="text-xs text-muted-foreground">Port</Label>
              <Select 
                value={settings.serial.port} 
                onValueChange={(value) => updateSetting('serial', 'port', value)}
              >
                <SelectTrigger className="mt-2" data-testid="select-serial-port">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COM1">COM1</SelectItem>
                  <SelectItem value="COM2">COM2</SelectItem>
                  <SelectItem value="COM3">COM3</SelectItem>
                  <SelectItem value="COM4">COM4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="baudRate" className="text-xs text-muted-foreground">Baud Rate</Label>
              <Select 
                value={settings.serial.baudRate.toString()} 
                onValueChange={(value) => updateSetting('serial', 'baudRate', parseInt(value))}
              >
                <SelectTrigger className="mt-2" data-testid="select-baud-rate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9600">9600</SelectItem>
                  <SelectItem value="19200">19200</SelectItem>
                  <SelectItem value="38400">38400</SelectItem>
                  <SelectItem value="57600">57600</SelectItem>
                  <SelectItem value="115200">115200</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dataBits" className="text-xs text-muted-foreground">Data Bits</Label>
              <Select 
                value={settings.serial.dataBits.toString()} 
                onValueChange={(value) => updateSetting('serial', 'dataBits', parseInt(value))}
              >
                <SelectTrigger className="mt-2" data-testid="select-data-bits">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="stopBits" className="text-xs text-muted-foreground">Stop Bits</Label>
              <Select 
                value={settings.serial.stopBits.toString()} 
                onValueChange={(value) => updateSetting('serial', 'stopBits', parseInt(value))}
              >
                <SelectTrigger className="mt-2" data-testid="select-stop-bits">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6">
            <Button 
              onClick={() => handleSaveCategory('serial')}
              disabled={saveSettingsMutation.isPending}
              data-testid="button-save-serial"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Serial Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save All Settings */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSaveAll}
          disabled={saveSettingsMutation.isPending}
          className="bg-primary text-primary-foreground px-8 py-3"
          data-testid="button-save-all"
        >
          <Save className="mr-2 h-4 w-4" />
          Save All Settings
        </Button>
      </div>
    </div>
  );
}
