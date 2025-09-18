import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWebSocket } from "@/hooks/use-websocket";
import { 
  Truck, 
  Weight, 
  AlertTriangle, 
  TrendingUp, 
  Activity,
  Clock
} from "lucide-react";
import type { SystemActivity } from "@shared/schema";

export function MonitoringDashboard() {
  const { subscribe } = useWebSocket();
  
  // Get system stats
  const { data: stats, isLoading: statsLoading } = useQuery<{
    activeLorries: number;
    totalWeighments: number;
    toleranceViolations: number;
    avgWeight: number;
  }>({
    queryKey: ['/api/stats'],
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  // Get recent activities
  const { data: activities = [], isLoading: activitiesLoading } = useQuery<SystemActivity[]>({
    queryKey: ['/api/activities'],
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Get today's weighments
  const { data: todaysWeighments = [] } = useQuery<any[]>({
    queryKey: ['/api/weighments/today'],
    refetchInterval: 5000
  });

  const [realtimeActivities, setRealtimeActivities] = useState<SystemActivity[]>([]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribeWeighment = subscribe('weighment_created', (data) => {
      const activity: SystemActivity = {
        id: `realtime_${Date.now()}`,
        type: 'weighment',
        message: `New weighment: ${data.tagId} (${data.netWeight.toFixed(1)}kg net)`,
        status: data.toleranceStatus === 'good' ? 'success' : 'warning',
        metadata: data,
        createdAt: new Date()
      };
      
      setRealtimeActivities(prev => [activity, ...prev.slice(0, 4)]); // Keep last 5 activities
    });

    const unsubscribeTolerance = subscribe('weight_update', (data) => {
      // Add tolerance violation activities based on weight updates
      // This would be implemented based on actual tolerance checking logic
    });

    return () => {
      unsubscribeWeighment();
      unsubscribeTolerance();
    };
  }, [subscribe]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'weighment':
        return <Weight className="h-4 w-4 text-primary" />;
      case 'tolerance_violation':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'api_sync':
        return <Activity className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs" data-testid={`status-${status}`}>Success</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs" data-testid={`status-${status}`}>Warning</Badge>;
      case 'error':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs" data-testid={`status-${status}`}>Error</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs" data-testid={`status-${status}`}>Info</Badge>;
    }
  };

  const formatTimeAgo = (date: Date | string) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  if (statsLoading) {
    return (
      <div className="text-center py-8" data-testid="loading-stats">
        Loading monitoring data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <Truck className="text-primary text-xl" />
              <div>
                <div className="text-2xl font-bold" data-testid="stat-active-lorries">
                  {stats?.activeLorries || 0}
                </div>
                <div className="text-sm text-muted-foreground">Active Lorries</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <Weight className="text-accent text-xl" />
              <div>
                <div className="text-2xl font-bold" data-testid="stat-total-weighments">
                  {stats?.totalWeighments || 0}
                </div>
                <div className="text-sm text-muted-foreground">Today's Weighments</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="text-yellow-500 text-xl" />
              <div>
                <div className="text-2xl font-bold" data-testid="stat-tolerance-violations">
                  {stats?.toleranceViolations || 0}
                </div>
                <div className="text-sm text-muted-foreground">Tolerance Issues</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="text-primary text-xl" />
              <div>
                <div className="text-2xl font-bold" data-testid="stat-avg-weight">
                  {stats?.avgWeight?.toFixed(1) || '0.0'}
                </div>
                <div className="text-sm text-muted-foreground">Avg Net Weight (kg)</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weight Comparison Chart Placeholder */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-3" data-testid="heading-weight-comparison">
            <Activity className="text-accent" />
            PLC vs Serial Weight Comparison
          </h3>
          <div className="h-64 flex items-center justify-center bg-muted/10 rounded-lg border border-border">
            <div className="text-center text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-lg font-medium">Real-time Weight Chart</p>
              <p className="text-sm">Chart implementation with Chart.js would be integrated here</p>
              <p className="text-xs mt-2">Showing PLC vs Serial weight readings over time</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Activities */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-3" data-testid="heading-live-activities">
              <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
              Live Activities
            </h3>
            
            {realtimeActivities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="no-live-activities">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Waiting for real-time activities...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {realtimeActivities.map((activity, index) => (
                  <div 
                    key={activity.id} 
                    className="flex items-start gap-3 p-3 bg-muted/10 rounded-lg border border-border"
                    data-testid={`live-activity-${index}`}
                  >
                    <div className="mt-1">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate" data-testid={`activity-message-${index}`}>
                        {activity.message}
                      </div>
                      <div className="text-xs text-muted-foreground" data-testid={`activity-time-${index}`}>
                        {formatTimeAgo(activity.createdAt || new Date())}
                      </div>
                    </div>
                    {getStatusBadge(activity.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent System Activities */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-3" data-testid="heading-system-activities">
              <Clock className="text-accent" />
              System Activities
            </h3>
            
            {activitiesLoading ? (
              <div className="text-center py-8" data-testid="loading-activities">
                Loading activities...
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="no-activities">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No recent activities</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.slice(0, 10).map((activity: SystemActivity, index: number) => (
                  <div 
                    key={activity.id} 
                    className="flex items-start gap-3 p-3 bg-muted/10 rounded-lg"
                    data-testid={`system-activity-${index}`}
                  >
                    <div className="mt-1">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate" data-testid={`system-message-${index}`}>
                        {activity.message}
                      </div>
                      <div className="text-xs text-muted-foreground" data-testid={`system-time-${index}`}>
                        {formatTimeAgo(activity.createdAt || new Date())}
                      </div>
                    </div>
                    {getStatusBadge(activity.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Today's Weighments Summary */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-3" data-testid="heading-todays-weighments">
            <Weight className="text-primary" />
            Today's Weighments Summary
          </h3>
          
          {todaysWeighments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="no-todays-weighments">
              No weighments recorded today
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted/10 rounded-lg">
                <div className="text-2xl font-bold text-primary" data-testid="total-bags">
                  {todaysWeighments.length}
                </div>
                <div className="text-sm text-muted-foreground">Total Bags</div>
              </div>
              <div className="text-center p-4 bg-muted/10 rounded-lg">
                <div className="text-2xl font-bold text-accent" data-testid="total-gross-weight">
                  {todaysWeighments.reduce((sum: number, w: any) => sum + w.finalWeight, 0).toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">Total Gross (kg)</div>
              </div>
              <div className="text-center p-4 bg-muted/10 rounded-lg">
                <div className="text-2xl font-bold text-green-400" data-testid="total-net-weight">
                  {todaysWeighments.reduce((sum: number, w: any) => sum + w.netWeight, 0).toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">Total Net (kg)</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
