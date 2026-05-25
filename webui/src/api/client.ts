import axios from "axios";
import { toast } from "../components/Toast";

const PI_API_TOKEN = (() => {
  const p = new URLSearchParams(window.location.search);
  return p.get("token") || localStorage.getItem("pi_api_token") || "";
})();

if (PI_API_TOKEN) {
  localStorage.setItem("pi_api_token", PI_API_TOKEN);
}

const client = axios.create({
  baseURL: "/api",
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("pi_api_token");
  if (token) {
    config.headers["X-API-Token"] = token;
  }
  return config;
});

client.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      const current = localStorage.getItem("pi_api_token");
      if (current) {
        localStorage.removeItem("pi_api_token");
        toast("API Token 无效，已清除。请重新输入。", "error");
        return Promise.reject(err);
      }
    }
    const msg = err.response?.data?.detail || err.message || "请求失败";
    toast(msg, "error");
    return Promise.reject(err);
  },
);

export default client;
