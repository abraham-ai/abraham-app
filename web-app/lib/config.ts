export const env = {
  NEXT_PUBLIC_EDEN_API_URL: process.env.NEXT_PUBLIC_EDEN_API_URL || "",
  NEXT_PUBLIC_ABRAHAM_AGENT_ID: process.env.NEXT_PUBLIC_ABRAHAM_AGENT_ID || "",
};

export const sessionConfig = {
  useStreaming:
    process.env.NEXT_PUBLIC_EDEN_STREAMING === "1" ||
    process.env.NEXT_PUBLIC_EDEN_STREAMING === "true" ||
    false,
};
