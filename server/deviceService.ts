/**
 * Device Service – App Interfone
 * ────────────────────────────
 * Camada de abstração multi-protocolo para acionamento de dispositivos.
 * Suporta: eWeLink, Shelly (HTTP local), ESP32 (HTTP), Tuya, Intelbras, Hikvision.
 *
 * Cada protocolo implementa a interface DeviceDriver com:
 *   - pulse(config, durationMs)  → acionamento momentâneo (portão)
 *   - turnOn(config)             → ligar
 *   - turnOff(config)            → desligar
 *   - getStatus(config)          → online / switch state
 */

import * as ewelinkService from "./ewelinkService";

/* ── Tipos ─────────────────────────────────────── */

export type DeviceProtocol =
  | "ewelink"
  | "shelly_http"
  | "esp_http"
  | "tuya"
  | "intelbras"
  | "hikvision";

export interface DeviceConfig {
  protocol: DeviceProtocol;
  /** IP/host para protocolos locais (Shelly, ESP, Intelbras, Hikvision) */
  host?: string;
  /** Porta HTTP (default depende do protocolo) */
  port?: number;
  /** Canal/relé (0-based para multi-channel devices) */
  channel?: number;
  /** eWeLink device ID */
  ewelinkDeviceId?: string;
  /** Tuya device ID */
  tuyaDeviceId?: string;
  /** Credenciais genéricas */
  username?: string;
  password?: string;
  /** Token / API key */
  apiKey?: string;
  /** Dados extras do protocolo */
  extra?: Record<string, string>;
}

export interface DeviceStatus {
  online: boolean;
  switchState?: "on" | "off";
  power?: number;       // watts
  voltage?: number;
  error?: string;
}

export interface DeviceDriver {
  pulse(config: DeviceConfig, durationMs: number): Promise<{ ok: boolean; error?: string }>;
  turnOn(config: DeviceConfig): Promise<{ ok: boolean; error?: string }>;
  turnOff(config: DeviceConfig): Promise<{ ok: boolean; error?: string }>;
  getStatus(config: DeviceConfig): Promise<DeviceStatus>;
}

/* ══════════════════════════════════════════════════
   Driver: eWeLink (já existente — wrapper)
   ══════════════════════════════════════════════════ */

const ewelinkDriver: DeviceDriver = {
  async pulse(config, durationMs) {
    try {
      // Precisamos de credenciais globais — serão passadas via extra
      const creds = parseEwelinkCreds(config);
      if (!creds || !config.ewelinkDeviceId) return { ok: false, error: "Credenciais eWeLink não configuradas" };
      const condoId = Number.parseInt(config.extra?.condominioId || "0");
      await ewelinkService.pulseDevice(condoId, creds, config.ewelinkDeviceId, durationMs);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message || "Erro eWeLink" };
    }
  },
  async turnOn(config) {
    try {
      const creds = parseEwelinkCreds(config);
      if (!creds || !config.ewelinkDeviceId) return { ok: false, error: "Credenciais eWeLink não configuradas" };
      const condoId = Number.parseInt(config.extra?.condominioId || "0");
      await ewelinkService.toggleDevice(condoId, creds, config.ewelinkDeviceId, "on");
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message || "Erro eWeLink" };
    }
  },
  async turnOff(config) {
    try {
      const creds = parseEwelinkCreds(config);
      if (!creds || !config.ewelinkDeviceId) return { ok: false, error: "Credenciais eWeLink não configuradas" };
      const condoId = Number.parseInt(config.extra?.condominioId || "0");
      await ewelinkService.toggleDevice(condoId, creds, config.ewelinkDeviceId, "off");
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message || "Erro eWeLink" };
    }
  },
  async getStatus(config) {
    try {
      const creds = parseEwelinkCreds(config);
      if (!creds || !config.ewelinkDeviceId) return { online: false, error: "Credenciais eWeLink não configuradas" };
      const condoId = Number.parseInt(config.extra?.condominioId || "0");
      const status = await ewelinkService.getDeviceStatus(condoId, creds, config.ewelinkDeviceId);
      return { online: status.online, switchState: status.switch as "on" | "off" };
    } catch (e: any) {
      return { online: false, error: e.message };
    }
  },
};

function parseEwelinkCreds(config: DeviceConfig) {
  if (!config.extra) return null;
  const { appId, appSecret, email, password, region } = config.extra;
  if (!appId || !appSecret) return null;
  return { appId, appSecret, email, password, region: region || "us" };
}

