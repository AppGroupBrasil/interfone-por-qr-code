import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  DoorOpen,
  Car,
  Building,
  Waves,
  Dumbbell,
  PersonStanding,
  Loader2,
  CheckCircle2,
  XCircle,
  Shield,
  History,
  ChevronDown,
  ChevronUp,
  Power,
  AlertTriangle,
  HelpCircle,
  ScanFace,
  Fingerprint,
  LockOpen,
  ToggleRight,
  type LucideIcon,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import SelfieCaptureModal from "@/components/SelfieCaptureModal";
import PlateReader from "@/components/PlateReader";

// ─── Icon mapping ─────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  Car,
  PersonStanding,
  Building,
  Dumbbell,
  Waves,
  DoorOpen,
};

const GRADIENT_MAP: Record<string, string> = {
  Car: "#003580",
  PersonStanding: "#003580",
  Building: "#003580",
  Dumbbell: "#003580",
  Waves: "#003580",
  DoorOpen: "#003580",
};

interface AccessPoint {
  id: number;
  name: string;
  icon: string;
  device_id: string | null;
  enabled: number;
  pulse_duration: number;
  order_index: number;
  allow_manual_open: number;
  allow_botoeira_morador: number;
  allow_botoeira_portaria: number;
}

interface GateLog {
  id: number;
  user_name: string;
  action: string;
  details: string | null;
  created_at: string;
}

type ActionState = "idle" | "loading" | "success" | "error";

