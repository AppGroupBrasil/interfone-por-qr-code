import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { QrCode } from "lucide-react";
import { apiFetch } from "@/lib/api";

/* ═══════════════════════════════════════════════
   Página pública para exibir QR Code de Visitante
   Acessada via link curto compartilhado pelo morador
   ═══════════════════════════════════════════════ */

interface ShareData {
  visitor_name: string;
  visitor_doc: string | null;
  visitor_parentesco: string | null;
  data_inicio: string;
  hora_inicio: string;
  data_fim: string;
  hora_fim: string;
  morador_nome: string | null;
  bloco: string | null;
  unidade: string | null;
  condominio_nome: string | null;
  qr_data: string;
}

export default function QRVisitantePublic() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setError("Link inválido."); setLoading(false); return; }

    apiFetch(`/api/visitor-qr/${token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("QR Code não encontrado.");
        const json = await res.json();
        setData(json);
      })
      .catch((err) => setError(err.message || "Erro ao carregar."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div role="status" aria-live="polite" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <p style={{ color: "#6b7280", fontSize: "16px" }}>Carregando...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div role="alert" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: "20px" }}>
        <p style={{ color: "#991b1b", fontWeight: 700, fontSize: "16px" }}>{error || "QR Code não encontrado ou expirado."}</p>
      </div>
    );
  }

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(data.qr_data)}`;

  return (
    <div style={{ minHeight: "100dvh", background: "#f1f5f9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{
        background: "#fff", borderRadius: "20px", padding: "28px",
        border: "3px solid #6366f1", textAlign: "center", width: "100%", maxWidth: "380px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
      }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", borderRadius: "14px", padding: "16px", marginBottom: "20px" }}>
          <QrCode aria-hidden="true" style={{ width: "32px", height: "32px", color: "#fff", margin: "0 auto" }} />
          <p style={{ color: "#fff", fontWeight: 800, fontSize: "16px", marginTop: "6px" }}>AUTORIZAÇÃO DE ENTRADA</p>
          {data.condominio_nome && <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px" }}>{data.condominio_nome}</p>}
        </div>

        {/* Visitor info */}
        <p style={{ fontWeight: 800, fontSize: "18px", color: "#374151" }}>{data.visitor_name}</p>
        {data.visitor_doc && <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>Doc: {data.visitor_doc}</p>}
        {data.visitor_parentesco && <p style={{ fontSize: "13px", color: "#6b7280" }}>Parentesco: {data.visitor_parentesco}</p>}

        {/* Validity */}
        <div style={{ margin: "20px 0", background: "#f8fafc", borderRadius: "12px", padding: "12px", border: "1px solid #e5e7eb" }}>
          <p style={{ fontSize: "12px", color: "#6b7280", fontWeight: 700, marginBottom: "4px" }}>VÁLIDO DE</p>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "#374151" }}>{data.data_inicio} às {data.hora_inicio}</p>
          <p style={{ fontSize: "12px", color: "#6b7280", fontWeight: 700, marginTop: "8px", marginBottom: "4px" }}>ATÉ</p>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "#374151" }}>{data.data_fim} às {data.hora_fim}</p>
        </div>

        {/* QR Code */}
        <div style={{ margin: "16px 0" }}>
          <img
            src={qrImageUrl}
            alt={`QR Code de autorização para ${data.visitor_name}`}
            style={{ width: "220px", height: "220px", margin: "0 auto", borderRadius: "12px" }}
            crossOrigin="anonymous"
          />
        </div>

        <p style={{ fontSize: "11px", color: "#9ca3af" }}>
          Morador: {data.morador_nome || "N/A"} · Bloco {data.bloco || "—"} Apt {data.unidade || "—"}
        </p>
      </div>

      <p style={{ marginTop: "16px", fontSize: "13px", color: "#6b7280", textAlign: "center" }}>
        Apresente este QR Code na portaria do condomínio.
      </p>
    </div>
  );
}
