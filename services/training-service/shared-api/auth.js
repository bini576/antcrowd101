import api from "@shared-api/client";

export async function login(payload) {
  const { data } = await api.post("/auth/login", payload);
  return data;
}

export async function bootstrap() {
  const { data } = await api.post("/auth/bootstrap", {}, { withCredentials: true });
  return data;
}

export async function register(payload) {
  const { data } = await api.post("/auth/register", payload);
  return data;
}

export async function getMe() {
  const { data } = await api.get("/auth/me");
  return data;
}
