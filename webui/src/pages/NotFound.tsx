import { useNavigate } from "react-router-dom";
import { Button } from "../ui";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      gap: 16,
    }}>
      <div style={{
        fontSize: 72,
        fontWeight: 800,
        color: "var(--ht-accent)",
        opacity: 0.3,
        lineHeight: 1,
      }}>
        404
      </div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>
        页面不存在
      </div>
      <div style={{ fontSize: 14, opacity: 0.5 }}>
        你访问的页面不存在或已被移动
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} style={{ marginRight: 4 }} /> 返回上页
        </Button>
        <Button variant="primary" onClick={() => navigate("/dashboard")}>
          <Home size={14} style={{ marginRight: 4 }} /> 回到控制台
        </Button>
      </div>
    </div>
  );
}
