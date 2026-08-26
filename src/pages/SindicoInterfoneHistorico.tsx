import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, History, PhoneIncoming, PhoneMissed, PhoneOff } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Call {
  id: number;
  condominio_id: number;
  bloco: string;
  apartamento: string;
  morador_nome: string | null;
  visitante_nome: string | null;
  visitante_empresa: string | null;
  status: string;
  duracao_segundos: number | null;
  resultado: string | null;
  created_at: string;
  atendido_at: string | null;
  encerrado_at: string | null;
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso.replace(" ", "T") + "Z");
    return d.toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string; label: string; Icon: any }> = {
    atendida: { bg: "#dcfce7", color: "#166534", label: "Atendida", Icon: PhoneIncoming },
    encerrada: { bg: "#e2e8f0", color: "#334155", label: "Encerrada", Icon: PhoneOff },
    recusada: { bg: "#fee2e2", color: "#991b1b", label: "Recusada", Icon: PhoneMissed },
    timeout: { bg: "#fef3c7", color: "#92400e", label: "Sem resposta", Icon: PhoneMissed },
    chamando: { bg: "#dbeafe", color: "#1e40af", label: "Chamando", Icon: PhoneIncoming },
  };
  const c = map[status] || { bg: "#e2e8f0", color: "#334155", label: status, Icon: History };
  const Icon = c.Icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: c.bg, color: c.color, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
      <Icon style={{ width: 12, height: 12 }} /> {c.label}
    </span>
  );
}

export default function SindicoInterfoneHistorico() {
  const navigate = useNavigate();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/interfone/calls")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCalls(data);
        else setError(data?.error || "Erro ao carregar histórico");
      })
      .catch(() => setError("Erro ao conectar com o servidor"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-dvh" style={{ background: "#f8fafc" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg" style={{ background: "#f1f5f9" }}>
          <ArrowLeft style={{ width: 20, height: 20, color: "#003580" }} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#003580", margin: 0 }}>Histórico de Chamadas</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Todas as ligações do interfone</p>
        </div>
      </header>

      <main style={{ padding: "20px 16px 80px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>Carregando...</div>
        )}

        {!loading && error && (
          <div style={{ background: "#fee2e2", color: "#991b1b", padding: 16, borderRadius: 12, textAlign: "center" }}>{error}</div>
        )}

        {!loading && !error && calls.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
            <History style={{ width: 56, height: 56, color: "#cbd5e1", margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#334155", marginBottom: 8 }}>Nenhuma chamada realizada ainda</h2>
            <p style={{ fontSize: 14, color: "#64748b", maxWidth: 320, margin: "0 auto" }}>
              Quando visitantes escanearem o QR Code e chamarem os moradores, o histórico aparecerá aqui.
            </p>
          </div>
        )}

        {!loading && !error && calls.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {calls.map((c) => (
              <div key={c.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: "#003580", fontSize: 15 }}>
                    {c.bloco} • Apto {c.apartamento}
                  </span>
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {statusBadge(c.status)}
                    {c.resultado === "encaminhado_whatsapp" && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#dcfce7", color: "#166534", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                        Seguiu p/ WhatsApp
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "#334155", marginBottom: 4 }}>
                  <strong>Morador:</strong> {c.morador_nome || "—"}
                </div>
                {c.visitante_nome && (
                  <div style={{ fontSize: 13, color: "#334155", marginBottom: 4 }}>
                    <strong>Visitante:</strong> {c.visitante_nome}
                    {c.visitante_empresa ? ` (${c.visitante_empresa})` : ""}
                  </div>
                )}
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>{formatDate(c.created_at)}</span>
                  {c.duracao_segundos != null && c.duracao_segundos > 0 && (
                    <span>{c.duracao_segundos}s</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
