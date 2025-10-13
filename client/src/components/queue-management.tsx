import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Truck, Calendar, Save, Plus, Trash2, Play, Square } from "lucide-react";
import type { TareConfiguration, LorryWithTareConfig } from "@shared/schema";

export function QueueManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form states
  const [tareForm, setTareForm] = useState({
    date: new Date().toISOString().split('T')[0],
    tareWeight: ''
  });

  const [lorryForm, setLorryForm] = useState({
    lorryNumber: '',
    line: '',
    lineManager: '',
    phone: ''
  });

  // Get today's tare configuration
  const { data: currentTare } = useQuery<TareConfiguration | null>({
    queryKey: ['/api/tare-config', tareForm.date],
    enabled: !!tareForm.date
  });

  // Get lorry queue
  const { data: lorryQueue = [], isLoading: queueLoading } = useQuery<LorryWithTareConfig[]>({
    queryKey: ['/api/lorry-queue']
  });

  // Create tare configuration
  const createTareMutation = useMutation({
    mutationFn: async (data: typeof tareForm) => {
      const response = await apiRequest('POST', '/api/tare-config', {
        date: data.date,
        tareWeight: parseFloat(data.tareWeight)
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Daily tare configuration saved successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tare-config'] });
      setTareForm(prev => ({ ...prev, tareWeight: '' }));
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save tare configuration",
        variant: "destructive"
      });
    }
  });

  // Create lorry
  const createLorryMutation = useMutation({
    mutationFn: async (data: typeof lorryForm) => {
      const response = await apiRequest('POST', '/api/lorry-queue', {
        ...data,
        tareConfigId: currentTare?.id || null
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Lorry added to queue successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/lorry-queue'] });
      setLorryForm({
        lorryNumber: '',
        line: '',
        lineManager: '',
        phone: ''
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add lorry to queue",
        variant: "destructive"
      });
    }
  });

  // Update lorry status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, totalBags }: { id: string, status: string, totalBags?: number }) => {
      const response = await apiRequest('PATCH', `/api/lorry-queue/${id}/status`, {
        status,
        totalBags
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lorry-queue'] });
    }
  });

  // Remove lorry
  const removeLorryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/lorry-queue/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Lorry removed from queue"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/lorry-queue'] });
    }
  });

  const handleTareSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tareForm.tareWeight) return;
    createTareMutation.mutate(tareForm);
  };

  const handleLorrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lorryForm.lorryNumber || !lorryForm.line || !lorryForm.lineManager) return;
    if (!currentTare) {
      toast({
        title: "Error",
        description: "Please configure daily tare weight first",
        variant: "destructive"
      });
      return;
    }
    createLorryMutation.mutate(lorryForm);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30" data-testid={`status-${status}`}>Active</Badge>;
      case "completed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30" data-testid={`status-${status}`}>Completed</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30" data-testid={`status-${status}`}>Waiting</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Daily Tare Configuration */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-3" data-testid="heading-tare-config">
            <Calendar className="text-primary" />
            Daily Tare Configuration
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Configure tare weight once per day for all bags in this batch
          </p>
          
          <form onSubmit={handleTareSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="tareDate" className="text-xs text-muted-foreground">Date</Label>
              <Input
                id="tareDate"
                type="date"
                value={tareForm.date}
                onChange={(e) => setTareForm(prev => ({ ...prev, date: e.target.value }))}
                className="mt-2"
                data-testid="input-tare-date"
              />
            </div>
            <div>
              <Label htmlFor="tareWeight" className="text-xs text-muted-foreground">Average Tare Weight (kg)</Label>
              <Input
                id="tareWeight"
                type="number"
                placeholder="0.850"
                step="0.001"
                value={tareForm.tareWeight}
                onChange={(e) => setTareForm(prev => ({ ...prev, tareWeight: e.target.value }))}
                className="mt-2"
                data-testid="input-tare-weight"
              />
            </div>
            <div className="flex items-end">
              <Button 
                type="submit" 
                className="w-full bg-primary text-primary-foreground"
                disabled={createTareMutation.isPending}
                data-testid="button-save-tare"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Daily Tare
              </Button>
            </div>
          </form>

          {currentTare && (
            <div className="mt-4 p-4 bg-muted/20 rounded-lg" data-testid="current-tare-display">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium" data-testid="text-current-date">
                    Today: {currentTare.date}
                  </span>
                </div>
                <div className="text-lg font-bold text-primary" data-testid="text-current-weight">
                  {currentTare.tareWeight} kg
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Lorry Section */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-3" data-testid="heading-add-lorry">
              <Truck className="text-accent" />
              Add Lorry to Queue
            </h2>
            
            <form onSubmit={handleLorrySubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lorryNumber" className="text-xs text-muted-foreground">Lorry Number</Label>
                  <Input
                    id="lorryNumber"
                    type="text"
                    placeholder="AB-1234"
                    value={lorryForm.lorryNumber}
                    onChange={(e) => setLorryForm(prev => ({ ...prev, lorryNumber: e.target.value }))}
                    className="mt-2"
                    data-testid="input-lorry-number"
                  />
                </div>
                <div>
                  <Label htmlFor="line" className="text-xs text-muted-foreground">Line</Label>
                  <Input
                    id="line"
                    type="text"
                    placeholder="Line A"
                    value={lorryForm.line}
                    onChange={(e) => setLorryForm(prev => ({ ...prev, line: e.target.value }))}
                    className="mt-2"
                    data-testid="input-line"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lineManager" className="text-xs text-muted-foreground">Line Manager</Label>
                  <Input
                    id="lineManager"
                    type="text"
                    placeholder="Manager name"
                    value={lorryForm.lineManager}
                    onChange={(e) => setLorryForm(prev => ({ ...prev, lineManager: e.target.value }))}
                    className="mt-2"
                    data-testid="input-line-manager"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-xs text-muted-foreground">Phone</Label>
                  <Input
                    id="phone"
                    type="text"
                    placeholder="+94 7X XXX XXXX"
                    value={lorryForm.phone}
                    onChange={(e) => setLorryForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="mt-2"
                    data-testid="input-phone"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="secondary" 
                  className="flex-1"
                  onClick={() => setLorryForm({ lorryNumber: '', line: '', lineManager: '', phone: '' })}
                  data-testid="button-clear-lorry"
                >
                  Clear
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-primary text-primary-foreground"
                  disabled={createLorryMutation.isPending}
                  data-testid="button-add-lorry"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add to Queue
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-3" data-testid="heading-system-status">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-accent to-primary"></div>
              System Status
            </h2>
            
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Queue Length</div>
                <div className="text-2xl font-bold text-primary" data-testid="text-queue-length">
                  {lorryQueue.length} lorries
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-muted-foreground">Waiting</div>
                  <div className="font-bold" data-testid="text-waiting-count">
                    {lorryQueue.filter(l => l.status === 'waiting').length}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Active</div>
                  <div className="font-bold text-yellow-400" data-testid="text-active-count">
                    {lorryQueue.filter(l => l.status === 'active').length}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Completed</div>
                  <div className="font-bold text-green-400" data-testid="text-completed-count">
                    {lorryQueue.filter(l => l.status === 'completed').length}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue Table */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-3" data-testid="heading-queue">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              Active Queue
            </h2>
            <div className="text-sm text-muted-foreground">
              Click "Start" to begin weighing operations
            </div>
          </div>
          
          {queueLoading ? (
            <div className="text-center py-8" data-testid="loading-queue">
              Loading queue...
            </div>
          ) : lorryQueue.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="empty-queue">
              No lorries in queue
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Lorry</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Line</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Manager</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tare (kg)</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Bags</th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lorryQueue.map((lorry) => (
                    <tr key={lorry.id} data-testid={`row-lorry-${lorry.id}`}>
                      <td className="py-3 px-2">
                        {getStatusBadge(lorry.status)}
                      </td>
                      <td className="py-3 px-2 font-medium" data-testid={`text-lorry-number-${lorry.id}`}>
                        {lorry.lorryNumber}
                      </td>
                      <td className="py-3 px-2" data-testid={`text-line-${lorry.id}`}>
                        {lorry.line}
                      </td>
                      <td className="py-3 px-2" data-testid={`text-manager-${lorry.id}`}>
                        {lorry.lineManager}
                      </td>
                      <td className="py-3 px-2 font-mono" data-testid={`text-tare-${lorry.id}`}>
                        {lorry.tareConfig?.tareWeight || '—'}
                      </td>
                      <td className="py-3 px-2" data-testid={`text-bags-${lorry.id}`}>
                        {lorry.totalBags ? `${lorry.totalBags} bags` : '—'}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex gap-2 justify-end">
                          {lorry.status === 'waiting' && (
                            <Button
                              size="sm"
                              className="bg-primary text-primary-foreground"
                              onClick={() => updateStatusMutation.mutate({ id: lorry.id, status: 'active' })}
                              disabled={updateStatusMutation.isPending}
                              data-testid={`button-start-${lorry.id}`}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Start
                            </Button>
                          )}
                          {lorry.status === 'active' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => updateStatusMutation.mutate({ id: lorry.id, status: 'completed' })}
                              disabled={updateStatusMutation.isPending}
                              data-testid={`button-complete-${lorry.id}`}
                            >
                              <Square className="h-3 w-3 mr-1" />
                              Complete
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => removeLorryMutation.mutate(lorry.id)}
                            disabled={removeLorryMutation.isPending}
                            data-testid={`button-remove-${lorry.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
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
