import { BellRing, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { enablePushNotifications } from "@/lib/pushNotifications";

interface Props {
  open: boolean;
  status: "prompt" | "blocked";
  onClose: () => void;
}

export default function PushPermissionModal({ open, status, onClose }: Readonly<Props>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isBlocked = status === "blocked";
  const isIos = /iPhone|iPad|iPod/i.test(globalThis.navigator.userAgent);
  const showEnableButton = isBlocked === false;
  const showAndroidNote = isIos === false;

  if (!open) return null;

  const handleEnable = async () => {
    setIsSubmitting(true);
    try {
      await enablePushNotifications();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          background: "#ffffff",
          borderRadius: "22px",
          padding: "34px 28px",
          maxWidth: "460px",
          width: "100%",
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#94a3b8",
            padding: "4px",
          }}
        >
          <X style={{ width: "20px", height: "20px" }} />
        </button>

        <div
          style={{
            width: "68px",
            height: "68px",
            borderRadius: "50%",
            background: isBlocked
              ? "linear-gradient(135deg, #dc2626, #f97316)"
              : "linear-gradient(135deg, #003580, #0062d1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 18px",
          }}
        >
          {isBlocked ? (
            <ShieldAlert style={{ width: "34px", height: "34px", color: "#ffffff" }} />
          ) : (
            <BellRing style={{ width: "34px", height: "34px", color: "#ffffff" }} />
          )}
        </div>

        <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", textAlign: "center", marginBottom: "10px" }}>
          {isBlocked ? "Notificações bloqueadas" : "Ative chamadas com o app fechado"}
        </h2>

        <p style={{ fontSize: "15px", color: "#475569", lineHeight: 1.65, textAlign: "center", marginBottom: "22px" }}>
          {isBlocked
            ? "As notificações deste celular estão bloqueadas por padrão. Faça o desbloqueio antes de utilizar o INTERFONE APP. Caso contrario o morador não recebe as chamdas quando o app estiver fechado."
            : "Ative as notificações neste celular para receber chamadas do interfone mesmo quando o aplicativo não estiver aberto."}
        </p>

        {isBlocked ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "22px" }}>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "14px 16px" }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                {isIos ? "Como desbloquear no iPhone" : "Como desbloquear no celular Android"}
              </p>
              <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.6 }}>
                {isIos ? (
                  <>
                    1. Abra o site no Safari.
                    <br />2. Toque em <strong>Compartilhar</strong> e escolha <strong>Adicionar à Tela de Início</strong>.
                    <br />3. Abra o app pela tela inicial.
                    <br />4. Vá em <strong>Ajustes do iPhone {'>'} Notificações {'>'} App Interfone</strong> e permita.
                  </>
                ) : (
                  <>
                    1. Toque no ícone ao lado da barra de endereço.
                    <br />2. Abra <strong>Permissões</strong> ou <strong>Configurações do site</strong>.
                    <br />3. Troque <strong>Notificações</strong> para <strong>Permitir</strong>.
                    <br />4. Recarregue a página e faça login novamente.
                  </>
                )}
              </p>
            </div>

            {showAndroidNote ? (
              <div style={{ background: "#fff7ed", border: "1px solid #fdba74", borderRadius: "14px", padding: "12px 14px" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "#9a3412", marginBottom: "4px" }}>Importante</p>
                <p style={{ fontSize: "12px", color: "#9a3412", lineHeight: 1.6 }}>
                  Esse desbloqueio deve ser feito no celular do morador, não no computador nem no celular do porteiro.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {showEnableButton ? (
            <button
              onClick={handleEnable}
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #003580, #0062d1)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "15px",
                border: "none",
                cursor: isSubmitting ? "default" : "pointer",
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? "Ativando..." : "Ativar notificações agora"}
            </button>
          ) : null}

          <button
            onClick={onClose}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: "12px",
              background: "transparent",
              color: "#334155",
              fontWeight: 700,
              fontSize: "14px",
              border: "1px solid #cbd5e1",
              cursor: "pointer",
            }}
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}