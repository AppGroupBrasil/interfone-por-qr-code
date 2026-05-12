import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Car, CheckCircle2, XCircle, Shield, Ban, Hourglass } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";

const API = "/api/vehicle-authorizations";

interface VehicleData {
  id: number;
  placa: string;
  modelo: string | null;
  cor: string | null;
  motorista_nome: string | null;
  bloco: string | null;
  apartamento: string | null;
  observacao: string | null;
  status: string;
  created_at: string;
}

export default function AprovarVeiculo() {
  const { isDark, p } = useTheme();
  const { token } = useParams<{ token: string }>();
  const [vehicle, setVehicle] = useState<VehicleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [morador_observacao, setMoradorObservacao] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"aprovado" | "negado" | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiFetch(`${API}/aprovar/${token}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Solicitação não encontrada.");
          return;
        }
        setVehicle(await res.json());
      } catch {
        setError("Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const handleAction = async (acao: "aprovar" | "negar") => {
    setSubmitting(true);
    try {
      const res = await apiFetch(`${API}/aprovar/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, morador_observacao }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao processar.");
        setSubmitting(false);
        return;
      }
      setResult(acao === "aprovar" ? "aprovado" : "negado");
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div role="status" aria-live="polite" style={{
        minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
      }}>
        <div style={{ width: "32px", height: "32px", border: "3px solid #0ea5e9", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <span className="sr-only">Carregando…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error && !vehicle) {
    return (
      <div role="alert" style={{
        minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)", padding: "24px",
      }}>
        <XCircle aria-hidden="true" style={{ width: "64px", height: "64px", color: "#ef4444", marginBottom: "16px" }} />
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#b91c1c", textAlign: "center" }}>{error}</h1>
      </div>
    );
  }

  // Success screen after approval/denial
  if (result) {
    const isApproved = result === "aprovado";
    return (
      <div style={{
        minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: isApproved
          ? "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"
          : "linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)",
        padding: "24px", textAlign: "center",
      }}>
        {isApproved ? (
          <CheckCircle2 style={{ width: "80px", height: "80px", color: "#22c55e", marginBottom: "20px" }} />
        ) : (
          <Ban style={{ width: "80px", height: "80px", color: "#ef4444", marginBottom: "20px" }} />
        )}
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: isApproved ? "#15803d" : "#b91c1c", marginBottom: "8px" }}>
          {isApproved ? "Acesso Aprovado!" : "Acesso Negado"}
        </h1>
        <p style={{ fontSize: "15px", color: isApproved ? "#166534" : "#991b1b", maxWidth: "400px" }}>
          {isApproved
            ? "O acesso do veículo foi autorizado. A portaria será notificada."
            : "O acesso do veículo foi negado. A portaria será informada."}
        </p>
        {vehicle && (
          <div style={{
            marginTop: "24px", padding: "16px 24px", borderRadius: "14px",
            background: "rgba(255,255,255,0.8)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(0,0,0,0.05)",
          }}>
            <p style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "4px", fontFamily: "monospace", color: "#0c4a6e" }}>
              {vehicle.placa}
            </p>
            {vehicle.modelo && <p style={{ fontSize: "14px", color: "#64748b", marginTop: "4px" }}>{vehicle.modelo} {vehicle.cor ? `· ${vehicle.cor}` : ""}</p>}
          </div>
        )}
        {morador_observacao && (
          <div style={{
            marginTop: "16px", padding: "12px 16px", borderRadius: "10px",
            background: "rgba(255,255,255,0.6)", maxWidth: "400px",
          }}>
            <p style={{ fontSize: "13px", color: "#475569", fontStyle: "italic" }}>💬 Sua observação: {morador_observacao}</p>
          </div>
        )}
      </div>
    );
  }

  // Already responded
  if (vehicle && vehicle.status !== "pendente_aprovacao") {
    const wasApproved = vehicle.status === "ativa";
    return (
      <div style={{
        minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)", padding: "24px", textAlign: "center",
      }}>
        {wasApproved ? (
          <Shield style={{ width: "64px", height: "64px", color: "#0ea5e9", marginBottom: "16px" }} />
        ) : (
          <Ban style={{ width: "64px", height: "64px", color: "#ef4444", marginBottom: "16px" }} />
        )}
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: wasApproved ? "#0369a1" : "#b91c1c" }}>
          Esta solicitação já foi {wasApproved ? "aprovada" : "respondida"}.
        </h1>
        <div style={{
          marginTop: "20px", padding: "16px 24px", borderRadius: "14px",
          background: "rgba(255,255,255,0.8)", border: "1px solid rgba(0,0,0,0.05)",
        }}>
          <p style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "4px", fontFamily: "monospace", color: "#0c4a6e" }}>
            {vehicle.placa}
          </p>
        </div>
      </div>
    );
  }

  // Main approval form
  return (
    <div style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column",
      background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
    }}>
      {/* Header */}
      <header style={{
        background: isDark ? "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" : "#ffffff",
        padding: "24px", textAlign: "center", color: p.text,
      }}>
        <Car style={{ width: "40px", height: "40px", marginBottom: "8px", opacity: 0.9 }} />
        <h1 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "4px" }}>Solicitação de Acesso</h1>
        <p style={{ fontSize: "13px", opacity: 0.8 }}>A portaria solicita autorização para o veículo abaixo</p>
      </header>

      <main style={{
        flex: 1, display: "flex", flexDirection: "column", gap: "16px",
        padding: "20px", maxWidth: "500px", margin: "0 auto", width: "100%",
      }}>
        {error && (
          <div role="alert" aria-live="assertive" style={{
            padding: "10px 14px", borderRadius: "10px", background: "#fef2f2",
            border: "1px solid #fecaca", color: "#b91c1c", fontSize: "13px", fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        {/* Vehicle info card */}
        {vehicle && (
          <div style={{
            background: "#fff", borderRadius: "16px", padding: "20px",
            border: "2px solid #0ea5e920", display: "flex", flexDirection: "column", gap: "16px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
          }}>
            {/* Placa em destaque */}
            <div style={{ textAlign: "center" }}>
              <div style={{
                display: "inline-block", padding: "12px 28px", borderRadius: "14px",
                background: "#f0f9ff", border: "3px solid #0ea5e9",
                fontWeight: 800, fontSize: "32px", color: "#0c4a6e",
                letterSpacing: "5px", fontFamily: "monospace",
              }}>
                {vehicle.placa}
              </div>
            </div>

            {/* Detalhes */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {vehicle.modelo && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", color: "#64748b" }}>Modelo</span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{vehicle.modelo}</span>
                </div>
              )}
              {vehicle.cor && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", color: "#64748b" }}>Cor</span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{vehicle.cor}</span>
                </div>
              )}
              {vehicle.motorista_nome && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", color: "#64748b" }}>Motorista</span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{vehicle.motorista_nome}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "#64748b" }}>Destino</span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                  Bloco {vehicle.bloco} · Apto {vehicle.apartamento}
                </span>
              </div>
            </div>

            {vehicle.observacao && (
              <p style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic", padding: "8px 12px", background: "#f8fafc", borderRadius: "10px" }}>
                💬 Portaria: {vehicle.observacao}
              </p>
            )}
          </div>
        )}

        {/* Observação do morador */}
        <div style={{
          background: "#fff", borderRadius: "16px", padding: "20px",
          border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "10px",
        }}>
          <label htmlFor="morador-obs" style={{ fontWeight: 700, fontSize: "14px", color: "#0c4a6e" }}>
            Observação (opcional)
          </label>
          <p id="morador-obs-help" style={{ fontSize: "12px", color: "#64748b", marginTop: "-4px" }}>
            Informe à portaria onde o veículo deve estacionar ou outra instrução.
          </p>
          <textarea
            id="morador-obs"
            aria-describedby="morador-obs-help"
            maxLength={500}
            value={morador_observacao}
            onChange={(e) => setMoradorObservacao(e.target.value)}
            placeholder="Ex: Encaminhar para vaga de visitantes, Autorizado a estacionar em minha vaga (G-12)..."
            rows={4}
            style={{
              width: "100%", padding: "14px", borderRadius: "12px",
              border: "1px solid #cbd5e1", fontSize: "14px", background: "#fff",
              color: "#0f172a", outline: "none", boxSizing: "border-box", resize: "vertical",
            }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={() => handleAction("aprovar")}
            disabled={submitting}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              padding: "16px", borderRadius: "14px",
              background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
              border: "none", color: "#fff", fontWeight: 800, fontSize: "16px",
              cursor: submitting ? "not-allowed" : "pointer", width: "100%",
              opacity: submitting ? 0.7 : 1,
              boxShadow: "0 4px 12px rgba(34,197,94,0.3)",
            }}
          >
            <CheckCircle2 aria-hidden="true" style={{ width: "20px", height: "20px" }} />
            {submitting ? "Processando..." : "Permitir Acesso"}
          </button>

          <button
            onClick={() => handleAction("negar")}
            disabled={submitting}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              padding: "16px", borderRadius: "14px",
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              border: "none", color: "#fff", fontWeight: 800, fontSize: "16px",
              cursor: submitting ? "not-allowed" : "pointer", width: "100%",
              opacity: submitting ? 0.7 : 1,
              boxShadow: "0 4px 12px rgba(239,68,68,0.3)",
            }}
          >
            <XCircle aria-hidden="true" style={{ width: "20px", height: "20px" }} />
            {submitting ? "Processando..." : "Negar Acesso"}
          </button>
        </div>
      </main>
    </div>
  );
}
