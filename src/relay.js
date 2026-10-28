import mqtt from "mqtt";

// Direct phone-to-laptop links are blocked on this network, so both sides
// meet on a public broker. The channel key rides in the QR code.
const BROKER = "wss://broker.hivemq.com:8884/mqtt";

export function openRelay(key) {
  const topics = {
    toShop: `lowlamp/${key}/to-shop`,
    toPhone: `lowlamp/${key}/to-phone`,
  };
  const client = mqtt.connect(BROKER, {
    protocolVersion: 4,
    clean: true,
    reconnectPeriod: 1500,
    connectTimeout: 8000,
    keepalive: 30,
  });
  return { client, topics };
}

export function readMessage(payload) {
  const text = typeof payload === "string" ? payload : new TextDecoder().decode(payload);
  try { return JSON.parse(text); } catch { return null; }
}
