import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { compressCanvas } from "@/lib/imageUtils";
import SearchableSelect from "@/components/SearchableSelect";
import ReportModal from "@/components/ReportModal";
import CameraWidget from "@/components/CameraWidget";
import CameraEmbed, { type CameraEmbedRef } from "@/components/CameraEmbed";
import VisualVerification from "@/components/VisualVerification";
import TutorialButton, { FlowPortaria, FlowMorador, TSection, TStep, TBullet } from "@/components/TutorialButton";
import { gerarPdfVisitante, gerarRelatorioVisitantes, gerarRelatorioVisitantesComGraficos } from "@/lib/pdfUtils";
import {
  ArrowLeft,
  UserPlus,
  Search,
  Camera,
  X,
  Send,
  QrCode,
  Link2,
  ChevronDown,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Settings,
  ToggleLeft,
  ToggleRight,
  ScanFace,
  Download,
  ShieldCheck,
  DoorOpen,
  Building,
  Calendar,
  User,
  Fingerprint,
  MessageSquare,
} from "lucide-react";
import { APP_ORIGIN } from "@/lib/config";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";
import ComoFunciona from "@/components/ComoFunciona";

interface Visitor {
  id: number;
  nome: string;
  documento: string | null;
  telefone: string | null;
  foto: string | null;
  documento_foto: string | null;
  bloco: string | null;
  apartamento: string | null;
  autorizado_interfone: string;
  quem_autorizou: string | null;
  morador_whatsapp: string | null;
  status: string;
  token: string;
  created_at: string;
  face_descriptor: number[] | null;
}

interface FaceMatch {
  visitor: Visitor;
  distance: number;
}

interface Block {
  id: number;
  name: string;
}

interface Morador {
  id: number;
  name: string;
  unit: string;
  phone: string | null;
}

interface PreAuth {
  id: number;
  morador_name: string;
  morador_phone: string | null;
  bloco: string | null;
  apartamento: string | null;
  visitante_nome: string;
  visitante_documento: string | null;
  visitante_telefone: string | null;
  visitante_foto: string | null;
  tipo: string;
  data_inicio: string;
  data_fim: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  observacao: string | null;
  status: string;
  entrada_confirmada_at: string | null;
  token: string;
  created_at: string;
}

type UnifiedEntryType = "visitante" | "pre_autorizacao";

interface UnifiedEntry {
  id: string;
  tipo: UnifiedEntryType;
  nome: string;
  documento: string | null;
  bloco: string | null;
  apartamento: string | null;
  status: string;
  created_at: string;
  morador_name: string | null;
  foto: string | null;
  original: Visitor | PreAuth;
}

const API = "/api";

