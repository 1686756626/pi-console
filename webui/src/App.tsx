import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";

const Agents = lazy(() => import("./pages/Agents"));
const AgentDetail = lazy(() => import("./pages/AgentDetail"));
const Runs = lazy(() => import("./pages/Runs"));
const RunDetail = lazy(() => import("./pages/RunDetail"));
const PlanDetail = lazy(() => import("./pages/PlanDetail"));
const Pipelines = lazy(() => import("./pages/Pipelines"));
const Wiki = lazy(() => import("./pages/Wiki"));
const Memos = lazy(() => import("./pages/Memos"));
const News = lazy(() => import("./pages/News"));
const Knowledge = lazy(() => import("./pages/Knowledge"));
const Vault = lazy(() => import("./pages/Vault"));
const Scheduler = lazy(() => import("./pages/Scheduler"));
const Audit = lazy(() => import("./pages/Audit"));
const McpServers = lazy(() => import("./pages/McpServers"));
const NotFound = lazy(() => import("./pages/NotFound"));

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, opacity: 0.3 }}>
          加载中...
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/agents" element={<LazyPage><Agents /></LazyPage>} />
        <Route path="/agents/:id" element={<LazyPage><AgentDetail /></LazyPage>} />
        <Route path="/pipelines" element={<LazyPage><Pipelines /></LazyPage>} />
        <Route path="/runs" element={<LazyPage><Runs /></LazyPage>} />
        <Route path="/runs/:id" element={<LazyPage><RunDetail /></LazyPage>} />
        <Route path="/plans/:id" element={<LazyPage><PlanDetail /></LazyPage>} />
        <Route path="/documents" element={<LazyPage><Wiki /></LazyPage>} />
        <Route path="/knowledge" element={<LazyPage><Knowledge /></LazyPage>} />
        <Route path="/vault" element={<LazyPage><Vault /></LazyPage>} />
        <Route path="/scheduler" element={<LazyPage><Scheduler /></LazyPage>} />
        <Route path="/memos" element={<LazyPage><Memos /></LazyPage>} />
        <Route path="/news" element={<LazyPage><News /></LazyPage>} />
        <Route path="/audit" element={<LazyPage><Audit /></LazyPage>} />
        <Route path="/mcp" element={<LazyPage><McpServers /></LazyPage>} />
        <Route path="*" element={<LazyPage><NotFound /></LazyPage>} />
      </Route>
    </Routes>
  );
}
