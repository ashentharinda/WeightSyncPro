import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QueueManagement } from "@/components/queue-management";
import { WeighingInterface } from "@/components/weighing-interface";
import { MonitoringDashboard } from "@/components/monitoring-dashboard";
import { SettingsPanel } from "../components/settings-panel";
import { ThemeToggle } from "../components/theme-toggle";
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
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-card/90 border-b border-border/50 shadow-sm" data-testid="header">
        <div className="flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="w-4 h-4 rounded-full bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/25 animate-pulse"></div>
            <div>
              <h1 className="text-xl font-bold text-foreground gradient-text" data-testid="app-title">
                New Hopewell Tea Factory Weighing System
              </h1>
              <p className="text-sm text-muted-foreground font-medium">
                Advanced PLC & Serial Integration • Real-time Monitoring
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="flex gap-3">
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
            
            <div className="h-6 w-px bg-border/50"></div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-8 py-8 max-w-7xl" data-testid="main-content">
        <div className="space-y-8">
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
}