export default function CadastrarVisitante() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [moradores, setMoradores] = useState<Morador[]>([]);
  const [selectedMoradorId, setSelectedMoradorId] = useState<string>("");
  const [manualAutorizou, setManualAutorizou] = useState(false);
  const [error, setError] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // Pre-authorizations
  const [preAuths, setPreAuths] = useState<PreAuth[]>([]);
  const [preAuthConfirming, setPreAuthConfirming] = useState<number | null>(null);

  // Unified list filter
  const [activeFilter, setActiveFilter] = useState<"todos" | "visitantes" | "pre_autorizacoes">("todos");

  // Reconhecimento facial (server-side — browser só captura foto)
  const [showFaceRecog, setShowFaceRecog] = useState(false);
  const [faceStatus, setFaceStatus] = useState<"idle" | "scanning" | "comparing" | "found" | "not_found">("idle");
  const [faceMatch, setFaceMatch] = useState<FaceMatch | null>(null);
  const [capturedFacePhoto, setCapturedFacePhoto] = useState<string>("");
  const faceVideoRef = useRef<HTMLVideoElement>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);
  const faceDetectInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Camera embed
  const cameraEmbedRef = useRef<CameraEmbedRef>(null);
  const [showCameraEmbed, setShowCameraEmbed] = useState(false);
  const [lastCameraSnapshot, setLastCameraSnapshot] = useState<string>("");

  // Visual verification
  const [verifyingVisitor, setVerifyingVisitor] = useState<Visitor | null>(null);
  const [entranceCameraUrl, setEntranceCameraUrl] = useState<string>("");

  // Gate control
  const [gateEnabled, setGateEnabled] = useState(false);
  const [gateOpening, setGateOpening] = useState(false);
  const [gateSuccess, setGateSuccess] = useState(false);

  // Configuração de campos visíveis/obrigatórios
  // "nome" é sempre obrigatório e não pode ser desativado
  const ALL_FIELDS = [
    { key: "foto", label: "Foto do Visitante", defaultOn: true },
    { key: "nome", label: "Nome", defaultOn: true, locked: true },
    { key: "documento", label: "Documento (RG/CPF)", defaultOn: true },
    { key: "telefone", label: "Telefone do Visitante", defaultOn: false },
    { key: "bloco", label: "Bloco", defaultOn: true },
    { key: "apartamento", label: "Apartamento", defaultOn: true },
    { key: "morador_whatsapp", label: "WhatsApp do Morador", defaultOn: true },
    { key: "autorizado_interfone", label: "Autorizado por Interfone", defaultOn: true },
    { key: "quem_autorizou", label: "Quem Autorizou", defaultOn: true },
    { key: "documento_foto", label: "Anexar Foto do Documento", defaultOn: false },
  ] as const;

  const [fieldConfig, setFieldConfig] = useState<Record<string, boolean>>(() => {
    // Tenta carregar configuração salva
    try {
      const saved = localStorage.getItem("visitante_field_config");
      if (saved) return JSON.parse(saved);
    } catch {}
    // Default: usa defaultOn de cada campo
    const defaults: Record<string, boolean> = {};
    ALL_FIELDS.forEach((f) => { defaults[f.key] = f.defaultOn; });
    return defaults;
  });

  // Check gate status on mount
  useEffect(() => {
    apiFetch("/api/gate/status")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.enabled && data?.configured && data?.online) {
          setGateEnabled(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleOpenGate = async (visitorName?: string) => {
    setGateOpening(true);
    setGateSuccess(false);
    try {
      const res = await apiFetch("/api/gate/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorName: visitorName || "" }),
      });
      if (res.ok) {
        setGateSuccess(true);
        setTimeout(() => setGateSuccess(false), 3000);
      }
    } catch {}
    setGateOpening(false);
  };

  const isFieldVisible = (key: string) => fieldConfig[key] !== false;

  const toggleField = (key: string) => {
    const updated = { ...fieldConfig, [key]: !fieldConfig[key] };
    setFieldConfig(updated);
    localStorage.setItem("visitante_field_config", JSON.stringify(updated));
  };

  // Form state
  const [form, setForm] = useState({
    nome: "",
    documento: "",
    telefone: "",
    foto: "",
    documento_foto: "",
    bloco: "",
    apartamento: "",
    autorizado_interfone: "nao",
    quem_autorizou: "",
    morador_whatsapp: "",
  });

  // Máscara de telefone (XX) XXXXX-XXXX
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : "";
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraMode, setCameraMode] = useState<"foto" | "documento" | null>(null);

  // Buscar moradores do bloco selecionado
  const fetchMoradoresBloco = async (bloco: string) => {
    if (!bloco) {
      setMoradores([]);
      return;
    }
    try {
      const res = await apiFetch(`${API}/visitors/moradores-bloco?bloco=${encodeURIComponent(bloco)}`,
        {  }
      );
      if (res.ok) {
        const data = await res.json();
        setMoradores(data);
      }
    } catch (err) {
      console.error("Erro ao buscar moradores do bloco:", err);
    }
  };

  // Selecionar morador → preenche apartamento, whatsapp e quem_autorizou
  const handleSelectMorador = (moradorId: string) => {
    setSelectedMoradorId(moradorId);
    if (!moradorId) {
      setForm((prev) => ({ ...prev, apartamento: "", morador_whatsapp: "", quem_autorizou: "" }));
      return;
    }
    const morador = moradores.find((m) => String(m.id) === moradorId);
    if (morador) {
      setForm((prev) => ({
        ...prev,
        apartamento: morador.unit || "",
        morador_whatsapp: morador.phone ? formatPhone(morador.phone) : "",
        quem_autorizou: morador.name || "",
      }));
    }
  };

  // Apartamentos gerados com base no bloco
  const generateApartamentos = (bloco: string) => {
    // Gera apartamentos 101-410 como exemplo
    const apts: string[] = [];
    for (let andar = 1; andar <= 4; andar++) {
      for (let porta = 1; porta <= 4; porta++) {
        apts.push(`${andar}0${porta}`);
      }
    }
    return apts;
  };

  // Fetch visitors
  const fetchVisitors = async () => {
    try {
      const res = await apiFetch(`${API}/visitors?search=${encodeURIComponent(search)}`, {  });
      if (res.ok) {
        const data = await res.json();
        setVisitors(data);
      }
    } catch (err) {
      console.error("Erro ao buscar visitantes:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch blocks
  const fetchBlocks = async () => {
    try {
      const res = await apiFetch(`${API}/blocos`);
      if (res.ok) {
        const data = await res.json();
        setBlocks(data);
      }
    } catch {
      // fallback blocks
      setBlocks([
        { id: 1, name: "Bloco A" },
        { id: 2, name: "Bloco B" },
        { id: 3, name: "Bloco C" },
        { id: 4, name: "Bloco D" },
      ]);
    }
  };

  // Fetch pre-authorizations
  const fetchPreAuths = async () => {
    try {
      const res = await apiFetch(`${API}/pre-authorizations?status=ativa`);
      if (res.ok) {
        const data = await res.json();
        // Filter only non-expired
        const now = new Date();
        setPreAuths(data.filter((a: PreAuth) => new Date(a.data_fim + "T23:59:59") >= now));
      }
    } catch (err) {
      console.error("Erro ao buscar autorizações prévias:", err);
    }
  };

  // Fetch delivery authorizations
  const isPreAuthWithinSchedule = (auth: PreAuth) => {
    const now = new Date();
    const startDate = new Date(auth.data_inicio + "T00:00:00");
    const endDate = new Date(auth.data_fim + "T23:59:59");
    if (now < startDate || now > endDate) return false;
    if (auth.hora_inicio && auth.hora_fim) {
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (currentTime < auth.hora_inicio || currentTime > auth.hora_fim) return false;
    }
    return true;
  };

  const handlePreAuthConfirmEntry = async (auth: PreAuth) => {
    setPreAuthConfirming(auth.id);
    try {
      const res = await apiFetch(`${API}/pre-authorizations/${auth.id}/confirmar-entrada`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        if (auth.morador_phone) {
          const dataHora = new Date().toLocaleString("pt-BR");
          const msgLines = [
            `*Portaria - Confirmacao de Entrada*`,
            ``,
            `O visitante autorizado chegou:`,
            ``,
            `*Visitante:* ${auth.visitante_nome}`,
            auth.visitante_documento ? `*Documento:* ${auth.visitante_documento}` : "",
            `*Destino:* ${auth.bloco || ""} - Apt ${auth.apartamento || ""}`,
            `*Entrada:* ${dataHora}`,
            auth.observacao ? `*Obs:* ${auth.observacao}` : "",
            ``,
            `Entrada confirmada pela portaria.`,
          ].filter(Boolean);
          const message = encodeURIComponent(msgLines.join("\n"));
          const phone = auth.morador_phone.replace(/\D/g, "");
          window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
        }
        fetchPreAuths();
      }
    } catch (err) {
      console.error("Erro ao confirmar entrada:", err);
    } finally {
      setPreAuthConfirming(null);
    }
  };

  const formatPreAuthDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  useEffect(() => {
    fetchVisitors();
    fetchBlocks();
    fetchPreAuths();
    // Fetch entrance camera URL for visual verification
    apiFetch(`${API}/cameras`)
      .then((r) => r.json())
      .then((cams: Array<{ url_stream: string; setor: string; ativa: number; tipo_stream: string }>) => {
        const entrance = cams.find(
          (c) => c.ativa && c.url_stream && ["entrada_principal", "portaria", "entrada_servico"].includes(c.setor)
        );
        if (entrance) setEntranceCameraUrl(entrance.url_stream);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchVisitors(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Auto-refresh para atualizar status
  useEffect(() => {
    const interval = setInterval(() => { fetchVisitors(); fetchPreAuths(); }, 10000);
    return () => clearInterval(interval);
  }, [search]);

  // Camera functions
  const startCamera = async (mode: "foto" | "documento") => {
    setCameraMode(mode);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode === "foto" ? "user" : "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      setError("Não foi possível acessar a câmera.");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = compressCanvas(canvas, cameraMode === "foto" ? "face" : "document");
      if (cameraMode === "foto") {
        setForm({ ...form, foto: dataUrl });
      } else {
        setForm({ ...form, documento_foto: dataUrl });
      }
    }
    stopCamera();
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraMode(null);
  };

  // ═══════════════════════════════════════════════════════
  // RECONHECIMENTO FACIAL — SERVER-SIDE (browser só captura foto)
  // ═══════════════════════════════════════════════════════

  const startFaceRecognition = async () => {
    setShowFaceRecog(true);
    setFaceStatus("idle");
    setFaceMatch(null);
    setCapturedFacePhoto("");

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      if (faceVideoRef.current) {
        faceVideoRef.current.srcObject = stream;
        faceVideoRef.current.onplaying = () => {
          startFaceCapture();
          if (faceVideoRef.current) faceVideoRef.current.onplaying = null;
        };
        try { await faceVideoRef.current.play(); } catch { /* autoPlay handles it */ }
      }
    } catch (err) {
      setError("Não foi possível acessar a câmera.");
    }
  };

  // Captura frames periódicos procurando um rosto (leve, sem ML)
  const startFaceCapture = () => {
    setFaceStatus("scanning");
    let frameCount = 0;

    faceDetectInterval.current = setInterval(async () => {
      if (!faceVideoRef.current || faceVideoRef.current.readyState < 2) return;
      frameCount++;

      // A cada 1.5 segundos, capturar foto e enviar ao servidor
      if (frameCount % 3 === 0) {
        const canvas = document.createElement("canvas");
        canvas.width = faceVideoRef.current.videoWidth;
        canvas.height = faceVideoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(faceVideoRef.current, 0, 0);
        const photo = compressCanvas(canvas, "face");

        // Parar captura enquanto aguarda o servidor
        if (faceDetectInterval.current) {
          clearInterval(faceDetectInterval.current);
          faceDetectInterval.current = null;
        }

        setFaceStatus("comparing");
        setCapturedFacePhoto(photo);

        try {
          const res = await apiFetch(`${API}/face/compare-visitors`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photo }),
          });

          if (!res.ok) {
            // Servidor ainda carregando modelos ou erro
            setFaceStatus("scanning");
            startFaceCapture();
            return;
          }

          const data = await res.json();

          if (data.matched && data.visitor) {
            setFaceStatus("found");
            setFaceMatch({
              visitor: data.visitor,
              distance: data.distance,
            });
          } else if (data.error && data.error.includes("rosto")) {
            // Nenhum rosto detectado — continuar scanning
            setFaceStatus("scanning");
            startFaceCapture();
          } else {
            setFaceStatus("not_found");
          }
        } catch (err) {
          console.error("Erro ao comparar rosto:", err);
          // Tentar novamente
          setFaceStatus("scanning");
          startFaceCapture();
        }
      }
    }, 500);
  };

  const stopFaceRecognition = () => {
    if (faceDetectInterval.current) {
      clearInterval(faceDetectInterval.current);
      faceDetectInterval.current = null;
    }
    if (faceVideoRef.current?.srcObject) {
      const stream = faceVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      faceVideoRef.current.srcObject = null;
    }
    setShowFaceRecog(false);
    setFaceStatus("idle");
  };

  const handleFaceMatchNewVisit = () => {
    if (!faceMatch) return;
    const v = faceMatch.visitor;
    setForm({
      nome: v.nome || "",
      documento: v.documento || "",
      telefone: "",
      foto: capturedFacePhoto || v.foto || "",
      documento_foto: "",
      bloco: v.bloco || "",
      apartamento: v.apartamento || "",
      autorizado_interfone: "nao",
      quem_autorizou: "",
      morador_whatsapp: "",
    });
    stopFaceRecognition();
    setShowForm(true);
    // Fetch moradores for the block if available
    if (v.bloco) fetchMoradoresBloco(v.bloco);
  };

  const handleFaceNewVisitor = () => {
    setForm({
      nome: "", documento: "", telefone: "",
      foto: capturedFacePhoto || "",
      documento_foto: "",
      bloco: "", apartamento: "",
      autorizado_interfone: "nao",
      quem_autorizou: "",
      morador_whatsapp: "",
    });
    stopFaceRecognition();
    setShowForm(true);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (faceDetectInterval.current) clearInterval(faceDetectInterval.current);
    };
  }, []);

  // Submit form
  const handleSubmit = async () => {
    if (!form.nome.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    setError("");
    setSaving(true);

    try {
      const res = await apiFetch(`${API}/visitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          face_descriptor: null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao cadastrar.");
        setSaving(false);
        return;
      }

      const visitor: Visitor = await res.json();

      // Gerar link do WhatsApp
      const authLink = `${APP_ORIGIN}/visitante/autorizar/${visitor.token}`;
      const msgLines = [
        `*Portaria - Cadastro de Visitante*`,
        ``,
        `Um visitante deseja entrar no condominio:`,
        ``,
        `*Nome:* ${visitor.nome}`,
        `*Documento:* ${visitor.documento || "Nao informado"}`,
        `*Destino:* ${visitor.bloco || ""} - Apt ${visitor.apartamento || ""}`,
        ``,
        `Clique no link abaixo para autorizar ou recusar a entrada:`,
        `${authLink}`,
      ];
      const message = encodeURIComponent(msgLines.join("\n"));

      const whatsappNumber = form.morador_whatsapp.replace(/\D/g, "");
      const whatsappUrl = `https://wa.me/55${whatsappNumber}?text=${message}`;

      // Reset form
      setForm({
        nome: "", documento: "", telefone: "", foto: "", documento_foto: "",
        bloco: "", apartamento: "", autorizado_interfone: "nao",
        quem_autorizou: "", morador_whatsapp: "",
      });
      setShowForm(false);
      fetchVisitors();

      // Abrir WhatsApp
      if (whatsappNumber) {
        window.open(whatsappUrl, "_blank");
      }
    } catch (err) {
      setError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  };

  // Generate self-register WhatsApp link
  const handleSelfRegisterLink = () => {
    const selfRegisterUrl = `${APP_ORIGIN}/visitante/auto-cadastro`;
    const msgLines = [
      `*Portaria - Auto Cadastro de Visitante*`,
      ``,
      `Faca seu cadastro clicando no link abaixo:`,
      `${selfRegisterUrl}`,
    ];
    const message = encodeURIComponent(msgLines.join("\n"));
    // Prompt for WhatsApp number
    const phone = prompt("Digite o WhatsApp do visitante (com DDD):");
    if (phone) {
      const num = phone.replace(/\D/g, "");
      window.open(`https://wa.me/55${num}?text=${message}`, "_blank");
    }
  };

  // Status helpers
  const statusBg = (status: string) => {
    if (status === "liberado") return "#dcfce7";
    if (status === "recusado") return "#fef2f2";
    return "#ffffff";
  };

  const statusIcon = (status: string) => {
    if (status === "liberado") return <CheckCircle2 className="w-5 h-5" style={{ color: "#16a34a" }} />;
    if (status === "recusado") return <XCircle className="w-5 h-5" style={{ color: "#dc2626" }} />;
    return <Clock className="w-5 h-5" style={{ color: "#9ca3af" }} />;
  };

  const statusLabel = (status: string) => {
    if (status === "liberado") return "Liberado";
    if (status === "recusado") return "Recusado";
    return "Aguardando";
  };

  // ═══════════════════════════════════════════════════════
  // LISTA UNIFICADA — combina visitantes, pré-autorizações, entregas e veículos
  // ═══════════════════════════════════════════════════════

  const unifiedEntries = useMemo(() => {
    const s = search.toLowerCase().trim();
    const entries: UnifiedEntry[] = [];

    // Visitantes (já filtrados pelo server via search)
    if (activeFilter === "todos" || activeFilter === "visitantes") {
      entries.push(...visitors.map((v) => ({
        id: `v-${v.id}`,
        tipo: "visitante" as UnifiedEntryType,
        nome: v.nome,
        documento: v.documento,
        bloco: v.bloco,
        apartamento: v.apartamento,
        status: v.status,
        created_at: v.created_at,
        morador_name: v.quem_autorizou,
        foto: v.foto,
        original: v,
      })));
    }

    // Pré-autorizações (filtro client-side)
    if (activeFilter === "todos" || activeFilter === "pre_autorizacoes") {
      const filtered = s
        ? preAuths.filter((a) =>
            a.visitante_nome.toLowerCase().includes(s) ||
            (a.visitante_documento && a.visitante_documento.toLowerCase().includes(s)) ||
            (a.bloco && a.bloco.toLowerCase().includes(s)) ||
            (a.apartamento && a.apartamento.toLowerCase().includes(s)) ||
            (a.morador_name && a.morador_name.toLowerCase().includes(s))
          )
        : preAuths;
      entries.push(...filtered.map((a) => ({
        id: `pa-${a.id}`,
        tipo: "pre_autorizacao" as UnifiedEntryType,
        nome: a.visitante_nome,
        documento: a.visitante_documento,
        bloco: a.bloco,
        apartamento: a.apartamento,
        status: a.status,
        created_at: a.created_at,
        morador_name: a.morador_name,
        foto: a.visitante_foto,
        original: a,
      })));
    }

    // Ordenar por data mais recente
    entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return entries;
  }, [visitors, preAuths, activeFilter, search]);

  const filterTabs = [
    { key: "todos" as const, label: "Todos", count: visitors.length + preAuths.length },
    { key: "visitantes" as const, label: "Visitantes", icon: <UserPlus className="w-3.5 h-3.5" />, count: visitors.length },
    { key: "pre_autorizacoes" as const, label: "Pré-Autorizações", icon: <ShieldCheck className="w-3.5 h-3.5" />, count: preAuths.length },
  ];

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, color: p.text }}>
        <div style={{ padding: "0 24px", height: "4.5rem", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/dashboard")} style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <UserPlus className="w-5 h-5" />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Controle de Pedestres</span>
          <div className="flex-1" />
          <TutorialButton title="Controle de Pedestres">
            <TSection icon={<span>📋</span>} title="O QUE E ESTA FUNCAO?">
              <p>Registra a <strong>entrada de visitantes</strong> no condominio. O porteiro cadastra o visitante com nome, foto, documento e morador visitado. O sistema registra data, hora e porteiro responsável. Tudo fica no histórico para consulta futura.</p>
            </TSection>
            <FlowPortaria>
              <TStep n={1}>Porteiro toca em <strong>+</strong> para abrir o formulario de novo visitante</TStep>
              <TStep n={2}>Preenche o <strong>nome completo</strong> do visitante</TStep>
              <TStep n={3}>Seleciona o <strong>morador que esta recebendo</strong> a visita (bloco + unidade)</TStep>
              <TStep n={4}>Informa o <strong>documento</strong> (RG ou CPF) — opcional</TStep>
              <TStep n={5}>Tira uma <strong>foto do visitante</strong> com a camera do celular (opcional mas recomendado)</TStep>
              <TStep n={6}>Clica em <strong>"Registrar Entrada"</strong> — sistema salva com data, hora e porteiro</TStep>
              <p style={{ marginTop: "8px", fontSize: "13px", color: "#2d3354" }}>👉 <strong>O morador ve:</strong> No app dele, aparece a notificacao de visitante e o registro na lista de visitas recebidas.</p>
            </FlowPortaria>
            <FlowMorador>
              <TStep n={1}>Morador cria uma <strong>autorizacao previa</strong> no app (nome, data, horario)</TStep>
              <TStep n={2}>Visitante chega na portaria e porteiro <strong>busca a autorizacao</strong></TStep>
              <TStep n={3}>Porteiro confirma a identidade e <strong>libera a entrada</strong> com um toque</TStep>
              <p style={{ marginTop: "8px", fontSize: "13px", color: "#166534" }}>👉 <strong>Portaria ve:</strong> O visitante ja aparece pre-autorizado na lista — so precisa confirmar e registrar a entrada.</p>
            </FlowMorador>
            <TSection icon={<span>🔧</span>} title="FUNCOES DISPONIVEIS">
              <TBullet><strong>Foto do visitante</strong> — Tire foto com a camera do celular para registro de seguranca</TBullet>
              <TBullet><strong>Reconhecimento Facial</strong> — O sistema identifica visitantes recorrentes pela foto</TBullet>
              <TBullet><strong>QR Code</strong> — Visitante apresenta QR Code (gerado pelo morador) na portaria para entrada rapida</TBullet>
              <TBullet><strong>Busca rapida</strong> — Pesquise visitantes ja cadastrados anteriormente para reentrada rapida</TBullet>
              <TBullet><strong>Registro de saida</strong> — Marque quando o visitante sair do condominio</TBullet>
              <TBullet><strong>Relatorio PDF</strong> — Gere relatorios de visitantes por periodo com dados completos</TBullet>
            </TSection>
            <TSection icon={<span>⭐</span>} title="DICAS IMPORTANTES">
              <TBullet>Tire <strong>foto de todos os visitantes</strong> — e a melhor forma de garantir seguranca</TBullet>
              <TBullet>Visitantes que ja vieram antes aparecem na <strong>busca rapida</strong> — nao precisa re-digitar os dados</TBullet>
              <TBullet>Autorizacoes previas dos moradores aparecem com <strong>destaque verde</strong> para liberar rapido</TBullet>
              <TBullet>Sempre <strong>registre a saida</strong> do visitante para manter o controle de quem esta no condominio</TBullet>
            </TSection>
          </TutorialButton>
          <button
            onClick={() => setShowConfig(true)}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
            title="Configuração"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setShowForm(true); setError(""); setSelectedMoradorId(""); setMoradores([]); setManualAutorizou(false); }}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div style={{ padding: "12px 24px 0" }}>
        <ComoFunciona steps={[
          "📋 Portaria cadastra visitante com nome, documento e foto",
          "📱 Morador recebe notificação e autoriza pelo app",
          "✅ Portaria libera acesso após autorização",
          "🚪 Sistema registra entrada e saída automaticamente",
        ]} />
      </div>

      {/* Action buttons — square grid */}
      <style>{`@media (min-width: 768px) { .action-grid-pedestres { grid-template-columns: repeat(5, 1fr) !important; } }`}</style>
      <div className="action-grid-pedestres" style={{ padding: "12px 24px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
        <button
          onClick={() => { setShowForm(true); setError(""); setSelectedMoradorId(""); setMoradores([]); setManualAutorizou(false); }}
          className="flex flex-col items-center justify-center gap-2 rounded-xl text-white font-semibold transition-colors"
          style={{ aspectRatio: "1", background: "linear-gradient(135deg, #f97316 0%, #ea580c 50%, #9a3412 100%)", padding: "10px" }}
        >
          <UserPlus style={{ width: 28, height: 28 }} />
          <span style={{ fontSize: "10px", fontWeight: 700, textAlign: "center", lineHeight: 1.3 }}>CADASTRAR VISITANTE</span>
        </button>
        <button
          onClick={startFaceRecognition}
          className="flex flex-col items-center justify-center gap-2 rounded-xl text-white font-semibold transition-colors"
          style={{ aspectRatio: "1", background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", padding: "10px" }}
        >
          <ScanFace style={{ width: 28, height: 28 }} />
          <span style={{ fontSize: "10px", fontWeight: 700, textAlign: "center", lineHeight: 1.3 }}>RECONHECIMENTO FACIAL</span>
        </button>
        <button
          onClick={() => { setActiveFilter(activeFilter === "pre_autorizacoes" ? "todos" : "pre_autorizacoes"); }}
          className="flex flex-col items-center justify-center gap-2 rounded-xl text-white font-semibold transition-colors relative"
          style={{
            aspectRatio: "1",
            background: activeFilter === "pre_autorizacoes"
              ? "linear-gradient(135deg, #16a34a 0%, #15803d 50%, #14532d 100%)"
              : "linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)",
            padding: "10px",
          }}
        >
          <ShieldCheck style={{ width: 28, height: 28 }} />
          <span style={{ fontSize: "10px", fontWeight: 700, textAlign: "center", lineHeight: 1.3 }}>PRE-AUTORIZADOS</span>
          {preAuths.length > 0 && (
            <span style={{
              position: "absolute", top: 6, right: 6,
              background: "rgba(255,255,255,0.3)", color: "#fff",
              fontSize: "11px", fontWeight: 800,
              width: 22, height: 22, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {preAuths.length}
            </span>
          )}
        </button>
        <button
          onClick={handleSelfRegisterLink}
          className="flex flex-col items-center justify-center gap-2 rounded-xl text-white font-semibold transition-colors"
          style={{ aspectRatio: "1", backgroundColor: "#25d366", padding: "10px" }}
        >
          <Link2 style={{ width: 28, height: 28 }} />
          <span style={{ fontSize: "10px", fontWeight: 700, textAlign: "center", lineHeight: 1.3 }}>AUTO CADASTRO WHATSAPP</span>
        </button>
        <button
          onClick={() => navigate("/portaria/visitante-qrcode")}
          className="flex flex-col items-center justify-center gap-2 rounded-xl text-white font-semibold transition-colors"
          style={{ aspectRatio: "1", background: "linear-gradient(135deg, #1e3a5f 0%, #0a1628 100%)", padding: "10px" }}
        >
          <QrCode style={{ width: 28, height: 28 }} />
          <span style={{ fontSize: "10px", fontWeight: 700, textAlign: "center", lineHeight: 1.3 }}>QR CODE AUTO CADASTRO</span>
        </button>
      </div>

      {/* Camera Embed — toggle + live feed */}
      <div style={{ padding: "0 24px 8px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 500, color: "#64748b" }}>
          <input
            type="checkbox"
            checked={showCameraEmbed}
            onChange={() => setShowCameraEmbed(!showCameraEmbed)}
            style={{ width: "16px", height: "16px", accentColor: "#3b82f6", cursor: "pointer" }}
          />
          Exibir cameras ao vivo
        </label>
      </div>
      {showCameraEmbed && (
        <div style={{ padding: "0 24px 12px" }}>
          <CameraEmbed
            ref={cameraEmbedRef}
            sectors={["entrada_principal", "portaria", "entrada_servico"]}
            height={200}
            onSnapshotCaptured={(dataUrl, cameraName) => {
              setLastCameraSnapshot(dataUrl);
            }}
          />
          {lastCameraSnapshot && (
            <div
              style={{
                marginTop: "6px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                borderRadius: "10px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
              }}
            >
              <CheckCircle2 style={{ width: 14, height: 14, color: "#16a34a", flexShrink: 0 }} />
              <span style={{ fontSize: "11px", color: "#15803d", fontWeight: 500 }}>
                Snapshot capturado da câmera
              </span>
              <button
                onClick={() => setLastCameraSnapshot("")}
                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: "2px" }}
              >
                <X style={{ width: 12, height: 12, color: "#6b7280" }} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div style={{ padding: "0 24px 8px", display: "flex", gap: "8px", alignItems: "center" }}>
        <div className="flex items-center gap-2 h-10 rounded-lg border border-border bg-card" style={{ paddingLeft: "24px", paddingRight: "12px", flex: 1 }}>
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Buscar nome, documento, bloco..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <button
          onClick={() => setShowReport(true)}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "10px 20px", borderRadius: "8px", border: "2px solid #d97706",
            background: "#fff",
            color: "#d97706", fontSize: "14px", fontWeight: 700, cursor: "pointer",
            height: "42px", flexShrink: 0,
          }}
        >
          <FileText className="w-4 h-4" /> Relatório
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ padding: "0 24px 12px", display: "flex", gap: "8px", overflowX: "auto" }}>
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
              whiteSpace: "nowrap", border: "none", cursor: "pointer",
              backgroundColor: activeFilter === tab.key ? "#0062d1" : "#f1f5f9",
              color: activeFilter === tab.key ? "#fff" : "#64748b",
              transition: "all 0.2s",
            }}
          >
            {"icon" in tab && tab.icon}
            {tab.label}
            <span style={{
              fontSize: "10px", fontWeight: 800,
              backgroundColor: activeFilter === tab.key ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.08)",
              padding: "1px 7px", borderRadius: "10px",
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <ReportModal
        show={showReport}
        onClose={() => setShowReport(false)}
        onGenerate={(dateFrom, dateTo, withCharts) => {
          const from = new Date(dateFrom + "T00:00:00");
          const to = new Date(dateTo + "T23:59:59");
          const filteredByDate = visitors.filter((v) => {
            const d = new Date(v.created_at);
            return d >= from && d <= to;
          });
          if (withCharts) {
            gerarRelatorioVisitantesComGraficos(filteredByDate, dateFrom, dateTo, user?.condominio_nome);
          } else {
            gerarRelatorioVisitantes(filteredByDate, dateFrom, dateTo, user?.condominio_nome);
          }
        }}
        title="Gerar relatorio de Visitantes por periodo"
      />

      {/* Configuration modal */}
      {showConfig && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center">
          <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto" style={{ padding: "24px" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5" style={{ color: "#0ea5e9" }} />
                <h2 className="font-bold text-lg text-foreground">Configuração</h2>
              </div>
              <button onClick={() => setShowConfig(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Campos obrigatórios ficam visíveis no formulário. Campos desativados não aparecem para preenchimento.
            </p>

            <div className="space-y-1">
              {ALL_FIELDS.map((field) => {
                const on = isFieldVisible(field.key);
                const locked = "locked" in field && field.locked;
                return (
                  <button
                    key={field.key}
                    onClick={() => !locked && toggleField(field.key)}
                    disabled={locked}
                    className="w-full flex items-center justify-between rounded-xl transition-colors"
                    style={{
                      padding: "12px 16px",
                      backgroundColor: on ? "#f0f9ff" : "#f9fafb",
                      border: on ? "1px solid rgba(14,165,233,0.3)" : "1px solid #e5e7eb",
                      opacity: locked ? 0.7 : 1,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: on ? "#0ea5e9" : "#d1d5db" }}
                      />
                      <span className="text-sm font-medium" style={{ color: on ? "#0c4a6e" : "#9ca3af" }}>
                        {field.label}
                      </span>
                      {locked && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>
                          OBRIGATÓRIO
                        </span>
                      )}
                    </div>
                    {on ? (
                      <ToggleRight className="w-6 h-6" style={{ color: "#0ea5e9" }} />
                    ) : (
                      <ToggleLeft className="w-6 h-6" style={{ color: "#d1d5db" }} />
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowConfig(false)}
              className="w-full h-11 rounded-xl text-white font-bold text-sm mt-5"
              style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" }}
            >
              Salvar Configuração
            </button>
          </div>
        </div>
      )}

      {/* Camera modal */}
      {cameraActive && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between p-4">
            <span className="text-white font-medium">
              {cameraMode === "foto" ? "Foto do Visitante" : "Foto do Documento"}
            </span>
            <button onClick={stopCamera} style={{ color: p.text }}>
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <video ref={videoRef} className="max-w-full max-h-full" autoPlay playsInline muted />
          </div>
          <div className="p-6 flex justify-center">
            <button
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center"
              style={{ border: isDark ? "4px solid rgba(255,255,255,0.5)" : "4px solid #cbd5e1" }}
            >
              <div className="w-16 h-16 rounded-full bg-white" />
            </button>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center">
          <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto" style={{ padding: "24px" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg text-foreground">Novo Visitante</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowForm(false); setShowConfig(true); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ border: "2px solid rgba(14,165,233,0.5)" }}
                  title="Configuração"
                >
                  <Settings className="w-4 h-4" style={{ color: "#0ea5e9" }} />
                </button>
                <button onClick={() => { setShowForm(false); stopCamera(); }}>
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
            )}

            <div className="space-y-4">
              {/* Foto */}
              {isFieldVisible("foto") && (
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Foto do Visitante</label>
                {form.foto ? (
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden">
                    <img src={form.foto} alt="Foto" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setForm({ ...form, foto: "" })}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startCamera("foto")}
                    className="w-24 h-24 rounded-xl flex flex-col items-center justify-center gap-1"
                    style={{ border: "2px dashed #d1d5db" }}
                  >
                    <Camera className="w-6 h-6 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Tirar foto</span>
                  </button>
                )}
              </div>
              )}

              {/* Nome - sempre visível (obrigatório) */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Nome *</label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Nome completo do visitante"
                  className="w-full h-10 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  style={{ paddingLeft: "0.5cm", paddingRight: 12 }}
                />
              </div>

              {/* Documento */}
              {isFieldVisible("documento") && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Documento</label>
                <input
                  value={form.documento}
                  onChange={(e) => setForm({ ...form, documento: e.target.value })}
                  placeholder="RG ou CPF"
                  className="w-full h-10 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  style={{ paddingLeft: "0.5cm", paddingRight: 12 }}
                />
              </div>
              )}

              {/* Telefone */}
              {isFieldVisible("telefone") && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Telefone do Visitante</label>
                <input
                  type="tel"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: formatPhone(e.target.value) })}
                  placeholder="(11) 99999-9999"
                  className="w-full h-10 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  style={{ paddingLeft: "0.5cm", paddingRight: 12 }}
                />
              </div>
              )}

              {/* Bloco */}
              {isFieldVisible("bloco") && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Bloco</label>
                <div className="relative">
                  <select
                    value={form.bloco}
                    onChange={(e) => {
                      const bloco = e.target.value;
                      setForm({ ...form, bloco, apartamento: "", morador_whatsapp: "", quem_autorizou: "" });
                      setMoradores([]);
                      setSelectedMoradorId("");
                      fetchMoradoresBloco(bloco);
                    }}
                    className="w-full h-10 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40 appearance-none"
                    style={{ paddingLeft: "0.5cm", paddingRight: 12 }}
                  >
                    <option value="">Selecione o bloco</option>
                    {blocks.map((b) => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>
              )}

              {/* Apartamento / Morador (com busca) */}
              {isFieldVisible("apartamento") && form.bloco && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Apartamento / Morador</label>
                  <SearchableSelect
                    value={selectedMoradorId}
                    onChange={(val) => handleSelectMorador(val)}
                    placeholder="Selecione o morador"
                    searchPlaceholder="Buscar por nome ou apartamento..."
                    options={moradores.map((m) => ({
                      value: String(m.id),
                      label: `Apt ${m.unit} — ${m.name}`,
                      searchText: `${m.name} ${m.unit}`.toLowerCase(),
                    }))}
                  />
                </div>
              )}

              {/* WhatsApp do morador (preenchido automaticamente) */}
              {isFieldVisible("morador_whatsapp") && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">WhatsApp do Morador</label>
                <input
                  type="tel"
                  value={form.morador_whatsapp}
                  readOnly
                  placeholder={form.bloco && form.apartamento ? "Nenhum morador cadastrado" : "Selecione bloco e apartamento"}
                  className="w-full h-10 rounded-lg border border-border text-sm text-foreground focus:outline-none"
                  style={{ paddingLeft: "0.5cm", paddingRight: 12, backgroundColor: "#f3f4f6", cursor: "default" }}
                />
              </div>
              )}

              {/* Autorizado por interfone */}
              {isFieldVisible("autorizado_interfone") && (
              <div style={{ marginTop: 20 }}>
                <label className="text-sm font-medium text-foreground mb-2 block">Autorizado por interfone?</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setForm({ ...form, autorizado_interfone: "sim" })}
                    className="flex-1 h-10 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: form.autorizado_interfone === "sim" ? "#16a34a" : "transparent",
                      color: form.autorizado_interfone === "sim" ? "#fff" : "#6b7280",
                      border: form.autorizado_interfone === "sim" ? "2px solid #16a34a" : "2px solid #d1d5db",
                    }}
                  >
                    Sim
                  </button>
                  <button
                    onClick={() => setForm({ ...form, autorizado_interfone: "nao" })}
                    className="flex-1 h-10 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: form.autorizado_interfone === "nao" ? "#dc2626" : "transparent",
                      color: form.autorizado_interfone === "nao" ? "#fff" : "#6b7280",
                      border: form.autorizado_interfone === "nao" ? "2px solid #dc2626" : "2px solid #d1d5db",
                    }}
                  >
                    Não
                  </button>
                </div>
              </div>
              )}

              {/* Quem autorizou */}
              {isFieldVisible("quem_autorizou") && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Quem autorizou?</label>
                  <input
                    value={form.quem_autorizou}
                    onChange={(e) => setForm({ ...form, quem_autorizou: e.target.value })}
                    placeholder={form.apartamento ? "Nome de quem autorizou" : "Selecione o morador acima"}
                    className="w-full h-10 rounded-lg border border-border text-sm text-foreground focus:outline-none"
                    style={{
                      paddingLeft: "0.5cm",
                      paddingRight: 12,
                      backgroundColor: "#fff",
                      cursor: "text",
                    }}
                  />
                  <label
                    className="flex items-center gap-2 mt-2 cursor-pointer"
                    onClick={() => {
                      const next = !manualAutorizou;
                      setManualAutorizou(next);
                      if (!next) {
                        // Ao desmarcar, volta o nome do morador selecionado
                        const morador = moradores.find((m) => String(m.id) === selectedMoradorId);
                        setForm((prev) => ({ ...prev, quem_autorizou: morador?.name || "" }));
                      } else {
                        setForm((prev) => ({ ...prev, quem_autorizou: "" }));
                      }
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                      style={{
                        borderColor: manualAutorizou ? "#0ea5e9" : "#d1d5db",
                        backgroundColor: manualAutorizou ? "#0ea5e9" : "transparent",
                      }}
                    >
                      {manualAutorizou && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">Pessoa não cadastrada no sistema</span>
                  </label>
                </div>
              )}

              {/* Anexar documento */}
              {isFieldVisible("documento_foto") && (
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Anexar Documento</label>
                {form.documento_foto ? (
                  <div className="relative w-full h-32 rounded-xl overflow-hidden">
                    <img src={form.documento_foto} alt="Documento" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setForm({ ...form, documento_foto: "" })}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startCamera("documento")}
                    className="w-full h-20 rounded-xl flex items-center justify-center gap-2"
                    style={{ border: "2px dashed #d1d5db" }}
                  >
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Fotografar documento</span>
                  </button>
                )}
              </div>
              )}

              {/* Submit */}
              <div style={{ marginTop: "32px" }}>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="w-full h-14 rounded-xl text-white font-bold text-base transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
                  style={{ backgroundColor: "#25d366" }}
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Enviar via WhatsApp
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified List */}
      <main className="flex-1 pb-6 flex flex-col" style={{ paddingLeft: "24px", paddingRight: "24px", gap: "14px" }}>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : unifiedEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Search className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Tente alterar o filtro ou a busca</p>
          </div>
        ) : (
          unifiedEntries.map((entry) => {

            {/* ── PRÉ-AUTORIZAÇÃO ── */}
            if (entry.tipo === "pre_autorizacao") {
              const auth = entry.original as PreAuth;
              const inSchedule = isPreAuthWithinSchedule(auth);
              return (
                <div
                  key={entry.id}
                  className="rounded-xl overflow-hidden"
                  style={{
                    border: inSchedule ? "2px solid #16a34a" : "1px solid #e2e8f0",
                    backgroundColor: inSchedule ? "#f0fdf4" : "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    className="flex items-center justify-between"
                    style={{ backgroundColor: inSchedule ? "#16a34a" : "#6b7280", height: "36px", paddingLeft: "20px", paddingRight: "20px" }}
                  >
                    <span className="text-xs text-white font-bold flex items-center gap-1.5 tracking-wide">
                      {auth.tipo === "auto_cadastro" ? (
                        <><Link2 className="w-4 h-4" /> AUTO CADASTRO</>
                      ) : (
                        <><ShieldCheck className="w-4 h-4" /> AUTORIZAÇÃO PRÉVIA</>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {inSchedule && (
                        <span className="text-[11px] text-white bg-white/20 px-2 py-0.5 rounded-full font-bold">
                          NO HORÁRIO
                        </span>
                      )}
                      <span className="text-[11px] text-white/80 font-medium">
                        {new Date(auth.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px" }}>
                    <div className="flex items-start gap-3 mb-3">
                      {auth.visitante_foto ? (
                        <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0" style={{ border: "2px solid #e2e8f0" }}>
                          <img src={auth.visitante_foto} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: "#f3f4f6", border: "2px solid #e2e8f0" }}>
                          <User className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-bold text-foreground" style={{ fontSize: "15px", lineHeight: 1.3 }}>{auth.visitante_nome}</h3>
                        {auth.visitante_documento && (
                          <p className="text-xs text-muted-foreground mt-0.5">Doc: {auth.visitante_documento}</p>
                        )}
                        {auth.visitante_telefone && (
                          <p className="text-xs text-muted-foreground">Tel: {auth.visitante_telefone}</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg flex items-center gap-2.5 mb-3" style={{ padding: "8px 12px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <Building className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-foreground">{auth.bloco} — Apt {auth.apartamento}</p>
                        <p className="text-[11px] text-muted-foreground">Autorizado por: <strong>{auth.morador_name}</strong></p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatPreAuthDate(auth.data_inicio)} a {formatPreAuthDate(auth.data_fim)}
                      </span>
                      {auth.hora_inicio && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {auth.hora_inicio} às {auth.hora_fim || "--"}
                        </span>
                      )}
                    </div>
                    {auth.observacao && (
                      <div className="rounded-lg mb-3" style={{ padding: "8px 12px", backgroundColor: "#fefce8", border: "1px solid #fde68a" }}>
                        <p className="text-[11px] text-amber-700 flex items-start gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{auth.observacao}</span>
                        </p>
                      </div>
                    )}
                    <button
                      onClick={() => handlePreAuthConfirmEntry(auth)}
                      disabled={preAuthConfirming === auth.id}
                      className="w-full flex items-center justify-center gap-2 rounded-xl text-white font-bold text-sm transition-all"
                      style={{ height: "42px", backgroundColor: "#25d366", opacity: preAuthConfirming === auth.id ? 0.6 : 1 }}
                    >
                      {preAuthConfirming === auth.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Confirmar Entrada e Avisar Morador
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            }

            {/* ── VISITANTE ── */}
            if (entry.tipo === "visitante") {
              const v = entry.original as Visitor;
              return (
                <div
                  key={entry.id}
                  className="rounded-xl overflow-hidden"
                  style={{ backgroundColor: statusBg(v.status), border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" }}
                >
                  <div
                    className="flex items-center justify-between"
                    style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)", height: "36px", paddingLeft: "20px", paddingRight: "20px" }}
                  >
                    <span className="text-xs text-white font-bold flex items-center gap-1.5 tracking-wide">
                      <UserPlus className="w-4 h-4" /> VISITANTE
                    </span>
                    <span className="text-[11px] text-white/80 font-medium">
                      {new Date(v.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div style={{ padding: "14px 16px" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0" style={{ border: "2px solid #e2e8f0", backgroundColor: "#f3f4f6" }}>
                        {v.foto ? (
                          <img src={v.foto} alt={v.nome} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <UserPlus className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground truncate" style={{ fontSize: "15px" }}>{v.nome}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {v.documento || "Sem documento"} {v.telefone ? `· ${v.telefone}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {v.bloco || ""} {v.apartamento ? `- Apt ${v.apartamento}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        {statusIcon(v.status)}
                        <span className="text-[11px] font-bold" style={{
                          color: v.status === "liberado" ? "#16a34a" : v.status === "recusado" ? "#dc2626" : "#9ca3af"
                        }}>
                          {statusLabel(v.status)}
                        </span>
                      </div>
                    </div>
                    {v.autorizado_interfone === "sim" && (
                      <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                        <p className="text-xs text-muted-foreground">
                          ✅ Autorizado por interfone — {v.quem_autorizou || "Nome não informado"}
                        </p>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                      {gateEnabled && v.status === "liberado" && (
                        <button
                          onClick={() => handleOpenGate(v.nome)}
                          disabled={gateOpening}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                            flex: 1, height: "38px", borderRadius: "10px", border: "none",
                            background: gateSuccess ? "linear-gradient(135deg, #22c55e, #16a34a)" : "linear-gradient(135deg, #f59e0b, #d97706)",
                            color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                            opacity: gateOpening ? 0.5 : 1,
                          }}
                        >
                          {gateOpening ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : gateSuccess ? (
                            <><CheckCircle2 className="w-4 h-4" /> Portão Aberto!</>
                          ) : (
                            <><DoorOpen className="w-4 h-4" /> Abrir Portão</>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => gerarPdfVisitante(v, user?.condominio_nome)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                          flex: 1, height: "38px", borderRadius: "10px", border: "none",
                          background: "linear-gradient(135deg, #0062d1 0%, #003d99 100%)",
                          color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        <Download className="w-4 h-4" /> Baixar PDF
                      </button>
                      {v.foto && (
                        <button
                          onClick={() => setVerifyingVisitor(v)}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                            height: "38px", padding: "0 16px", borderRadius: "10px", border: "none",
                            background: "linear-gradient(135deg, #334155, #1e293b)",
                            color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          <ShieldCheck className="w-4 h-4" /> Verificar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            return null;
          })
        )}
      </main>

      {/* ═══════════════════════════════════════════════════ */}
      {/* MODAL RECONHECIMENTO FACIAL */}
      {/* ═══════════════════════════════════════════════════ */}
      {showFaceRecog && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: "rgba(99,102,241,0.95)" }}>
            <div className="flex items-center gap-2 text-white">
              <ScanFace className="w-5 h-5" />
              <span className="font-bold text-sm">RECONHECIMENTO FACIAL</span>
            </div>
            <button onClick={stopFaceRecognition} className="text-white/80 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col items-center justify-center px-4">

            {/* Camera view */}
            {(faceStatus === "idle" || faceStatus === "scanning" || faceStatus === "comparing") && (
              <div className="w-full max-w-sm">
                <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "4/3" }}>
                  <video
                    ref={faceVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  <canvas
                    ref={faceCanvasRef}
                    className="absolute inset-0 w-full h-full"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  {/* Scanning overlay */}
                  {faceStatus === "scanning" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="w-48 h-48 rounded-full"
                        style={{
                          border: "3px solid rgba(99,102,241,0.6)",
                          boxShadow: "0 0 40px rgba(99,102,241,0.3), inset 0 0 40px rgba(99,102,241,0.1)",
                          animation: "pulse 2s ease-in-out infinite",
                        }}
                      />
                    </div>
                  )}
                  {faceStatus === "comparing" && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-10 h-10 text-green-400 animate-spin" />
                        <span className="text-white font-medium text-sm">Rosto capturado!</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 text-center">
                  {faceStatus === "scanning" && (
                    <>
                      <div className="flex items-center justify-center gap-2 text-indigo-400 mb-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="font-medium text-sm">Procurando rosto...</span>
                      </div>
                      <p className="text-white/50 text-xs">
                        Posicione o rosto do visitante no centro da câmera
                      </p>
                    </>
                  )}
                  {faceStatus === "comparing" && (
                    <>
                      <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="font-medium text-sm">Comparando no servidor...</span>
                      </div>
                      <p className="text-white/50 text-xs">
                        Aguarde, o servidor está processando
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Result: FOUND */}
            {faceStatus === "found" && faceMatch && (
              <div className="w-full max-w-sm">
                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)", padding: "1cm" }}>
                  {/* Match header */}
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ backgroundColor: "rgba(34,197,94,0.15)" }}>
                    <CheckCircle2 className="w-5 h-5" style={{ color: "#22c55e" }} />
                    <span className="text-green-400 font-bold text-sm">VISITANTE IDENTIFICADO</span>
                  </div>

                  {/* Match info */}
                  <div className="flex gap-4" style={{ marginTop: "0.5cm", marginBottom: "0.5cm" }}>
                    {capturedFacePhoto && (
                      <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
                        <img src={capturedFacePhoto} alt="Rosto capturado" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-white font-bold text-lg">{faceMatch.visitor.nome}</h3>
                      {faceMatch.visitor.documento && (
                        <p className="text-white/60 text-sm">Doc: {faceMatch.visitor.documento}</p>
                      )}
                      {faceMatch.visitor.bloco && (
                        <p className="text-white/60 text-sm">
                          {faceMatch.visitor.bloco} — Apt {faceMatch.visitor.apartamento}
                        </p>
                      )}
                      <p className="text-white/40 text-xs mt-1">
                        Última visita: {new Date(faceMatch.visitor.created_at).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="text-xs mt-1" style={{ color: (1 - faceMatch.distance) >= 0.55 ? "#22c55e" : "#facc15" }}>
                        Reconhecimento: {(1 - faceMatch.distance) >= 0.55 ? "✅ Excelente" : "✔ Suficiente"}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5cm" }}>
                    {gateEnabled && (
                      <button
                        onClick={() => handleOpenGate(faceMatch.visitor.nome)}
                        disabled={gateOpening}
                        className="w-full h-12 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        style={{ background: gateSuccess ? "linear-gradient(135deg, #22c55e, #16a34a)" : "linear-gradient(135deg, #f59e0b, #d97706)" }}
                      >
                        {gateOpening ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : gateSuccess ? (
                          <>
                            <CheckCircle2 className="w-5 h-5" /> Portão Aberto!
                          </>
                        ) : (
                          <>
                            <DoorOpen className="w-5 h-5" /> Abrir Portão
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={handleFaceMatchNewVisit}
                      className="w-full h-12 rounded-xl text-white font-semibold text-sm"
                      style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" }}
                    >
                      Registrar Nova Visita
                    </button>
                    <button
                      onClick={handleFaceNewVisitor}
                      className="w-full h-10 rounded-xl text-white/60 font-medium text-xs"
                      style={{ border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid #cbd5e1" }}
                    >
                      EFETUAR UM NOVO CADASTRO
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Result: NOT FOUND */}
            {faceStatus === "not_found" && (
              <div className="w-full max-w-sm">
                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  {/* Not found header */}
                  <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: "rgba(234,179,8,0.15)" }}>
                    <ScanFace className="w-5 h-5" style={{ color: "#eab308" }} />
                    <span className="text-yellow-400 font-bold text-sm">VISITANTE NÃO IDENTIFICADO</span>
                  </div>

                  {/* Captured photo */}
                  {capturedFacePhoto && (
                    <div className="p-4 flex justify-center">
                      <div className="w-32 h-32 rounded-2xl overflow-hidden">
                        <img src={capturedFacePhoto} alt="Rosto capturado" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )}

                  <p className="text-white/60 text-sm text-center px-4 pb-2">
                    Este rosto não corresponde a nenhum visitante anterior.
                  </p>

                  {/* Actions */}
                  <div className="p-4 space-y-2">
                    <button
                      onClick={handleFaceNewVisitor}
                      className="w-full h-12 rounded-xl text-white font-semibold text-sm"
                      style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" }}
                    >
                      Cadastrar Novo Visitante
                    </button>
                    <button
                      onClick={() => {
                        setFaceStatus("idle");
                        setFaceMatch(null);
                        setCapturedFacePhoto("");
                        setTimeout(() => startFaceCapture(), 500);
                      }}
                      className="w-full h-10 rounded-xl text-white/60 font-medium text-xs"
                      style={{ border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid #cbd5e1" }}
                    >
                      Tentar Novamente
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer explanation */}
          <div className="px-6 py-4" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
            <div className="flex items-start gap-3">
              <ScanFace className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-white/80 text-xs font-medium mb-1">Como funciona?</p>
                <p className="text-white/40 text-[10px] leading-relaxed">
                  A câmera captura o rosto do visitante e envia ao servidor para comparação.
                  Se houver correspondência, os dados são preenchidos automaticamente.
                  O processamento é feito no servidor — seu dispositivo fica leve e rápido.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.05); opacity: 1; }
        }
      `}</style>

      {/* Floating Camera Widget */}
      <CameraWidget />

      {/* Visual Verification modal */}
      {verifyingVisitor && verifyingVisitor.foto && (
        <VisualVerification
          registeredPhoto={verifyingVisitor.foto}
          visitorName={verifyingVisitor.nome}
          cameraStreamUrl={entranceCameraUrl || undefined}
          onResult={(r) => {
            console.log("Verification result:", r);
          }}
          onClose={() => setVerifyingVisitor(null)}
        />
      )}
    </div>
  );
}
