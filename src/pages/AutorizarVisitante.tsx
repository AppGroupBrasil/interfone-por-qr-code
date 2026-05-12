import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  UserPlus,
  Shield,
  Loader2,
  AlertTriangle,
  Camera,
  Video,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Visitor {
  id: number;
  nome: string;
  documento: string | null;
  telefone: string | null;
  foto: string | null;
  bloco: string | null;
  apartamento: string | null;
  status: string;
  created_at: string;
}

interface CameraInfo {
  available: boolean;
  nome?: string;
  url_stream?: string;
  tipo_stream?: string;
  setor?: string;
}

const API = "/api";

export default function AutorizarVisitante() {
  const { token } = useParams<{ token: string }>();
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [responding, setResponding] = useState(false);
  const [done, setDone] = useState(false);
  const [responseStatus, setResponseStatus] = useState("");
  const [cameraInfo, setCameraInfo] = useState<CameraInfo | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    fetchVisitor();
    // Fetch entrance camera for this visitor token
    apiFetch(`${API}/visitors/auth/${token}/camera`)
      .then((r) => r.json())
      .then((data: CameraInfo) => {
        setCameraInfo(data);
        if (data.available) setShowCamera(true);
      })
      .catch(() => {});
  }, [token]);

  const fetchVisitor = async () => {
    try {
      const res = await apiFetch(`${API}/visitors/auth/${token}`);
      if (!res.ok) {
        setError("Visitante não encontrado ou link inválido.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setVisitor(data);

      // If already responded
      if (data.status !== "pendente") {
        setDone(true);
        setResponseStatus(data.status);
      }
    } catch {
      setError("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (action: "liberado" | "recusado") => {
    setResponding(true);
    try {
      const res = await apiFetch(`${API}/visitors/auth/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao responder.");
        setResponding(false);
        return;
      }

      setDone(true);
      setResponseStatus(action);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="min-h-dvh flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 aria-hidden="true" className="w-8 h-8 animate-spin" style={{ color: "#0ea5e9" }} />
          <p className="text-sm text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error && !visitor) {
    return (
      <div role="alert" className="min-h-dvh flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-center" style={{ padding: "24px" }}>
          <AlertTriangle aria-hidden="true" className="w-12 h-12 text-amber-500" />
          <p className="font-semibold text-gray-800">Link Inválido</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4 text-center" style={{ padding: "24px" }}>
          {responseStatus === "liberado" ? (
            <>
              <div role="status" aria-live="polite" className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: "#dcfce7" }}>
                <CheckCircle2 aria-hidden="true" className="w-10 h-10" style={{ color: "#16a34a" }} />
              </div>
              <h2 className="text-xl font-bold" style={{ color: "#16a34a" }}>Entrada Autorizada</h2>
              <p className="text-sm text-gray-500">A portaria foi notificada. O visitante pode entrar.</p>
            </>
          ) : (
            <>
              <div role="status" aria-live="polite" className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: "#fef2f2" }}>
                <XCircle aria-hidden="true" className="w-10 h-10" style={{ color: "#dc2626" }} />
              </div>
              <h2 className="text-xl font-bold" style={{ color: "#dc2626" }}>Entrada Recusada</h2>
              <p className="text-sm text-gray-500">A portaria foi notificada. O visitante não será autorizado.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="text-white" style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", padding: "24px 24px 32px" }}>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-5 h-5" />
          <span className="font-semibold text-sm">Portaria - Autorização de Visitante</span>
        </div>
        <p className="text-sky-100 text-[13px]">
          Um visitante deseja entrar no condomínio. Revise os dados abaixo e autorize ou recuse a entrada.
        </p>
      </div>

      {/* Visitor info card */}
      <div style={{ padding: "0 24px", marginTop: "-16px" }}>
        <div className="bg-white rounded-2xl shadow-sm" style={{ padding: "20px" }}>
          <div className="flex items-center gap-4 mb-4">
            {/* Foto */}
            <div className="w-16 h-16 rounded-full overflow-hidden shrink-0" style={{ border: "3px solid #e5e7eb", backgroundColor: "#f3f4f6" }}>
              {visitor?.foto ? (
                <img src={visitor.foto} alt={visitor.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <UserPlus className="w-7 h-7 text-gray-400" />
                </div>
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{visitor?.nome}</h3>
              <p className="text-sm text-gray-500">Visitante</p>
            </div>
          </div>

          <div className="space-y-3">
            {visitor?.documento && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Documento</span>
                <span className="font-medium text-gray-800">{visitor.documento}</span>
              </div>
            )}
            {visitor?.telefone && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Telefone</span>
                <span className="font-medium text-gray-800">{visitor.telefone}</span>
              </div>
            )}
            {visitor?.bloco && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Bloco</span>
                <span className="font-medium text-gray-800">{visitor.bloco}</span>
              </div>
            )}
            {visitor?.apartamento && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Apartamento</span>
                <span className="font-medium text-gray-800">{visitor.apartamento}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Data</span>
              <span className="font-medium text-gray-800">
                {visitor?.created_at ? new Date(visitor.created_at).toLocaleString("pt-BR") : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Camera Feed from Entrance */}
      {cameraInfo?.available && cameraInfo.url_stream && (
        <div style={{ padding: "12px 24px 0" }}>
          <button
            onClick={() => setShowCamera(!showCamera)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 16px",
              borderRadius: showCamera ? "12px 12px 0 0" : "12px",
              border: "1.5px solid rgba(14,165,233,0.3)",
              background: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)",
              color: "#fff",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            <Video style={{ width: 18, height: 18 }} />
            <div style={{ textAlign: "left", flex: 1 }}>
              <div>Câmera da Portaria</div>
              <div style={{ fontSize: "10px", fontWeight: 400, opacity: 0.8 }}>
                {showCamera ? "Toque para ocultar" : "Toque para ver quem está na portaria"}
              </div>
            </div>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 6px #22c55e",
                animation: "pulse 2s infinite",
              }}
            />
          </button>

          {showCamera && (
            <div
              style={{
                borderRadius: "0 0 12px 12px",
                overflow: "hidden",
                border: "1.5px solid rgba(14,165,233,0.3)",
                borderTop: "none",
                background: "#000",
              }}
            >
              {(cameraInfo.tipo_stream === "mjpeg" || cameraInfo.tipo_stream === "snapshot") ? (
                <img
                  src={cameraInfo.url_stream}
                  alt={cameraInfo.nome || "Câmera da portaria"}
                  crossOrigin="anonymous"
                  style={{ width: "100%", height: "auto", maxHeight: "300px", objectFit: "contain", display: "block" }}
                />
              ) : cameraInfo.tipo_stream === "hls" ? (
                <video
                  src={cameraInfo.url_stream}
                  autoPlay
                  muted
                  playsInline
                  crossOrigin="anonymous"
                  style={{ width: "100%", height: "auto", maxHeight: "300px", objectFit: "contain", display: "block" }}
                />
              ) : (
                <div style={{ height: "160px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Camera style={{ width: 32, height: 32, color: "#334155" }} />
                </div>
              )}
              <div style={{ padding: "6px 12px", background: "rgba(15,23,42,0.9)", display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>
                  {cameraInfo.nome || "Câmera Portaria"} — AO VIVO
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: "12px 24px" }}>
          <div role="alert" aria-live="assertive" className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ padding: "24px", marginTop: "auto" }}>
        <div className="space-y-3">
          <button
            onClick={() => handleRespond("liberado")}
            disabled={responding}
            className="w-full h-14 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 disabled:opacity-50 transition-colors"
            style={{ backgroundColor: "#16a34a" }}
          >
            {responding ? (
              <Loader2 aria-hidden="true" className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle2 aria-hidden="true" className="w-6 h-6" />
                Autorizar Entrada
              </>
            )}
          </button>
          <button
            onClick={() => handleRespond("recusado")}
            disabled={responding}
            className="w-full h-14 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 disabled:opacity-50 transition-colors"
            style={{ backgroundColor: "#dc2626" }}
          >
            {responding ? (
              <Loader2 aria-hidden="true" className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <XCircle aria-hidden="true" className="w-6 h-6" />
                Não Autorizar
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
