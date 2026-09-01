const ESP32_IP = "10.32.170.1";

export async function getESP32Data() {
  const response = await fetch(
    `http://${ESP32_IP}/api/data`
  );

  if (!response.ok) {
    throw new Error("ESP32 API error");
  }

  return await response.json();
}