export const getApiUrl = () => {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "/api/v1";
  }
  const backendBase = process.env.BACKEND_INTERNAL_URL || process.env.API_URL || "http://127.0.0.1:8021";
  return backendBase.endsWith("/api/v1") ? backendBase : `${backendBase}/api/v1`;
};
