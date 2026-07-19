/**
 * ICE servers para WebRTC: STUN públicos + TURN próprio (coturn no Hetzner)
 * com credenciais efêmeras vindas do servidor. Sem TURN, chamadas falham
 * quando o celular está em CGNAT (5G) — o TURN releia a mídia.
 */
import { API_BASE } from "@/lib/config";

const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

let cached: RTCIceServer[] | null = null;
let cachedAt = 0;
let ttlMs = 0;

export async function getIceServers(): Promise<RTCIceServer[]> {
  if (cached && Date.now() - cachedAt < ttlMs / 2) return cached;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${API_BASE}/api/interfone/turn-credentials`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data?.username && Array.isArray(data.urls) && data.urls.length > 0) {
        cached = [
          ...STUN_SERVERS,
          { urls: data.urls, username: data.username, credential: data.credential },
        ];
        cachedAt = Date.now();
        ttlMs = (data.ttlSeconds || 3600) * 1000;
        return cached;
      }
    }
  } catch {}
  return cached ?? STUN_SERVERS;
}
