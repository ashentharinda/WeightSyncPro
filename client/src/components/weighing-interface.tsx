import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest } from "@/lib/queryClient";
import { 
  Microchip, 
  Usb, 
  CheckCircle, 
  RotateCcw, 
  Save, 
  Check,
  History
} from "lucide-react";
import type { WeightReading, Weighment, LorryWithTareConfig } from "@shared/schema";

export function WeighingInterface() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { subscribe } = useWebSocket();
  
  const [currentWeights, setCurrentWeights] = useState<WeightReading>({
    plcWeight: undefined,
    serialWeight: undefined,
    timestamp: new Date()
  });
  
  const [currentTag, setCurrentTag] = useState<string>("");
  const [connectionStatus, setConnectionStatus] = useState({
    plc: false,
    serial: false,
    api: false
  });

  // Get active lorry
  const { data: lorryQueue = [] } = useQuery<LorryWithTareConfig[]>({
    queryKey: ['/api/lorry-queue']
  });
  
  const activeLorry = lorryQueue.find((l: LorryWithTareConfig) => l.status === 'active') as LorryWithTareConfig | undefined;

  // Get weighments for active lorry
  const { data: weighments = [] } = useQuery<Weighment[]>({
    queryKey: ['/api/weighments/lorry', activeLorry?.id],
    enabled: !!activeLorry
  });

  // Subscribe to WebSocket updates
  useEffect(() => {
    const unsubscribeWeight = subscribe('weight_update', (data) => {
      setCurrentWeights(prev => ({
        ...prev,
        [data.source === 'plc' ? 'plcWeight' : 'serialWeight']: data.weight,
        timestamp: new Date()
      }));
    });

    const unsubscribeTag = subscribe('tag_update', (data) => {
      setCurrentTag(data.tagId);
    });

    const unsubscribeMQTT = subscribe('mqtt_status', (data) => {
      setConnectionStatus(prev => ({ ...prev, plc: data.connected }));
    });

    const unsubscribeSerial = subscribe('serial_status', (data) => {
      setConnectionStatus(prev => ({ ...prev, serial: data.connected }));
    });

    const unsubscribeAPI = subscribe('api_status', (data) => {
      setConnectionStatus(prev => ({ ...prev, api: data.connected }));
    });

    return () => {
      unsubscribeWeight();
      unsubscribeTag();
      unsubscribeMQTT();
      unsubscribeSerial();
      unsubscribeAPI();
    };
  }, [subscribe]);

  // Calculate weight validation
  const calculateValidation = () => {
    const { plcWeight, serialWeight } = currentWeights;
    
    if (!plcWeight && !serialWeight) {
      return {
        difference: 0,
        tolerance: 0.05,
        status: "error" as const,
        finalWeight: 0,
        weightSource: "plc" as const
      };
    }

    if (!plcWeight || !serialWeight) {
      const finalWeight = plcWeight || serialWeight || 0;
      const weightSource: "plc" | "serial" = plcWeight ? "plc" : "serial";
      return {
        difference: 0,
        tolerance: 0.05,
        status: "good" as const,
        finalWeight,
        weightSource
      };
    }

    const difference = Math.abs(plcWeight - serialWeight);
    const tolerance = 0.05; // 50g tolerance
    
    const status = difference <= tolerance ? "good" : 
                  difference <= tolerance * 2 ? "warning" : "error";

    return {
      difference,
      tolerance,
      status: status as "good" | "warning" | "error",
      finalWeight: plcWeight, // Use PLC as primary
      weightSource: "plc" as const
    };
  };

  const validation = calculateValidation();

  // Save weighment
  const saveWeighmentMutation = useMutation({
    mutationFn: async () => {
      if (!activeLorry || !currentTag) {
        throw new Error("No active lorry or tag ID");
      }

      const netWeight = validation.finalWeight - (activeLorry.tareConfig?.tareWeight || 0);
      
      const response = await apiRequest('POST', '/api/weighments', {
        lorryId: activeLorry.id,
        tagId: currentTag,
        plcWeight: currentWeights.plcWeight,
        serialWeight: currentWeights.serialWeight,
        finalWeight: validation.finalWeight,
        tareWeight: activeLorry.tareConfig?.tareWeight || 0,
        netWeight,
        weightSource: validation.weightSource,
        toleranceStatus: validation.status,
        weightDifference: validation.difference
      });
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Weighment saved successfully"
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/weighments/lorry'] });
      
      // Update lorry total bags count
      const newTotalBags = (activeLorry?.totalBags || 0) + 1;
      queryClient.setQueryData(['/api/lorry-queue'], (oldData: LorryWithTareConfig[] = []) =>
        oldData.map(lorry => 
          lorry.id === activeLorry?.id 
            ? { ...lorry, totalBags: newTotalBags }
            : lorry
        )
      );
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save weighment",
        variant: "destructive"
      });
    }
  });

  // Complete lorry
  const completeLorryMutation = useMutation({
    mutationFn: async () => {
      if (!activeLorry) throw new Error("No active lorry");
      
      const response = await apiRequest('PATCH', `/api/lorry-queue/${activeLorry.id}/status`, {
        status: 'completed',
        totalBags: weighments.length + 1 // Include current weighment
      });
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Lorry completed successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/lorry-queue'] });
    }
  });

  const getStatusBadge = (connected: boolean, label: string) => (
    <Badge 
      className={`${
        connected 
          ? "bg-green-500/20 text-green-400 border-green-500/30" 
          : "bg-red-500/20 text-red-400 border-red-500/30"
      }`}
      data-testid={`status-${label.toLowerCase()}`}
    >
      <div className={`w-2 h-2 rounded-full mr-2 ${
        connected ? "bg-green-400" : "bg-red-400"
      }`}></div>
      {connected ? "Connected" : "Disconnected"}
    </Badge>
  );

  const getToleranceBadge = (status: string) => {
    switch (status) {
      case "good":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30" data-testid="tolerance-good">Within Tolerance</Badge>;
      case "warning":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30" data-testid="tolerance-warning">Warning</Badge>;
      case "error":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30" data-testid="tolerance-error">Error</Badge>;
      default:
        return <Badge variant="secondary" data-testid="tolerance-unknown">Unknown</Badge>;
    }
  };

  if (!activeLorry) {
    return (
      <div className="text-center py-8" data-testid="no-active-lorry">
        <div className="text-lg font-semibold text-muted-foreground mb-2">
          No Active Weighing Session
        </div>
        <p className="text-sm text-muted-foreground">
          Please start a lorry from the queue to begin weighing operations
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Weighing Header */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2" data-testid="heading-active-weighing">Active Weighing</h2>
              <p className="text-muted-foreground" data-testid="text-lorry-details">
                Lorry: {activeLorry.lorryNumber} | {activeLorry.line} | Manager: {activeLorry.lineManager}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Auto Tare Applied</div>
              <div className="text-lg font-bold text-primary" data-testid="text-tare-weight">
                {activeLorry.tareConfig?.tareWeight || 0} kg
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weight Comparison Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PLC Weight */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Microchip className="text-accent text-lg" />
                <div>
                  <h3 className="font-bold" data-testid="heading-plc-weight">PLC Weight</h3>
                  <p className="text-xs text-muted-foreground">MQTT Source</p>
                </div>
              </div>
              {getStatusBadge(connectionStatus.plc, "PLC")}
            </div>
            <div className="text-center">
              <div className="text-4xl font-black text-transparent bg-gradient-to-r from-accent to-primary bg-clip-text" data-testid="text-plc-weight">
                {currentWeights.plcWeight?.toFixed(3) || "—"}
              </div>
              <div className="text-sm text-muted-foreground">kg</div>
            </div>
          </CardContent>
        </Card>

        {/* Serial Weight */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Usb className="text-accent text-lg" />
                <div>
                  <h3 className="font-bold" data-testid="heading-serial-weight">Serial Weight</h3>
                  <p className="text-xs text-muted-foreground">Direct Scale</p>
                </div>
              </div>
              {getStatusBadge(connectionStatus.serial, "Serial")}
            </div>
            <div className="text-center">
              <div className="text-4xl font-black text-transparent bg-gradient-to-r from-accent to-primary bg-clip-text" data-testid="text-serial-weight">
                {currentWeights.serialWeight?.toFixed(3) || "—"}
              </div>
              <div className="text-sm text-muted-foreground">kg</div>
            </div>
          </CardContent>
        </Card>

        {/* Weight Validation */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="text-primary text-lg" />
                <div>
                  <h3 className="font-bold" data-testid="heading-validation">Validation</h3>
                  <p className="text-xs text-muted-foreground">Difference Check</p>
                </div>
              </div>
              {getToleranceBadge(validation.status)}
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Difference:</span>
                <span className="font-mono" data-testid="text-weight-difference">
                  {validation.difference.toFixed(3)} kg
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Tolerance:</span>
                <span className="font-mono" data-testid="text-tolerance">
                  ±{validation.tolerance.toFixed(3)} kg
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Final Weight:</span>
                <span className="font-bold text-primary" data-testid="text-final-weight">
                  {validation.finalWeight.toFixed(3)} kg
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weighing Controls */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold" data-testid="heading-current-weighment">Current Weighment</h3>
              <p className="text-sm text-muted-foreground">Tag ID will be automatically captured</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Current Tag</div>
              <div className="text-xl font-mono font-bold" data-testid="text-current-tag">
                {currentTag || "Waiting for tag..."}
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Button 
              variant="secondary"
              className="px-6 py-3"
              data-testid="button-reset"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Reading
            </Button>
            <Button 
              className="flex-1 bg-primary text-primary-foreground px-6 py-3"
              onClick={() => saveWeighmentMutation.mutate()}
              disabled={saveWeighmentMutation.isPending || !currentTag || validation.status === "error"}
              data-testid="button-save-weighment"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Weighment
            </Button>
            <Button 
              variant="destructive"
              className="px-6 py-3"
              onClick={() => completeLorryMutation.mutate()}
              disabled={completeLorryMutation.isPending}
              data-testid="button-complete-lorry"
            >
              <Check className="mr-2 h-4 w-4" />
              Complete Lorry
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Weighments */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-3" data-testid="heading-recent-weighments">
            <History className="text-accent" />
            Recent Weighments
          </h3>
          
          {weighments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="no-weighments">
              No weighments recorded yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">#</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tag ID</th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Gross (kg)</th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Net (kg)</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Source</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {weighments.map((weighment, index) => (
                    <tr key={weighment.id} data-testid={`row-weighment-${index}`}>
                      <td className="py-3 px-2 font-medium" data-testid={`text-number-${index}`}>
                        {String(index + 1).padStart(3, '0')}
                      </td>
                      <td className="py-3 px-2 font-mono" data-testid={`text-tag-${index}`}>
                        {weighment.tagId}
                      </td>
                      <td className="py-3 px-2 text-right font-mono" data-testid={`text-gross-${index}`}>
                        {weighment.finalWeight.toFixed(3)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono font-bold text-primary" data-testid={`text-net-${index}`}>
                        {weighment.netWeight.toFixed(3)}
                      </td>
                      <td className="py-3 px-2">
                        <Badge 
                          className="bg-green-500/20 text-green-400 border-green-500/30 text-xs"
                          data-testid={`badge-source-${index}`}
                        >
                          {weighment.weightSource.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        {getToleranceBadge(weighment.toleranceStatus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
