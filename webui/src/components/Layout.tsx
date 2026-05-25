import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ThemeSwitcher } from "../ui";
import {
  LayoutDashboard,
  Bot,
  Play,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Menu,
  GitBranch,
  Clock,
  Shield,
  Cpu,
  Cable,
} from "lucide-react";
import { useState } from "react";

const NAV_SECTIONS = [
  {
    label: "工作台",
    items: [
      { to: "/dashboard", label: "控制台", icon: LayoutDashboard },
    ],
  },
  {
    label: "核心",
    items: [
      { to: "/agents", label: "智能体", icon: Bot },
      { to: "/pipelines", label: "流水线", icon: GitBranch },
      { to: "/runs", label: "运行", icon: Play },
      { to: "/scheduler", label: "定时调度", icon: Clock },
    ],
  },
  {
    label: "内容",
    items: [
      { to: "/vault", label: "知识库", icon: BookOpen },
    ],
  },
  {
    label: "系统",
    items: [
      { to: "/mcp", label: "MCP 服务器", icon: Cable },
      { to: "/audit", label: "审计日志", icon: Shield },
    ],
  },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  function handleNavClick() {
    if (window.innerWidth <= 768) {
      setMobileOpen(false);
    }
  }

  const currentPath = location.pathname;

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--ht-bg)",
        color: "var(--ht-fg)",
      }}
    >
      {mobileOpen && (
        <div
          className="pi-sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          style={{
            display: "none",
            position: "fixed",
            inset: 0,
            zIndex: 99,
            background: "var(--ht-overlay)",
            backdropFilter: "blur(2px)",
            transition: "opacity 0.2s ease",
          }}
        />
      )}
        <aside
        className={`pi-sidebar ${mobileOpen ? "pi-sidebar-open" : ""}`}
        style={{
          width: collapsed ? 68 : 240,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--ht-surface)",
          borderRight: "1px solid var(--ht-border)",
          transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: collapsed ? "20px 10px 16px" : "20px 20px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, var(--ht-accent), color-mix(in srgb, var(--ht-accent) 70%, #000))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ht-on-accent)",
              flexShrink: 0,
              boxShadow: "0 2px 8px var(--ht-accent-muted)",
            }}
          >
            <Cpu size={18} />
          </div>
          {!collapsed && (
            <div style={{ overflow: "hidden" }}>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  color: "var(--ht-fg)",
                  whiteSpace: "nowrap",
                  lineHeight: 1.2,
                }}
              >
                Pi Console
              </div>
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.4,
                  marginTop: 2,
                  whiteSpace: "nowrap",
                  letterSpacing: "0.02em",
                }}
              >
                Agent Control Center
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            margin: collapsed ? "0 10px" : "0 20px",
            height: 1,
            background: "var(--ht-border)",
            flexShrink: 0,
          }}
        />

        <nav
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: collapsed ? "8px 6px" : "8px 10px",
          }}
        >
          {NAV_SECTIONS.map((section, si) => (
            <div key={section.label} style={{ marginBottom: si < NAV_SECTIONS.length - 1 ? 4 : 0 }}>
              {!collapsed && (
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    opacity: 0.3,
                    padding: "10px 12px 4px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {section.label}
                </div>
              )}
              {collapsed && si > 0 && (
                <div
                  style={{
                    height: 1,
                    background: "var(--ht-border)",
                    margin: "6px 6px",
                    opacity: 0.5,
                  }}
                />
              )}
              {section.items.map(({ to, label, icon: Icon }) => {
                const isActive =
                  to === "/dashboard"
                    ? currentPath === "/" || currentPath === "/dashboard"
                    : currentPath.startsWith(to);
                return (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={handleNavClick}
                    title={collapsed ? label : undefined}
                    className="pi-nav-item"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: collapsed ? "10px 0" : "9px 12px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive
                        ? "var(--ht-accent)"
                        : "var(--ht-fg)",
                      background: isActive
                        ? "var(--ht-accent-muted)"
                        : "transparent",
                      transition: "all 0.15s ease",
                      justifyContent: collapsed ? "center" : "flex-start",
                      whiteSpace: "nowrap",
                      position: "relative",
                      textDecoration: "none",
                      marginBottom: 1,
                    }}
                  >
                    {isActive && (
                      <div
                        style={{
                          position: "absolute",
                          left: collapsed ? -6 : -10,
                          top: 8,
                          bottom: 8,
                          width: 3,
                          borderRadius: 2,
                          background: "var(--ht-accent)",
                        }}
                      />
                    )}
                    <Icon
                      size={18}
                      style={{
                        flexShrink: 0,
                        opacity: isActive ? 1 : 0.55,
                        transition: "opacity 0.15s ease",
                      }}
                    />
                    {!collapsed && (
                      <span style={{ opacity: isActive ? 1 : 0.75 }}>
                        {label}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div
          style={{
            margin: collapsed ? "0 10px" : "0 20px",
            height: 1,
            background: "var(--ht-border)",
            flexShrink: 0,
          }}
        />

        <div
          style={{
            padding: collapsed ? "12px 8px" : "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
          }}
        >
          <ThemeSwitcher />
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "展开侧栏" : "收起侧栏"}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              border: "1px solid var(--ht-border)",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ht-fg)",
              opacity: 0.4,
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.8";
              e.currentTarget.style.background =
                "var(--ht-accent-muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.4";
              e.currentTarget.style.background = "transparent";
            }}
          >
            {collapsed ? (
              <ChevronRight size={13} />
            ) : (
              <ChevronLeft size={13} />
            )}
          </button>
        </div>
      </aside>

      <main
        className="pi-main"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 32,
          maxWidth: 1200,
        }}
      >
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            display: "none",
            position: "fixed",
            bottom: 20,
            right: 20,
            width: 52,
            height: 52,
            borderRadius: 16,
            border: "none",
            background: "var(--ht-accent)",
            color: "var(--ht-on-accent)",
            boxShadow: "0 4px 16px rgba(107,91,115,0.3)",
            cursor: "pointer",
            zIndex: 98,
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.15s ease",
          }}
          className="pi-mobile-menu-btn"
        >
          <Menu size={20} />
        </button>
        <Outlet />
      </main>
    </div>
  );
}
