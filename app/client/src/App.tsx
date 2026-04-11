import { useState, useEffect } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

import { SolarProvider } from "@/hooks/use-solar-data";
import { DigitalstromProvider } from "@/hooks/use-digitalstrom-data";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Solar from "@/pages/solar";
import Digitalstrom from "@/pages/digitalstrom";
import Strom from "@/pages/strom";
import Videoanlage from "@/pages/videoanlage";
import Wallbox from "@/pages/wallbox";
import Sonos from "@/pages/sonos";
import DoorBird from "@/pages/doorbird";
import Pool from "@/pages/pool";
import Fahrzeuge from "@/pages/fahrzeuge";
import Termine from "@/pages/termine";
import Dokumente from "@/pages/dokumente";
import Einstellungen from "@/pages/einstellungen";
import NotFound from "@/pages/not-found";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button variant="ghost" size="sm" onClick={toggleTheme} data-testid="button-theme-toggle">
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/solar" component={Solar} />
      <Route path="/digitalstrom" component={Digitalstrom} />
      <Route path="/strom" component={Strom} />
      <Route path="/videoanlage" component={Videoanlage} />
      <Route path="/wallbox" component={Wallbox} />
      <Route path="/sonos" component={Sonos} />
      <Route path="/doorbird" component={DoorBird} />
      <Route path="/pool" component={Pool} />
      <Route path="/fahrzeuge" component={Fahrzeuge} />
      <Route path="/termine" component={Termine} />
      <Route path="/dokumente" component={Dokumente} />
      <Route path="/einstellungen" component={Einstellungen} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between px-4 py-2 border-b bg-background/80 backdrop-blur-sm">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-hidden">
            <AppRouter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthenticatedApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/config")
      .then((r) => r.json())
      .then((d) => {
        setPasswordRequired(d.passwordRequired !== false);
        if (d.passwordRequired === false) setAuthenticated(true);
      })
      .catch(() => setPasswordRequired(true));
  }, []);

  // Still loading config
  if (passwordRequired === null) return null;

  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <SolarProvider>
      <DigitalstromProvider>
        <AppShell />
      </DigitalstromProvider>
    </SolarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Router hook={useHashLocation}>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