export default function MoradorPortariaVirtual() {
  const { user } = useAuth();
  const { isDark, p } = useTheme();
  const navigate = useNavigate();

  const [accessPoints, setAccessPoints] = useState<AccessPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionStates, setActionStates] = useState<Record<number, ActionState>>({});
  const [actionMessages, setActionMessages] = useState<Record<number, string>>({});
  const [deviceOn, setDeviceOn] = useState<Record<number, boolean>>({});
  const [logs, setLogs] = useState<GateLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [confirmAp, setConfirmAp] = useState<AccessPoint | null>(null);
  const [botoeiraAp, setBotoeiraAp] = useState<AccessPoint | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // ─── Face / Selfie state ──────────────────────────────
  const [faceRegistered, setFaceRegistered] = useState<boolean | null>(null); // null = loading
  const [selfieAp, setSelfieAp] = useState<AccessPoint | null>(null); // AP waiting for selfie
  const [selfieLoading, setSelfieLoading] = useState(false);
  const [selfieResult, setSelfieResult] = useState<{ success: boolean; message: string } | null>(null);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);

  // ─── Plate Reader state ────────────────────────────────
  const [plateResult, setPlateResult] = useState<{
    placa: string;
    found: boolean;
    authorized: boolean;
    vehicle?: { modelo: string; cor: string; motorista_nome: string; morador_name: string; bloco: string; apartamento: string; status: string };
    error?: string;
  } | null>(null);
  const [plateLoading, setPlateLoading] = useState(false);
  const [plateOpening, setPlateOpening] = useState(false);
  const [plateOpenResult, setPlateOpenResult] = useState<{ success: boolean; message: string } | null>(null);

  const timeoutRefs = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // ─── Fetch access points ───────────────────────────────
  useEffect(() => {
    apiFetch("/api/gate/access-points")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAccessPoints(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ─── Fetch logs ────────────────────────────────────────
  const fetchLogs = async () => {
    try {
      const res = await apiFetch("/api/gate/logs?limit=20");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      // ignore
    }
  };

  // ─── Check face registration ────────────────────────────
  useEffect(() => {
    apiFetch("/api/face/my-face-status")
      .then((res) => (res.ok ? res.json() : { registered: false }))
      .then((data) => setFaceRegistered(data.registered))
      .catch(() => setFaceRegistered(false));
  }, []);

  // ─── Handle access point click → open selfie camera ────
  const handleAccessClick = (ap: AccessPoint) => {
    if (actionStates[ap.id] === "loading" || !ap.device_id) return;

    if (!faceRegistered) {
      // Prompt to register face first
      setRegisterModalOpen(true);
      return;
    }

    // Open selfie camera for this AP
    setSelfieAp(ap);
    setSelfieResult(null);
  };

  // ─── Selfie captured → send to backend for verification + gate open ─
  const handleSelfieCapture = async (base64: string) => {
    if (!selfieAp) return;
    setSelfieLoading(true);
    setSelfieResult(null);

    try {
      const res = await apiFetch(`/api/gate/selfie-open/${selfieAp.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: base64 }),
      });
      const data = await res.json();

      if (data.matched && data.opened) {
        setSelfieResult({ success: true, message: data.message || "Portão aberto!" });
        // Update button state
        setActionStates((s) => ({ ...s, [selfieAp.id]: "success" }));
        setActionMessages((m) => ({ ...m, [selfieAp.id]: data.message || "Aberto!" }));
        setTimeout(() => {
          setActionStates((s) => ({ ...s, [selfieAp.id]: "idle" }));
          setActionMessages((m) => ({ ...m, [selfieAp.id]: "" }));
        }, 4000);
        // Close modal after brief delay
        setTimeout(() => {
          setSelfieAp(null);
          setSelfieResult(null);
        }, 2500);
      } else {
        setSelfieResult({ success: false, message: data.error || "Não foi possível verificar." });
      }
    } catch {
      setSelfieResult({ success: false, message: "Erro de conexão." });
    } finally {
      setSelfieLoading(false);
    }
  };

  // ─── Manual open (button) — requires device biometric ──
  const handleManualOpen = async (ap: AccessPoint) => {
    if (actionStates[ap.id] === "loading" || !ap.device_id) return;

    // Use Web Authentication (biometric) for security
    let biometricVerified = false;
    if (window.PublicKeyCredential) {
      try {
        // Use a simple challenge-response to verify biometric presence
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        const credential = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: { name: "App Interfone" },
            user: {
              id: new Uint8Array(16),
              name: user?.email || "morador",
              displayName: user?.name || "Morador",
            },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }],
            authenticatorSelection: {
              authenticatorAttachment: "platform",
              userVerification: "required",
            },
            timeout: 60000,
          },
        });
        if (credential) biometricVerified = true;
      } catch {
        // Biometric cancelled or failed — do NOT allow open
        setActionStates((s) => ({ ...s, [ap.id]: "error" }));
        setActionMessages((m) => ({ ...m, [ap.id]: "Biometria cancelada ou falhou." }));
        if (timeoutRefs.current[ap.id]) clearTimeout(timeoutRefs.current[ap.id]);
        timeoutRefs.current[ap.id] = setTimeout(() => {
          setActionStates((s) => ({ ...s, [ap.id]: "idle" }));
          setActionMessages((m) => ({ ...m, [ap.id]: "" }));
        }, 3000);
        return;
      }
    } else {
      // No WebAuthn support — block
      setActionStates((s) => ({ ...s, [ap.id]: "error" }));
      setActionMessages((m) => ({ ...m, [ap.id]: "Biometria não suportada neste dispositivo." }));
      if (timeoutRefs.current[ap.id]) clearTimeout(timeoutRefs.current[ap.id]);
      timeoutRefs.current[ap.id] = setTimeout(() => {
        setActionStates((s) => ({ ...s, [ap.id]: "idle" }));
        setActionMessages((m) => ({ ...m, [ap.id]: "" }));
      }, 3000);
      return;
    }

    if (!biometricVerified) return;

    setActionStates((s) => ({ ...s, [ap.id]: "loading" }));
    setActionMessages((m) => ({ ...m, [ap.id]: "Abrindo..." }));

    try {
      const res = await apiFetch(`/api/gate/access-points/${ap.id}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "manual_biometric" }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setActionStates((s) => ({ ...s, [ap.id]: "success" }));
        setActionMessages((m) => ({ ...m, [ap.id]: data.message || "Portão aberto!" }));
      } else {
        setActionStates((s) => ({ ...s, [ap.id]: "error" }));
        setActionMessages((m) => ({ ...m, [ap.id]: data.error || "Falha ao abrir." }));
      }
    } catch {
      setActionStates((s) => ({ ...s, [ap.id]: "error" }));
      setActionMessages((m) => ({ ...m, [ap.id]: "Erro de conexão." }));
    }

    // Reset after 4s
    if (timeoutRefs.current[ap.id]) clearTimeout(timeoutRefs.current[ap.id]);
    timeoutRefs.current[ap.id] = setTimeout(() => {
      setActionStates((s) => ({ ...s, [ap.id]: "idle" }));
      setActionMessages((m) => ({ ...m, [ap.id]: "" }));
    }, 4000);
  };

  // ─── Botoeira (simple tap → confirm → open) ───────────
  const handleBotoeiraConfirm = async () => {
    if (!botoeiraAp) return;
    const ap = botoeiraAp;
    setBotoeiraAp(null);

    setActionStates((s) => ({ ...s, [ap.id]: "loading" }));
    setActionMessages((m) => ({ ...m, [ap.id]: "Abrindo..." }));

    try {
      const res = await apiFetch(`/api/gate/access-points/${ap.id}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "botoeira" }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setActionStates((s) => ({ ...s, [ap.id]: "success" }));
        setActionMessages((m) => ({ ...m, [ap.id]: data.message || "Portão aberto!" }));
      } else {
        setActionStates((s) => ({ ...s, [ap.id]: "error" }));
        setActionMessages((m) => ({ ...m, [ap.id]: data.error || "Falha ao abrir." }));
      }
    } catch {
      setActionStates((s) => ({ ...s, [ap.id]: "error" }));
      setActionMessages((m) => ({ ...m, [ap.id]: "Erro de conexão." }));
    }

    if (timeoutRefs.current[ap.id]) clearTimeout(timeoutRefs.current[ap.id]);
    timeoutRefs.current[ap.id] = setTimeout(() => {
      setActionStates((s) => ({ ...s, [ap.id]: "idle" }));
      setActionMessages((m) => ({ ...m, [ap.id]: "" }));
    }, 4000);
  };

  // ─── Register face (first-time selfie registration) ────
  const handleRegisterFace = async (base64: string) => {
    setRegisterLoading(true);
    try {
      const res = await apiFetch("/api/face/register-my-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: base64 }),
      });
      const data = await res.json();

      if (data.success) {
        setFaceRegistered(true);
        setRegisterModalOpen(false);
      } else {
        alert(data.error || "Falha ao registrar rosto. Tente novamente.");
      }
    } catch {
      alert("Erro de conexão ao registrar rosto.");
    } finally {
      setRegisterLoading(false);
    }
  };

  // ─── Plate Reader: plate detected → look up vehicle ─────
  const handlePlateDetected = async (plate: string) => {
    setPlateLoading(true);
    setPlateResult(null);
    setPlateOpenResult(null);
    try {
      const res = await apiFetch(`/api/vehicle-authorizations/buscar-placa/${encodeURIComponent(plate)}`);
      const data = await res.json();
      if (data.found && data.status === "ativa") {
        setPlateResult({
          placa: plate,
          found: true,
          authorized: true,
          vehicle: {
            modelo: data.modelo || "",
            cor: data.cor || "",
            motorista_nome: data.motorista_nome || "",
            morador_name: data.morador_name || "",
            bloco: data.bloco || "",
            apartamento: data.apartamento || "",
            status: data.status,
          },
        });
      } else if (data.found) {
        setPlateResult({ placa: plate, found: true, authorized: false, error: `Veículo encontrado mas status: ${data.status}` });
      } else {
        setPlateResult({ placa: plate, found: false, authorized: false, error: "Veículo não encontrado no sistema." });
      }
    } catch {
      setPlateResult({ placa: plate, found: false, authorized: false, error: "Erro ao consultar placa." });
    } finally {
      setPlateLoading(false);
    }
  };

  // ─── Plate Reader: open vehicular gate after plate match ─
  const handlePlateOpenGate = async () => {
    if (!plateResult?.placa) return;
    setPlateOpening(true);
    setPlateOpenResult(null);
    try {
      const res = await apiFetch("/api/gate/lpr-open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placa: plateResult.placa }),
      });
      const data = await res.json();
      if (data.opened) {
        setPlateOpenResult({ success: true, message: data.message || "Portão aberto!" });
      } else {
        setPlateOpenResult({ success: false, message: data.error || "Falha ao abrir portão." });
      }
    } catch {
      setPlateOpenResult({ success: false, message: "Erro de conexão." });
    } finally {
      setPlateOpening(false);
    }
  };

  // ─── Toggle access point (liga/desliga) ─────────────────
  const handleToggle = (ap: AccessPoint) => {
    if (actionStates[ap.id] === "loading" || !ap.device_id) return;
    setConfirmAp(ap);
  };

  const confirmToggle = async () => {
    if (!confirmAp) return;
    const ap = confirmAp;
    setConfirmAp(null);

    if (timeoutRefs.current[ap.id]) clearTimeout(timeoutRefs.current[ap.id]);

    const isOn = deviceOn[ap.id] || false;
    const newState = isOn ? "off" : "on";

    setActionStates((s) => ({ ...s, [ap.id]: "loading" }));
    setActionMessages((m) => ({ ...m, [ap.id]: "" }));

    try {
      const res = await apiFetch(`/api/gate/access-points/${ap.id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: newState }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setDeviceOn((s) => ({ ...s, [ap.id]: newState === "on" }));
        setActionStates((s) => ({ ...s, [ap.id]: "success" }));
        setActionMessages((m) => ({ ...m, [ap.id]: data.message || (newState === "on" ? "Ligado!" : "Desligado!") }));
      } else {
        setActionStates((s) => ({ ...s, [ap.id]: "error" }));
        setActionMessages((m) => ({ ...m, [ap.id]: data.error || "Falha." }));
      }
    } catch {
      setActionStates((s) => ({ ...s, [ap.id]: "error" }));
      setActionMessages((m) => ({ ...m, [ap.id]: "Erro de conexão." }));
    }

    timeoutRefs.current[ap.id] = setTimeout(() => {
      setActionStates((s) => ({ ...s, [ap.id]: "idle" }));
      setActionMessages((m) => ({ ...m, [ap.id]: "" }));
    }, 4000);
  };

  const getIcon = (iconName: string): LucideIcon => ICON_MAP[iconName] || DoorOpen;

  const formatDate = (d: string) => {
    try {
      return new Date(d + "Z").toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch {
      return d;
    }
  };

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      open: "Abriu portão",
      access_point_open: "Abriu acesso",
      access_point_open_failed: "Falha",
      manual_biometric_open: "Biometria — abriu",
      botoeira_open: "Botoeira — abriu",
      toggle_on: "Ligou",
      toggle_off: "Desligou",
      selfie_open: "Selfie — abriu",
      selfie_open_denied: "Selfie — negado",
      selfie_open_device_fail: "Selfie — falha dispositivo",
      lpr_open: "Placa — abriu",
      lpr_open_failed: "Placa — falha",
    };
    return map[action] || action;
  };

  const isStaff = user?.role && ["master", "administradora", "sindico", "funcionario"].includes(user.role);

  // ─── Render ─────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: isDark ? "linear-gradient(180deg, #001533 0%, #002254 25%, #003580 55%, #004aad 100%)" : "#f0f4f8", display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: isDark ? "linear-gradient(135deg, #001533 0%, #002a66 50%, #004aad 100%)" : "#ffffff", borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : "1px solid #e2e8f0", boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', height: '4.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => navigate(-1)} style={{ padding: '0.625rem', borderRadius: 14, background: isDark ? 'rgba(255,255,255,0.08)' : '#f8fafc', border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #cbd5e1', color: isDark ? '#fff' : "#1e293b", cursor: 'pointer' }}>
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <span style={{ fontWeight: 800, fontSize: '1.125rem', color: isDark ? '#fff' : "#1e293b", display: 'block' }}>Portaria Virtual</span>
              <span style={{ fontSize: '0.875rem', color: isDark ? '#93c5fd' : "#475569", display: 'block' }}>Abrir portas e portões</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield className="w-5 h-5" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : "#94a3b8" }} />
            <span style={{ fontSize: '0.75rem', color: isDark ? 'rgba(255,255,255,0.4)' : "#94a3b8", fontWeight: 700, letterSpacing: '0.05em' }}>APP INTERFONE</span>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, overflow: 'auto', paddingTop: '2rem', paddingLeft: 'calc(2rem + 0.5cm)', paddingRight: 'calc(2rem + 0.5cm)', paddingBottom: '6rem' }}>

        {/* ═══ Como funciona? ═══ */}
        <div style={{ marginBottom: '1.25rem' }}>
          <button
            onClick={() => setShowHelp(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.875rem 1.25rem', borderRadius: 16, cursor: 'pointer', border: 'none',
              background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
              boxShadow: '0 4px 16px rgba(14,165,233,0.3)',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <HelpCircle style={{ width: 22, height: 22, color: '#fff' }} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>Como funciona?</span>
            </div>
            {showHelp
              ? <ChevronUp style={{ width: 20, height: 20, color: '#fff' }} />
              : <ChevronDown style={{ width: 20, height: 20, color: '#fff' }} />}
          </button>
          {showHelp && (
            <div style={{
              marginTop: 8, padding: '1.25rem', borderRadius: 16,
              background: isDark ? 'rgba(255,255,255,0.06)' : '#f0f9ff',
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #bae6fd',
            }}>
              <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: isDark ? '#e0f2fe' : '#0c4a6e', fontSize: '0.9rem', lineHeight: 1.5 }}>
                <li>Abra a <strong>Portaria Virtual</strong> e veja os pontos de acesso habilitados (Portão de Entrada, Portão Veicular, Portão do Bloco).</li>
                <li>Escolha qual <strong>portão deseja abrir</strong>.</li>
                <li>O sistema pede autenticação por <strong>reconhecimento facial</strong> ou <strong>biometria do celular</strong>.</li>
                <li>Se deu <strong>match</strong>: o portão abre. ✅</li>
                <li>Se <strong>não deu match</strong>: o portão não abre. ❌</li>
              </ol>
            </div>
          )}
        </div>

        {/* ═══ Aviso de Segurança ═══ */}
        <div style={{
          marginBottom: '1.25rem', padding: '1rem 1.25rem', borderRadius: 16,
          background: isDark ? 'rgba(245,158,11,0.1)' : '#fffbeb',
          border: isDark ? '1px solid rgba(245,158,11,0.25)' : '1px solid #fde68a',
          display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
        }}>
          <AlertTriangle style={{ width: 22, height: 22, color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '0.82rem', lineHeight: 1.5, color: isDark ? '#fde68a' : '#92400e' }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>⚡ Segurança da Instalação</p>
            <p style={{ margin: '2px 0' }}>• O módulo IoT deve estar conectado à <strong>botoeira do motor</strong>, nunca direto na alimentação do motor.</p>
            <p style={{ margin: '2px 0' }}>• Wi-Fi dedicado e estável (<strong>2.4 GHz com sinal forte</strong>) é essencial para evitar acionamentos indevidos.</p>
            <p style={{ margin: '2px 0' }}>• O síndico poderá <strong>habilitar ou desabilitar</strong> a abertura pela botoeira para moradores e portaria de forma independente.</p>
          </div>
        </div>

        {/* ═══ Face Registration Banner ═══ */}
        {faceRegistered === false && (
          <div style={{
            marginBottom: '1.25rem', padding: '1rem 1.25rem', borderRadius: 16,
            background: isDark ? 'rgba(59,130,246,0.12)' : '#eff6ff',
            border: isDark ? '1px solid rgba(59,130,246,0.25)' : '1px solid #bfdbfe',
            display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
          }}>
            <ScanFace style={{ width: 24, height: 24, color: '#3b82f6', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: '0.88rem', color: isDark ? '#93c5fd' : '#1e40af', marginBottom: 6 }}>
                Cadastre seu rosto para abrir portões
              </p>
              <p style={{ fontSize: '0.8rem', color: isDark ? '#bfdbfe' : '#3b82f6', marginBottom: 10, lineHeight: 1.4 }}>
                Na Portaria Virtual, você abre o portão tirando uma selfie. Cadastre agora para começar!
              </p>
              <button
                onClick={() => setRegisterModalOpen(true)}
                style={{
                  padding: '0.6rem 1.25rem', borderRadius: 12, fontWeight: 700, fontSize: '0.85rem',
                  background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                  border: 'none', color: '#fff', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <ScanFace style={{ width: 16, height: 16 }} /> Cadastrar Meu Rosto
              </button>
            </div>
          </div>
        )}
        {faceRegistered === true && (
          <div style={{
            marginBottom: '1.25rem', padding: '0.75rem 1.25rem', borderRadius: 14,
            background: isDark ? 'rgba(16,185,129,0.1)' : '#ecfdf5',
            border: isDark ? '1px solid rgba(16,185,129,0.2)' : '1px solid #a7f3d0',
            display: 'flex', gap: '0.75rem', alignItems: 'center',
          }}>
            <CheckCircle2 style={{ width: 18, height: 18, color: '#10b981', flexShrink: 0 }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isDark ? '#6ee7b7' : '#065f46' }}>
              Rosto cadastrado — toque em um portão e faça a selfie para abrir
            </span>
          </div>
        )}

        {/* ═══ Leitura de Placa Veicular (Staff only) ═══ */}
        {isStaff && (
          <div style={{
            marginBottom: '1.25rem', padding: '1.25rem', borderRadius: 16,
            background: isDark ? 'rgba(99,102,241,0.1)' : '#eef2ff',
            border: isDark ? '1px solid rgba(99,102,241,0.2)' : '1px solid #c7d2fe',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Car style={{ width: 20, height: 20, color: '#fff' }} />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.95rem', color: isDark ? '#c7d2fe' : '#3730a3' }}>
                  Leitura de Placa Veicular
                </p>
                <p style={{ fontSize: '0.75rem', color: isDark ? '#a5b4fc' : '#6366f1' }}>
                  Aponte a câmera para a placa do veículo
                </p>
              </div>
            </div>

            <PlateReader onPlateDetected={handlePlateDetected} />

            {/* Plate lookup result */}
            {plateLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '0.75rem', padding: '0.75rem', borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc' }}>
                <Loader2 style={{ width: 18, height: 18, color: isDark ? '#a5b4fc' : '#6366f1', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '0.85rem', color: isDark ? '#c7d2fe' : '#4338ca' }}>Consultando placa...</span>
              </div>
            )}

            {plateResult && !plateLoading && (
              <div style={{
                marginTop: '0.75rem', padding: '1rem', borderRadius: 14,
                background: plateResult.authorized
                  ? (isDark ? 'rgba(16,185,129,0.1)' : '#ecfdf5')
                  : (isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2'),
                border: plateResult.authorized
                  ? (isDark ? '1px solid rgba(16,185,129,0.25)' : '1px solid #a7f3d0')
                  : (isDark ? '1px solid rgba(239,68,68,0.25)' : '1px solid #fecaca'),
              }}>
                {/* Plate badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: plateResult.vehicle ? 10 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {plateResult.authorized
                      ? <CheckCircle2 style={{ width: 18, height: 18, color: '#10b981' }} />
                      : <XCircle style={{ width: 18, height: 18, color: '#ef4444' }} />}
                    <span style={{
                      fontWeight: 800, fontSize: '1.05rem', fontFamily: 'monospace', letterSpacing: '0.08em',
                      color: isDark ? '#fff' : '#1e293b',
                    }}>
                      {plateResult.placa}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 8,
                    background: plateResult.authorized ? '#10b981' : '#ef4444',
                    color: '#fff',
                  }}>
                    {plateResult.authorized ? 'AUTORIZADO' : 'NÃO AUTORIZADO'}
                  </span>
                </div>

                {/* Vehicle details */}
                {plateResult.vehicle && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginBottom: 12 }}>
                    {plateResult.vehicle.modelo && (
                      <div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: isDark ? '#6ee7b7' : '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Veículo</span>
                        <p style={{ fontSize: '0.82rem', fontWeight: 600, color: isDark ? '#fff' : '#1e293b' }}>{plateResult.vehicle.modelo} {plateResult.vehicle.cor && `(${plateResult.vehicle.cor})`}</p>
                      </div>
                    )}
                    {plateResult.vehicle.motorista_nome && (
                      <div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: isDark ? '#6ee7b7' : '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Motorista</span>
                        <p style={{ fontSize: '0.82rem', fontWeight: 600, color: isDark ? '#fff' : '#1e293b' }}>{plateResult.vehicle.motorista_nome}</p>
                      </div>
                    )}
                    {plateResult.vehicle.morador_name && (
                      <div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: isDark ? '#6ee7b7' : '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Morador</span>
                        <p style={{ fontSize: '0.82rem', fontWeight: 600, color: isDark ? '#fff' : '#1e293b' }}>{plateResult.vehicle.morador_name}</p>
                      </div>
                    )}
                    {(plateResult.vehicle.bloco || plateResult.vehicle.apartamento) && (
                      <div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: isDark ? '#6ee7b7' : '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unidade</span>
                        <p style={{ fontSize: '0.82rem', fontWeight: 600, color: isDark ? '#fff' : '#1e293b' }}>
                          {plateResult.vehicle.bloco && `Bloco ${plateResult.vehicle.bloco}`}{plateResult.vehicle.bloco && plateResult.vehicle.apartamento ? ' — ' : ''}{plateResult.vehicle.apartamento && `Apto ${plateResult.vehicle.apartamento}`}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Error message */}
                {plateResult.error && !plateResult.authorized && (
                  <p style={{ fontSize: '0.82rem', color: isDark ? '#fca5a5' : '#dc2626', marginTop: 4 }}>{plateResult.error}</p>
                )}

                {/* Open gate button (authorized only) */}
                {plateResult.authorized && !plateOpenResult && (
                  <button
                    onClick={handlePlateOpenGate}
                    disabled={plateOpening}
                    style={{
                      width: '100%', padding: '0.85rem', borderRadius: 14, fontWeight: 700, fontSize: '0.95rem',
                      background: 'linear-gradient(135deg, #059669, #10b981)',
                      border: 'none', color: '#fff', cursor: plateOpening ? 'default' : 'pointer',
                      boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      opacity: plateOpening ? 0.7 : 1,
                      marginTop: 4,
                    }}
                  >
                    {plateOpening ? (
                      <><Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> Abrindo...</>
                    ) : (
                      <><DoorOpen style={{ width: 18, height: 18 }} /> Abrir Portão Veicular</>
                    )}
                  </button>
                )}

                {/* Gate open result */}
                {plateOpenResult && (
                  <div style={{
                    marginTop: 8, padding: '0.75rem', borderRadius: 12, textAlign: 'center',
                    background: plateOpenResult.success
                      ? (isDark ? 'rgba(16,185,129,0.15)' : '#d1fae5')
                      : (isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2'),
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      {plateOpenResult.success
                        ? <CheckCircle2 style={{ width: 18, height: 18, color: '#10b981' }} />
                        : <XCircle style={{ width: 18, height: 18, color: '#ef4444' }} />}
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: plateOpenResult.success ? (isDark ? '#6ee7b7' : '#065f46') : (isDark ? '#fca5a5' : '#dc2626') }}>
                        {plateOpenResult.message}
                      </span>
                    </div>
                  </div>
                )}

                {/* Clear button */}
                <button
                  onClick={() => { setPlateResult(null); setPlateOpenResult(null); }}
                  style={{
                    marginTop: 10, width: '100%', padding: '0.5rem', borderRadius: 10, fontWeight: 600, fontSize: '0.8rem',
                    background: 'transparent', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #cbd5e1',
                    color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer',
                  }}
                >
                  Limpar
                </button>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: isDark ? '#fff' : "#1e293b" }} />
          </div>
        ) : accessPoints.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div style={{ width: 72, height: 72, borderRadius: 22, background: isDark ? 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))' : 'linear-gradient(135deg, #e2e8f0, #f1f5f9)', border: isDark ? '1.5px solid rgba(255,255,255,0.1)' : '1.5px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <DoorOpen className="w-9 h-9" style={{ color: isDark ? '#93c5fd' : "#475569" }} />
            </div>
            <p style={{ fontSize: '1.125rem', fontWeight: 700, color: isDark ? '#fff' : "#1e293b" }}>Nenhum acesso disponível</p>
            <p style={{ fontSize: '0.875rem', color: isDark ? '#93c5fd' : "#475569", marginTop: '0.5rem' }}>
              O síndico ainda não configurou os pontos de acesso do seu condomínio.
            </p>
          </div>
        ) : (
          <>
            {/* ─── Access Point Buttons ───────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {accessPoints.map((ap, idx) => {
                const IconComp = getIcon(ap.icon);
                const isOn = deviceOn[ap.id] || false;
                const state = actionStates[ap.id] || "idle";
                const msg = actionMessages[ap.id] || "";
                const manualEnabled = !!ap.allow_manual_open;
                const botoeiraEnabled = user?.role === "morador"
                  ? !!ap.allow_botoeira_morador
                  : !!ap.allow_botoeira_portaria;

                return (
                  <div
                    key={ap.id}
                    className="relative rounded-2xl overflow-hidden animate-fade-in"
                    style={{
                      background: isOn ? "linear-gradient(135deg, #059669, #10b981)" : "#003580",
                      animationDelay: `${idx * 0.08}s`,
                      border: isOn ? "2px solid #34d399" : "1px solid rgba(255,255,255,0.4)",
                      display: "flex", flexDirection: "column",
                    }}
                  >
                    {/* Decorative circle */}
                    <div
                      className="absolute -top-6 -right-6 rounded-full opacity-10"
                      style={{ width: "80px", height: "80px", background: "white" }}
                    />

                    {/* Main card area — click opens selfie */}
                    <button
                      onClick={() => handleAccessClick(ap)}
                      disabled={state === "loading" || !ap.device_id}
                      className="w-full cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ padding: "0.75rem 0.75rem 0.25rem", background: "transparent", border: "none", flex: "0 0 auto" }}
                    >
                      <div className="relative z-10 flex flex-col items-center gap-1">
                        {/* Icon / State */}
                        <div className="rounded-lg flex items-center justify-center" style={{ width: 60, height: 60, background: isOn ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.2)" }}>
                          {state === "loading" ? (
                            <Loader2 className="text-white animate-spin" style={{ width: 30, height: 30 }} />
                          ) : state === "success" ? (
                            <CheckCircle2 className="text-white" style={{ width: 30, height: 30 }} />
                          ) : state === "error" ? (
                            <XCircle className="text-white" style={{ width: 30, height: 30 }} />
                          ) : (
                            <IconComp className="text-white" style={{ width: 30, height: 30 }} />
                          )}
                        </div>

                        {/* Name */}
                        <p style={{ color: "#fff", fontWeight: 700, fontSize: 17, textAlign: "center", lineHeight: 1.2 }}>
                          {ap.name}
                        </p>

                        {/* On/Off indicator */}
                        {ap.device_id && state === "idle" && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Power style={{ width: 15, height: 15, color: isOn ? "#bbf7d0" : "rgba(255,255,255,0.5)" }} />
                            <span style={{ fontSize: 14, fontWeight: 700, color: isOn ? "#bbf7d0" : "rgba(255,255,255,0.5)" }}>
                              {isOn ? "LIGADO" : "DESLIGADO"}
                            </span>
                          </div>
                        )}

                        {/* State message */}
                        {state !== "idle" && (
                          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 15, textAlign: "center", fontWeight: 500 }}>
                            {state === "loading"
                              ? "Abrindo..."
                              : state === "success"
                              ? msg
                              : msg || "Falha"}
                          </p>
                        )}

                        {/* No device warning */}
                        {!ap.device_id && state === "idle" && (
                          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, textAlign: "center" }}>
                            Sem dispositivo
                          </p>
                        )}
                      </div>
                    </button>

                    {/* Action buttons — square, width = height */}
                    {ap.device_id && state === "idle" && (
                      <div style={{
                        display: "flex", gap: 6, padding: "1cm 8px 0.5cm",
                        position: "relative", zIndex: 10, justifyContent: "center",
                      }}>
                        {/* Selfie button */}
                        <button
                          onClick={() => handleAccessClick(ap)}
                          style={{
                            flex: 1, aspectRatio: "1", display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", gap: 4,
                            borderRadius: 14, border: "1.5px solid rgba(255,255,255,0.5)", cursor: "pointer",
                            background: "rgba(255,255,255,0.12)", color: "#fff",
                            fontSize: 14, fontWeight: 700, transition: "all 0.2s",
                          }}
                        >
                          <ScanFace style={{ width: 33, height: 33 }} />
                          Biometria Facial
                        </button>

                        {/* Manual open button — only if sindico allowed */}
                        {manualEnabled && (
                          <button
                            onClick={() => handleManualOpen(ap)}
                            style={{
                              flex: 1, aspectRatio: "1", display: "flex", flexDirection: "column",
                              alignItems: "center", justifyContent: "center", gap: 4,
                              borderRadius: 14, border: "1.5px solid rgba(255,255,255,0.3)", cursor: "pointer",
                              background: "rgba(255,255,255,0.2)", color: "#fff",
                              fontSize: 14, fontWeight: 700, transition: "all 0.2s",
                            }}
                          >
                            <Fingerprint style={{ width: 33, height: 33 }} />
                            Abrir
                          </button>
                        )}

                        {/* Botoeira — simple tap with confirmation */}
                        {botoeiraEnabled && (
                          <button
                            onClick={() => setBotoeiraAp(ap)}
                            style={{
                              flex: 1, aspectRatio: "1", display: "flex", flexDirection: "column",
                              alignItems: "center", justifyContent: "center", gap: 4,
                              borderRadius: 14, border: "1.5px solid #fff", cursor: "pointer",
                              background: "#fff", color: "#003580",
                              fontSize: 14, fontWeight: 700, transition: "all 0.2s",
                            }}
                          >
                            <ToggleRight style={{ width: 33, height: 33 }} />
                            Botoeira
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ─── Recent Activity ────────────────────── */}
            <button
              onClick={() => { setShowLogs(!showLogs); if (!showLogs) fetchLogs(); }}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 14, marginTop: '0.5cm',
                background: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #cbd5e1',
                color: isDark ? '#fff' : "#1e293b", fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
              }}
            >
              <History className="w-5 h-5" />
              Meus Acionamentos
              {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showLogs && (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {logs.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: isDark ? '#93c5fd' : "#475569", textAlign: 'center', padding: '1rem 0' }}>Nenhum registro.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: log.action.includes('failed') ? '#f87171' : '#34d399' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: isDark ? '#fff' : "#1e293b", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          {actionLabel(log.action)}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: isDark ? '#93c5fd' : "#475569", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          {log.details || "—"}
                        </p>
                      </div>
                      <span style={{ fontSize: '10px', color: isDark ? '#7dd3fc' : '#475569', flexShrink: 0 }}>{formatDate(log.created_at)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ─── Selfie Gate Open Modal ──────────────── */}
      {selfieAp && !selfieResult?.success && (
        <SelfieCaptureModal
          open={!!selfieAp}
          title={`Abrir ${selfieAp.name}`}
          subtitle="Posicione seu rosto no centro e tire a selfie"
          onCapture={handleSelfieCapture}
          onClose={() => { setSelfieAp(null); setSelfieResult(null); }}
          loading={selfieLoading}
          isDark={isDark}
        />
      )}

      {/* ─── Selfie Result Overlay ───────────────── */}
      {selfieResult && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 210,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => { setSelfieResult(null); setSelfieAp(null); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? "#0f172a" : "#ffffff",
              borderRadius: 24, padding: "2rem", maxWidth: 360, width: "100%",
              textAlign: "center",
              border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e2e8f0",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: 20, margin: "0 auto 1rem",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: selfieResult.success
                ? "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.08))"
                : "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.08))",
              border: selfieResult.success
                ? "2px solid rgba(16,185,129,0.3)"
                : "2px solid rgba(239,68,68,0.3)",
            }}>
              {selfieResult.success
                ? <CheckCircle2 style={{ width: 32, height: 32, color: "#10b981" }} />
                : <XCircle style={{ width: 32, height: 32, color: "#ef4444" }} />}
            </div>
            <h3 style={{ fontWeight: 800, fontSize: 18, color: isDark ? "#fff" : "#1e293b", marginBottom: 8 }}>
              {selfieResult.success ? "Portão Aberto!" : "Acesso Negado"}
            </h3>
            <p style={{ fontSize: 14, color: isDark ? "#93c5fd" : "#475569", marginBottom: "1.5rem" }}>
              {selfieResult.message}
            </p>
            <button
              onClick={() => { setSelfieResult(null); setSelfieAp(null); }}
              style={{
                padding: "0.75rem 2rem", borderRadius: 14, fontWeight: 700, fontSize: 14,
                background: selfieResult.success
                  ? "linear-gradient(135deg, #059669, #10b981)"
                  : "linear-gradient(135deg, #dc2626, #ef4444)",
                border: "none", color: "#fff", cursor: "pointer",
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ─── Face Registration Modal ──────────────── */}
      <SelfieCaptureModal
        open={registerModalOpen}
        title="Cadastrar Rosto"
        subtitle="Tire uma selfie para se identificar nos portões"
        onCapture={handleRegisterFace}
        onClose={() => setRegisterModalOpen(false)}
        loading={registerLoading}
        isDark={isDark}
      />

      {/* ─── Botoeira Confirmation Modal ──────────────── */}
      {botoeiraAp && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setBotoeiraAp(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? "#0f172a" : "#ffffff",
              border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid #e2e8f0",
              borderRadius: 20, padding: "2rem", maxWidth: 360, width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.08))",
                border: "2px solid rgba(16,185,129,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <DoorOpen style={{ width: 28, height: 28, color: "#34d399" }} />
              </div>
            </div>

            <h3 style={{
              textAlign: "center", fontWeight: 800, fontSize: 18,
              color: isDark ? "#fff" : "#1e293b", marginBottom: 8,
            }}>
              Confirma a abertura do portão?
            </h3>

            <p style={{
              textAlign: "center", fontSize: 14,
              color: isDark ? "#93c5fd" : "#475569", marginBottom: "1.5rem",
            }}>
              {botoeiraAp.name}
            </p>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setBotoeiraAp(null)}
                style={{
                  flex: 1, padding: "0.75rem", borderRadius: 14, fontWeight: 700, fontSize: 14,
                  background: isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9",
                  border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #cbd5e1",
                  color: isDark ? "#fff" : "#1e293b", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleBotoeiraConfirm}
                style={{
                  flex: 1, padding: "0.75rem", borderRadius: 14, fontWeight: 700, fontSize: 14,
                  background: "linear-gradient(135deg, #059669, #10b981)",
                  border: "none", color: "#fff", cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(16,185,129,0.3)",
                }}
              >
                Sim, Abrir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Toggle Confirmation Modal (fallback for síndico/funcionário) ── */}
      {confirmAp && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setConfirmAp(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDark ? "#0f172a" : "#ffffff",
              border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid #e2e8f0",
              borderRadius: 20, padding: "2rem", maxWidth: 360, width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: deviceOn[confirmAp.id]
                  ? "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.08))"
                  : "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.08))",
                border: deviceOn[confirmAp.id]
                  ? "2px solid rgba(239,68,68,0.3)"
                  : "2px solid rgba(16,185,129,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <AlertTriangle style={{
                  width: 28, height: 28,
                  color: deviceOn[confirmAp.id] ? "#f87171" : "#34d399",
                }} />
              </div>
            </div>

            <h3 style={{
              textAlign: "center", fontWeight: 800, fontSize: 18,
              color: isDark ? "#fff" : "#1e293b", marginBottom: 8,
            }}>
              {deviceOn[confirmAp.id] ? "Desligar" : "Ligar"} {confirmAp.name}?
            </h3>

            <p style={{
              textAlign: "center", fontSize: 14,
              color: isDark ? "#93c5fd" : "#475569", marginBottom: "1.5rem",
            }}>
              {deviceOn[confirmAp.id]
                ? `Tem certeza que deseja desligar "${confirmAp.name}"?`
                : `Tem certeza que deseja ligar "${confirmAp.name}"?`}
            </p>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setConfirmAp(null)}
                style={{
                  flex: 1, padding: "0.75rem", borderRadius: 14, fontWeight: 700, fontSize: 14,
                  background: isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9",
                  border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #cbd5e1",
                  color: isDark ? "#fff" : "#1e293b", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmToggle}
                style={{
                  flex: 1, padding: "0.75rem", borderRadius: 14, fontWeight: 700, fontSize: 14,
                  background: deviceOn[confirmAp.id]
                    ? "linear-gradient(135deg, #dc2626, #ef4444)"
                    : "linear-gradient(135deg, #059669, #10b981)",
                  border: "none", color: "#fff", cursor: "pointer",
                  boxShadow: deviceOn[confirmAp.id]
                    ? "0 4px 16px rgba(239,68,68,0.3)"
                    : "0 4px 16px rgba(16,185,129,0.3)",
                }}
              >
                {deviceOn[confirmAp.id] ? "Sim, Desligar" : "Sim, Ligar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
