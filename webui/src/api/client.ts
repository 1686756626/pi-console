import axios from "axios";
import { toast } from "../components/Toast";

const client = axios.create({
  baseURL: "/api",
  timeout: 30000,
});

client.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg = err.response?.data?.detail || err.message || "请求失败";
    toast(msg, "error");
    return Promise.reject(err);
  },
);

export default client;
