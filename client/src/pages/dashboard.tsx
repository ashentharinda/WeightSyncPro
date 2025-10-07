import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QueueManagement } from "@/components/queue-management";
import { WeighingInterface } from "@/components/weighing-interface";
import { MonitoringDashboard } from "@/components/monitoring-dashboard";
import { SettingsPanel } from "../components/settings-panel";
import { 
  List, 
  Weight, 
  BarChart3, 
  Settings, 
  Wifi 
} from "lucide-react";

type ViewType = "queue" | "weighing" | "monitor" | "settings";

export default function Dashboard() {
  const [activeView, setActiveView] = useState<ViewType>("queue");

  const navigationItems = [
    {
      id: "queue" as ViewType,
      label: "Queue & Tare",
      icon: List,
      component: QueueManagement
    },
    {
      id: "weighing" as ViewType,
      label: "Weighing",
      icon: Weight,
      component: WeighingInterface
    },
    {
      id: "monitor" as ViewType,
      label: "Monitor",
      icon: BarChart3,
      component: MonitoringDashboard
    },
    {
      id: "settings" as ViewType,
      label: "Settings",
      icon: Settings,
      component: SettingsPanel
    }
  ];

  const ActiveComponent = navigationItems.find(item => item.id === activeView)?.component || QueueManagement;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-card/80 border-b border-border" data-testid="header">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-accent to-primary shadow-lg shadow-accent/25"></div>
            <div>
              <h1 className="text-lg font-bold text-foreground" data-testid="app-title">New Hopewell Tea Factory Weighing</h1>
              <p className="text-xs text-muted-foreground">Enhanced PLC & API Integration</p>
            </div>
          </div>
          
          <nav className="flex gap-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={`nav-button ${activeView === item.id ? 'active' : ''}`}
                  onClick={() => setActiveView(item.id)}
                  data-testid={`nav-${item.id}`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6 max-w-7xl" data-testid="main-content">
        <ActiveComponent />
      </main>
    </div>
  );
}
