const API_URL =
  "https://coldguard-ai-backend.onrender.com/api/esp32/data";

export async function getESP32Data() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error("ESP32 Cloud API error");
  }

  const result = await response.json();

  if (result.status !== "online" || !result.data) {
    throw new Error("ESP32 data not available yet");
  }

  return result.data;
}