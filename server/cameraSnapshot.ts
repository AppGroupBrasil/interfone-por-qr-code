/**
 * Camera Snapshot Utility
 * Captures a frame from a camera's MJPEG/Snapshot URL and returns it as base64.
 * Used for automatic snapshots on visitor/delivery/vehicle access events.
 */
import db from "./db.js";
import { log } from "./logger.js";

interface CameraRow {
  id: number;
  condominio_id: number;
  nome: string;
  setor: string;
  url_stream: string;
  tipo_stream: string;
  ativa: number;
  usuario?: string;
  senha?: string;
}

/**
 * Get the best camera for a given sector in a condominium.
 * Priority: entrada_principal > portaria > entrada_servico > any active camera
 */
export function getCameraForSector(condominioId: number, preferredSectors: string[] = ["entrada_principal", "portaria", "entrada_servico"]): CameraRow | null {
  for (const setor of preferredSectors) {
    const cam = db.prepare(
      "SELECT * FROM cameras WHERE condominio_id = ? AND setor = ? AND ativa = 1 AND url_stream IS NOT NULL AND url_stream != '' ORDER BY ordem ASC LIMIT 1"
    ).get(condominioId, setor) as CameraRow | undefined;
    if (cam) return cam;
  }
  // Fallback: any active camera
  const any = db.prepare(
    "SELECT * FROM cameras WHERE condominio_id = ? AND ativa = 1 AND url_stream IS NOT NULL AND url_stream != '' ORDER BY ordem ASC LIMIT 1"
  ).get(condominioId) as CameraRow | undefined;
  return any || null;
}

/**
 * Validate that a camera URL is safe to fetch (SSRF protection).
 * Blocks localhost, link-local (AWS metadata 169.254.x.x), and non-http protocols.
 * Allows private LAN IPs (192.168.x, 10.x, 172.x) since cameras are on the local network.
 */
function isUrlSafe(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host === "0.0.0.0" ||
      /^169\.254\./.test(host) ||
      host.endsWith(".internal") ||
      host.endsWith(".amazonaws.com")
    ) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Capture a snapshot from a camera URL.
 * Supports MJPEG streams (grabs single frame) and snapshot URLs (direct fetch).
 * Returns base64 data URL or null on failure.
 */
export async function captureSnapshot(camera: CameraRow): Promise<string | null> {
  try {
    if (!isUrlSafe(camera.url_stream)) {
      log.warn(`[CameraSnapshot] URL bloqueada por segurança: ${camera.url_stream}`);
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const headers: Record<string, string> = {};

    // Basic auth if camera has credentials
    if (camera.usuario && camera.senha) {
      // Get unmasked password directly from DB
      const fullCam = db.prepare("SELECT usuario, senha FROM cameras WHERE id = ?").get(camera.id) as { usuario: string; senha: string } | undefined;
      if (fullCam?.usuario && fullCam?.senha) {
        const auth = Buffer.from(`${fullCam.usuario}:${fullCam.senha}`).toString("base64");
        headers["Authorization"] = `Basic ${auth}`;
      }
    }

    const url = camera.url_stream;

    if (camera.tipo_stream === "snapshot") {
      // Direct snapshot URL — just fetch the image
      const res = await fetch(url, { signal: controller.signal, headers });
      clearTimeout(timeout);

      if (!res.ok) return null;

      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") || "image/jpeg";
      return `data:${contentType};base64,${buffer.toString("base64")}`;
    }

    if (camera.tipo_stream === "mjpeg") {
      // MJPEG stream — read until we get a complete JPEG frame
      const res = await fetch(url, { signal: controller.signal, headers });
      clearTimeout(timeout);

      if (!res.ok || !res.body) return null;

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalLength = 0;
      const maxBytes = 2 * 1024 * 1024; // 2MB max

      // Read enough data to get at least one JPEG frame
      while (totalLength < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          totalLength += value.length;
        }

        // Check if we have a complete JPEG (starts with FFD8, ends with FFD9)
        const combined = Buffer.concat(chunks);
        const jpegStart = combined.indexOf(Buffer.from([0xFF, 0xD8]));
        const jpegEnd = combined.indexOf(Buffer.from([0xFF, 0xD9]), jpegStart + 2);

        if (jpegStart >= 0 && jpegEnd > jpegStart) {
          // Extract the JPEG frame
          const jpeg = combined.subarray(jpegStart, jpegEnd + 2);
          reader.cancel();
          return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
        }
      }

      reader.cancel();
      return null;
    }

    // For other stream types (HLS, RTSP proxy) we can't easily capture server-side
    return null;
  } catch (err) {
    log.error(`[Snapshot] Error capturing from camera ${camera.id} (${camera.nome}):`, err);
    return null;
  }
}

/**
 * Capture a snapshot from the best available camera for a condominium.
 * Returns base64 data URL or null.
 */
export async function captureSnapshotForCondominio(
  condominioId: number,
  preferredSectors?: string[]
): Promise<{ snapshot: string; camera_nome: string } | null> {
  const camera = getCameraForSector(condominioId, preferredSectors);
  if (!camera) return null;

  const snapshot = await captureSnapshot(camera);
  if (!snapshot) return null;

  return { snapshot, camera_nome: camera.nome };
}
