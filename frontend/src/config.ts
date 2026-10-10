export const getApiUrl = () => {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8021/api/v1";
  }
  return process.env.API_URL || "http://localhost:8021/api/v1";
};
