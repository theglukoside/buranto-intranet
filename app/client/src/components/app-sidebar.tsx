import {
  LayoutDashboard,
  Sun,
  Home,
  Zap,
  Video,
  BatteryCharging,
  Music,
  Car,
  CalendarDays,
  FolderOpen,
  Settings,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { BurantoLogoSVG } from "./buranto-logo";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Solar Manager", url: "/solar", icon: Sun },
  { title: "Digitalstrom", url: "/digitalstrom", icon: Home },
  { title: "Strom", url: "/strom", icon: Zap },
  { title: "Videoanlage", url: "/videoanlage", icon: Video },
  { title: "Wallbox", url: "/wallbox", icon: BatteryCharging },
  { title: "Sonos", url: "/sonos", icon: Music },
  { title: "Fahrzeuge", url: "/fahrzeuge", icon: Car },
];

const personalItems = [
  { title: "Termine", url: "/termine", icon: CalendarDays },
  { title: "Dokumente", url: "/dokumente", icon: FolderOpen },
];

const systemItems = [
  { title: "Einstellungen", url: "/einstellungen", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex flex-col gap-1 hover:opacity-80 transition-opacity">
          <BurantoLogoSVG width={160} />
          <div className="text-[10px] tracking-widest uppercase font-semibold" style={{ color: '#FFE600' }}>
            INTRANET
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Smart Home</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`nav-${item.url.replace("/", "") || "home"}`}>
                      <item.icon className="h-4 w-4" style={{ color: '#FFE600' }} />
                      <span style={{ color: '#FFE600' }}>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Persönlich</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {personalItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`nav-${item.url.replace("/", "")}`}>
                      <item.icon className="h-4 w-4" style={{ color: '#FFE600' }} />
                      <span style={{ color: '#FFE600' }}>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`nav-${item.url.replace("/", "")}`}>
                      <item.icon className="h-4 w-4" style={{ color: '#FFE600' }} />
                      <span style={{ color: '#FFE600' }}>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="text-[10px] text-sidebar-foreground/40">
          Buranto Intranet v1.0 — Sissach, BL
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