/* ══════════════════════════════════════════════════
   Driver: Shelly HTTP (rede local)
   ══════════════════════════════════════════════════
   API: http://<ip>/relay/<channel>?turn=on&timer=<seconds>
   Gen2: http://<ip>/rpc/Switch.Set?id=<ch>&on=true
   ══════════════════════════════════════════════════ */

const shellyDriver: DeviceDriver = {
  async pulse(config, durationMs) {
    try {
      const { host, channel = 0 } = config;
      if (!host) return { ok: false, error: "IP do Shelly não configurado" };
      const timerSec = Math.max(1, Math.round(durationMs / 1000));

      // Tenta Gen1 primeiro, depois Gen2
      let ok = await shellyGen1Request(host, channel, "on", timerSec, config);
      if (!ok) ok = await shellyGen2Pulse(host, channel, durationMs, config);
      return ok ? { ok: true } : { ok: false, error: "Não foi possível acionar o Shelly" };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
  async turnOn(config) {
    try {
      const { host, channel = 0 } = config;
      if (!host) return { ok: false, error: "IP do Shelly não configurado" };
      let ok = await shellyGen1Request(host, channel, "on", 0, config);
      if (!ok) ok = await shellyGen2Switch(host, channel, true, config);
      return ok ? { ok: true } : { ok: false, error: "Falha ao ligar Shelly" };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
  async turnOff(config) {
    try {
      const { host, channel = 0 } = config;
      if (!host) return { ok: false, error: "IP do Shelly não configurado" };
      let ok = await shellyGen1Request(host, channel, "off", 0, config);
      if (!ok) ok = await shellyGen2Switch(host, channel, false, config);
      return ok ? { ok: true } : { ok: false, error: "Falha ao desligar Shelly" };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
  async getStatus(config) {
    try {
      const { host, channel = 0 } = config;
      if (!host) return { online: false, error: "IP do Shelly não configurado" };

      // Gen1: /status
      try {
        const r = await fetchWithTimeout(`http://${host}/status`, 3000, config);
        if (r.ok) {
          const data = await r.json();
          const relay = data.relays?.[channel];
          return {
            online: true,
            switchState: relay?.ison ? "on" : "off",
            power: data.meters?.[channel]?.power,
          };
        }
      } catch {}

      // Gen2: /rpc/Switch.GetStatus?id=<ch>
      try {
        const r = await fetchWithTimeout(`http://${host}/rpc/Switch.GetStatus?id=${channel}`, 3000, config);
        if (r.ok) {
          const data = await r.json();
          return {
            online: true,
            switchState: data.output ? "on" : "off",
            power: data.apower,
            voltage: data.voltage,
          };
        }
      } catch {}

      return { online: false, error: "Shelly não responde" };
    } catch (e: any) {
      return { online: false, error: e.message };
    }
  },
};

async function shellyGen1Request(host: string, ch: number, turn: string, timer: number, config: DeviceConfig): Promise<boolean> {
  try {
    let url = `http://${host}/relay/${ch}?turn=${turn}`;
    if (timer > 0) url += `&timer=${timer}`;
    const r = await fetchWithTimeout(url, 5000, config);
    return r.ok;
  } catch {
    return false;
  }
}

async function shellyGen2Switch(host: string, ch: number, on: boolean, config: DeviceConfig): Promise<boolean> {
  try {
    const r = await fetchWithTimeout(`http://${host}/rpc/Switch.Set?id=${ch}&on=${on}`, 5000, config);
    return r.ok;
  } catch {
    return false;
  }
}

async function shellyGen2Pulse(host: string, ch: number, durationMs: number, config: DeviceConfig): Promise<boolean> {
  try {
    const r = await fetchWithTimeout(
      `http://${host}/rpc/Switch.Set?id=${ch}&on=true&toggle_after=${durationMs / 1000}`,
      5000,
      config,
    );
    return r.ok;
  } catch {
    return false;
  }
}

/* ══════════════════════════════════════════════════
   Driver: ESP32/ESP8266 HTTP (rede local)
   ══════════════════════════════════════════════════
   Firmware App Interfone — endpoints esperados:
     POST http://<ip>/relay/<ch>/pulse?duration=<ms>
     POST http://<ip>/relay/<ch>/on
     POST http://<ip>/relay/<ch>/off
     GET  http://<ip>/status
   ══════════════════════════════════════════════════ */

const espDriver: DeviceDriver = {
  async pulse(config, durationMs) {
    try {
      const { host, channel = 0 } = config;
      if (!host) return { ok: false, error: "IP do ESP não configurado" };
      const port = config.port || 80;
      const r = await fetchWithTimeout(
        `http://${host}:${port}/relay/${channel}/pulse?duration=${durationMs}`,
        5000, config, "POST",
      );
      return r.ok ? { ok: true } : { ok: false, error: `ESP respondeu ${r.status}` };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
  async turnOn(config) {
    try {
      const { host, channel = 0 } = config;
      if (!host) return { ok: false, error: "IP do ESP não configurado" };
      const port = config.port || 80;
      const r = await fetchWithTimeout(`http://${host}:${port}/relay/${channel}/on`, 5000, config, "POST");
      return r.ok ? { ok: true } : { ok: false, error: `ESP respondeu ${r.status}` };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
  async turnOff(config) {
    try {
      const { host, channel = 0 } = config;
      if (!host) return { ok: false, error: "IP do ESP não configurado" };
      const port = config.port || 80;
      const r = await fetchWithTimeout(`http://${host}:${port}/relay/${channel}/off`, 5000, config, "POST");
      return r.ok ? { ok: true } : { ok: false, error: `ESP respondeu ${r.status}` };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
  async getStatus(config) {
    try {
      const { host } = config;
      if (!host) return { online: false, error: "IP do ESP não configurado" };
      const port = config.port || 80;
      const r = await fetchWithTimeout(`http://${host}:${port}/status`, 3000, config);
      if (!r.ok) return { online: false, error: `ESP respondeu ${r.status}` };
      const data = await r.json();
      return {
        online: true,
        switchState: data.relays?.[config.channel || 0]?.state ? "on" : "off",
      };
    } catch (e: any) {
      return { online: false, error: e.message };
    }
  },
};

/* ══════════════════════════════════════════════════
   Driver: Tuya / Smart Life Cloud
   ══════════════════════════════════════════════════
   API: https://openapi.tuyaus.com
   Requer: client_id (Access ID) + client_secret (Access Secret)
   ══════════════════════════════════════════════════ */

import crypto from "node:crypto";

interface TuyaTokenCache { accessToken: string; expiresAt: number; }
const tuyaTokens = new Map<string, TuyaTokenCache>();

const TUYA_REGIONS: Record<string, string> = {
  us: "https://openapi.tuyaus.com",
  eu: "https://openapi.tuyaeu.com",
  cn: "https://openapi.tuyacn.com",
  in: "https://openapi.tuyain.com",
};

async function tuyaGetToken(clientId: string, clientSecret: string, region: string): Promise<string> {
  const cached = tuyaTokens.get(clientId);
  if (cached && cached.expiresAt > Date.now()) return cached.accessToken;

  const baseUrl = TUYA_REGIONS[region] || TUYA_REGIONS.us;
  const t = Date.now().toString();
  const signStr = clientId + t;
  const sign = crypto.createHmac("sha256", clientSecret).update(signStr).digest("hex").toUpperCase();

  const r = await fetch(`${baseUrl}/v1.0/token?grant_type=1`, {
    headers: {
      client_id: clientId,
      t,
      sign,
      sign_method: "HMAC-SHA256",
    },
  });
  const data = await r.json();
  if (!data.success) throw new Error(data.msg || "Tuya auth failed");

  tuyaTokens.set(clientId, {
    accessToken: data.result.access_token,
    expiresAt: Date.now() + (data.result.expire_time * 1000) - 60000,
  });
  return data.result.access_token;
}

async function tuyaRequest(
  method: string,
  path: string,
  config: DeviceConfig,
  body?: object,
): Promise<any> {
  const clientId = config.extra?.clientId || config.apiKey || "";
  const clientSecret = config.extra?.clientSecret || config.password || "";
  const region = config.extra?.region || "us";
  if (!clientId || !clientSecret) throw new Error("Credenciais Tuya não configuradas");

  const token = await tuyaGetToken(clientId, clientSecret, region);
  const baseUrl = TUYA_REGIONS[region] || TUYA_REGIONS.us;
  const t = Date.now().toString();
  const signStr = clientId + token + t;
  const sign = crypto.createHmac("sha256", clientSecret).update(signStr).digest("hex").toUpperCase();

  const r = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      client_id: clientId,
      access_token: token,
      t,
      sign,
      sign_method: "HMAC-SHA256",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!data.success) throw new Error(data.msg || "Tuya request failed");
  return data.result;
}

const tuyaDriver: DeviceDriver = {
  async pulse(config, durationMs) {
    try {
      const deviceId = config.tuyaDeviceId;
      if (!deviceId) return { ok: false, error: "Device ID Tuya não configurado" };
      // Liga
      await tuyaRequest("POST", `/v1.0/devices/${deviceId}/commands`, config, {
        commands: [{ code: "switch_1", value: true }],
      });
      // Espera e desliga
      await new Promise((r) => setTimeout(r, durationMs));
      await tuyaRequest("POST", `/v1.0/devices/${deviceId}/commands`, config, {
        commands: [{ code: "switch_1", value: false }],
      });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
  async turnOn(config) {
    try {
      const deviceId = config.tuyaDeviceId;
      if (!deviceId) return { ok: false, error: "Device ID Tuya não configurado" };
      await tuyaRequest("POST", `/v1.0/devices/${deviceId}/commands`, config, {
        commands: [{ code: "switch_1", value: true }],
      });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
  async turnOff(config) {
    try {
      const deviceId = config.tuyaDeviceId;
      if (!deviceId) return { ok: false, error: "Device ID Tuya não configurado" };
      await tuyaRequest("POST", `/v1.0/devices/${deviceId}/commands`, config, {
        commands: [{ code: "switch_1", value: false }],
      });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
  async getStatus(config) {
    try {
      const deviceId = config.tuyaDeviceId;
      if (!deviceId) return { online: false, error: "Device ID Tuya não configurado" };
      const data = await tuyaRequest("GET", `/v1.0/devices/${deviceId}/status`, config);
      const switchStatus = data?.find?.((s: any) => s.code === "switch_1");
      return {
        online: true,
        switchState: switchStatus?.value ? "on" : "off",
      };
    } catch (e: any) {
      return { online: false, error: e.message };
    }
  },
};

/* ══════════════════════════════════════════════════
   Driver: Intelbras (HTTP / SIP)
   ══════════════════════════════════════════════════
   XPE 3101 IP: http://<ip>/cgi-bin/accessControl.cgi?action=openDoor&channel=1
   CT 500: via módulo de rede
   ══════════════════════════════════════════════════ */

const intelbrasDriver: DeviceDriver = {
  async pulse(config, durationMs) {
    try {
      const { host, channel = 1 } = config;
      if (!host) return { ok: false, error: "IP do Intelbras não configurado" };

      const auth = config.username && config.password
        ? `Basic ${Buffer.from(config.username + ":" + config.password).toString("base64")}`
        : undefined;

      const r = await fetch(
        `http://${host}/cgi-bin/accessControl.cgi?action=openDoor&channel=${channel}&UserID=AppInterfone&Type=Remote`,
        {
          method: "GET",
          headers: auth ? { Authorization: auth } : {},
          signal: AbortSignal.timeout(5000),
        },
      );
      return r.ok ? { ok: true } : { ok: false, error: `Intelbras respondeu ${r.status}` };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
  async turnOn(config) {
    // Intelbras geralmente é pulse-only (abrir porta)
    return this.pulse(config, 1000);
  },
  async turnOff(config) {
    // Porta fecha automaticamente
    return { ok: true };
  },
  async getStatus(config) {
    try {
      const { host } = config;
      if (!host) return { online: false, error: "IP não configurado" };

      const auth = config.username && config.password
        ? `Basic ${Buffer.from(config.username + ":" + config.password).toString("base64")}`
        : undefined;

      const r = await fetch(
        `http://${host}/cgi-bin/magicBox.cgi?action=getDeviceType`,
        {
          headers: auth ? { Authorization: auth } : {},
          signal: AbortSignal.timeout(3000),
        },
      );
      return { online: r.ok, switchState: "off" };
    } catch (e: any) {
      return { online: false, error: e.message };
    }
  },
};

/* ══════════════════════════════════════════════════
   Driver: Hikvision ISAPI
   ══════════════════════════════════════════════════
   ISAPI: PUT http://<ip>/ISAPI/AccessControl/RemoteControl/door/<doorId>
   Body: <RemoteControlDoor><cmd>open</cmd></RemoteControlDoor>
   ══════════════════════════════════════════════════ */

const hikvisionDriver: DeviceDriver = {
  async pulse(config, _durationMs) {
    try {
      const { host, channel = 1 } = config;
      if (!host) return { ok: false, error: "IP do Hikvision não configurado" };

      const auth = config.username && config.password
        ? `Basic ${Buffer.from(config.username + ":" + config.password).toString("base64")}`
        : undefined;

      // ISAPI door open
      const body = `<RemoteControlDoor><cmd>open</cmd></RemoteControlDoor>`;
      const r = await fetch(
        `http://${host}/ISAPI/AccessControl/RemoteControl/door/${channel}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/xml",
            ...(auth ? { Authorization: auth } : {}),
          },
          body,
          signal: AbortSignal.timeout(5000),
        },
      );
      return r.ok ? { ok: true } : { ok: false, error: `Hikvision respondeu ${r.status}` };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
  async turnOn(config) {
    // Hikvision = abrir porta
    return this.pulse(config, 1000);
  },
  async turnOff(config) {
    try {
      const { host, channel = 1 } = config;
      if (!host) return { ok: false, error: "IP não configurado" };
      const auth = config.username && config.password
        ? `Basic ${Buffer.from(config.username + ":" + config.password).toString("base64")}`
        : undefined;

      const body = `<RemoteControlDoor><cmd>close</cmd></RemoteControlDoor>`;
      const r = await fetch(
        `http://${host}/ISAPI/AccessControl/RemoteControl/door/${channel}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/xml",
            ...(auth ? { Authorization: auth } : {}),
          },
          body,
          signal: AbortSignal.timeout(5000),
        },
      );
      return r.ok ? { ok: true } : { ok: false, error: `Hikvision respondeu ${r.status}` };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
  async getStatus(config) {
    try {
      const { host } = config;
      if (!host) return { online: false, error: "IP não configurado" };
      const auth = config.username && config.password
        ? `Basic ${Buffer.from(config.username + ":" + config.password).toString("base64")}`
        : undefined;

      const r = await fetch(
        `http://${host}/ISAPI/System/deviceInfo`,
        {
          headers: auth ? { Authorization: auth } : {},
          signal: AbortSignal.timeout(3000),
        },
      );
      return { online: r.ok };
    } catch (e: any) {
      return { online: false, error: e.message };
    }
  },
};

/* ══════════════════════════════════════════════════
   Registro de Drivers
   ══════════════════════════════════════════════════ */

const drivers: Record<DeviceProtocol, DeviceDriver> = {
  ewelink: ewelinkDriver,
  shelly_http: shellyDriver,
  esp_http: espDriver,
  tuya: tuyaDriver,
  intelbras: intelbrasDriver,
  hikvision: hikvisionDriver,
};

export function getDriver(protocol: DeviceProtocol): DeviceDriver {
  return drivers[protocol];
}

/* ══════════════════════════════════════════════════
   API Pública (unificada)
   ══════════════════════════════════════════════════ */

/**
 * Aciona pulso (abre portão/fechadura) no dispositivo configurado.
 */
export async function pulseDevice(config: DeviceConfig, durationMs = 1000) {
  const driver = drivers[config.protocol];
  if (!driver) return { ok: false, error: `Protocolo "${config.protocol}" não suportado` };
  return driver.pulse(config, durationMs);
}

/**
 * Liga o dispositivo.
 */
export async function turnOnDevice(config: DeviceConfig) {
  const driver = drivers[config.protocol];
  if (!driver) return { ok: false, error: `Protocolo "${config.protocol}" não suportado` };
  return driver.turnOn(config);
}

/**
 * Desliga o dispositivo.
 */
export async function turnOffDevice(config: DeviceConfig) {
  const driver = drivers[config.protocol];
  if (!driver) return { ok: false, error: `Protocolo "${config.protocol}" não suportado` };
  return driver.turnOff(config);
}

/**
 * Consulta status do dispositivo.
 */
export async function getDeviceStatus(config: DeviceConfig): Promise<DeviceStatus> {
  const driver = drivers[config.protocol];
  if (!driver) return { online: false, error: `Protocolo "${config.protocol}" não suportado` };
  return driver.getStatus(config);
}

/* ── Fetch com timeout ─────────────────────────── */

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  config: DeviceConfig,
  method = "GET",
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (config.username && config.password) {
    headers.Authorization = `Basic ${Buffer.from(config.username + ":" + config.password).toString("base64")}`;
  }
  return fetch(url, {
    method,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
}
