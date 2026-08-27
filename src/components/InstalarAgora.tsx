import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCodeLib from "qrcode";
import {
  ArrowDown, ArrowUp, Bell, Check, Copy, Download, Share, SquarePlus, X,
} from "lucide-react";
import {
  detectarPlataforma, ehIpad, ehStandalone, getPromptInstalacao,
  limparPromptInstalacao, ouvirPromptInstalacao, type Plataforma,
} from "@/lib/pwaInstall";

interface Props {
  mode: "dark" | "light";
  variante?: "hero" | "secao";
  rotulo?: string;
}

const AZUL = "#003580";

export default function InstalarAgora({ mode, variante = "secao", rotulo }: Readonly<Props>) {
  const navigate = useNavigate();
  const [plataforma, setPlataforma] = useState<Plataforma>("desktop");
  const [temPrompt, setTemPrompt] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [qr, setQr] = useState("");

  useEffect(() => {
    setPlataforma(detectarPlataforma());
    setTemPrompt(!!getPromptInstalacao());
    return ouvirPromptInstalacao(() => {
      setTemPrompt(!!getPromptInstalacao());
      if (ehStandalone()) setPlataforma("instalado");
    });
  }, []);

  // QR só no desktop, e só quando o usuário abre: não custa nada em celular.
  useEffect(() => {
    if (!aberto || plataforma !== "desktop" || qr) return;
    QRCodeLib.toDataURL(globalThis.location.origin, {
      width: 240, margin: 1, color: { dark: AZUL, light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => {});
  }, [aberto, plataforma, qr]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [aberto]);

  const instalar = useCallback(async () => {
    if (plataforma === "instalado") { navigate("/login"); return; }

    const prompt = getPromptInstalacao();
    if (prompt) {
      // Android/Chrome: instalação de verdade, em um toque.
      try {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        limparPromptInstalacao();
        if (outcome === "accepted") return;
      } catch {
        limparPromptInstalacao();
      }
    }
    setAberto(true);
  }, [navigate, plataforma]);

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(globalThis.location.origin);
      setCopiado(true);
      globalThis.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  };

  const escuro = mode === "dark";
  const heroStyle = { background: "#ffffff", color: AZUL, border: "2px solid #ffffff" };
  const secaoStyle = {
    background: `linear-gradient(135deg, #0062d1 0%, ${AZUL} 100%)`,
    color: "#ffffff", border: "2px solid transparent",
  };

  const texto = rotulo ?? (plataforma === "instalado" ? "Abrir o app" : "Instalar agora");

  return (
    <>
      <button
        type="button"
        onClick={instalar}
        style={{
          ...(variante === "hero" ? heroStyle : secaoStyle),
          display: "inline-flex", alignItems: "center", gap: "10px",
          padding: "16px 32px", borderRadius: "14px",
          fontSize: "16px", fontWeight: 700, cursor: "pointer",
          boxShadow: "0 10px 30px rgba(0, 53, 128, 0.25)",
          transition: "transform 0.2s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
      >
        <Download style={{ width: "18px", height: "18px" }} />
        {texto}
        {temPrompt && plataforma === "android" && (
          <span style={{ fontSize: "12px", fontWeight: 600, opacity: 0.75 }}>· 1 toque</span>
        )}
      </button>

      {aberto && (
        <Overlay
          plataforma={plataforma}
          escuro={escuro}
          qr={qr}
          copiado={copiado}
          onCopiar={copiarLink}
          onFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}

interface OverlayProps {
  plataforma: Plataforma;
  escuro: boolean;
  qr: string;
  copiado: boolean;
  onCopiar: () => void;
  onFechar: () => void;
}

function Overlay({ plataforma, escuro, qr, copiado, onCopiar, onFechar }: Readonly<OverlayProps>) {
  const fundo = escuro ? "#0b1220" : "#ffffff";
  const corTitulo = escuro ? "#f8fafc" : "#0f172a";
  const corpo = escuro ? "#cbd5e1" : "#475569";
  const linha = escuro ? "rgba(255,255,255,0.12)" : "rgba(0,53,128,0.12)";
  const destaque = escuro ? "#4d9fff" : AZUL;
  const barraEmCima = ehIpad();

  const passo = (n: number, Icone: typeof Share, chamada: string, detalhe: string) => (
    <li key={n} style={{ display: "flex", gap: "14px", alignItems: "flex-start", listStyle: "none" }}>
      <span style={{
        flexShrink: 0, width: "34px", height: "34px", borderRadius: "50%",
        background: destaque, color: "#ffffff", fontWeight: 800, fontSize: "15px",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{n}</span>
      <span>
        <span style={{ display: "flex", alignItems: "center", gap: "8px", color: corTitulo, fontWeight: 700, fontSize: "16px" }}>
          <Icone style={{ width: "18px", height: "18px", color: destaque }} /> {chamada}
        </span>
        <span style={{ display: "block", color: corpo, fontSize: "14px", marginTop: "3px", lineHeight: 1.45 }}>
          {detalhe}
        </span>
      </span>
    </li>
  );

  const titulos: Record<Plataforma, [string, string]> = {
    "ios-safari": ["Instalar no iPhone", "São 3 toques. Leva 20 segundos."],
    "ios-outro": ["Abra no Safari primeiro", "No iPhone, só o Safari instala aplicativos."],
    android: ["Instalar no Android", "Pelo menu do navegador, em 2 toques."],
    desktop: ["Instalar no celular", "O app é do morador, no celular dele."],
    instalado: ["Já está instalado", "Abra pelo ícone na tela de início."],
  };
  const [tituloTexto, subtitulo] = titulos[plataforma];

  return (
    <div
      role="presentation"
      onClick={onFechar}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(2, 8, 23, 0.72)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
        animation: "iaFade 0.2s ease",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Como instalar o App Interfone"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative", width: "100%", maxWidth: "440px",
          background: fundo, borderRadius: "22px", padding: "26px 24px 22px",
          border: `1px solid ${linha}`, boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          maxHeight: "88vh", overflowY: "auto",
          animation: "iaSobe 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          style={{
            position: "absolute", top: "14px", right: "14px", width: "34px", height: "34px",
            borderRadius: "50%", border: "none", cursor: "pointer",
            background: escuro ? "rgba(255,255,255,0.1)" : "rgba(0,53,128,0.08)",
            color: corTitulo, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <X style={{ width: "17px", height: "17px" }} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
          <img
            src="/apple-touch-icon.png"
            alt=""
            width={46}
            height={46}
            style={{ borderRadius: "11px", boxShadow: "0 4px 14px rgba(0,0,0,0.25)" }}
          />
          <span>
            <span style={{ display: "block", color: corTitulo, fontWeight: 800, fontSize: "18px" }}>{tituloTexto}</span>
            <span style={{ display: "block", color: corpo, fontSize: "13px", marginTop: "2px" }}>{subtitulo}</span>
          </span>
        </div>

        {plataforma === "ios-safari" && (
          <>
            <ol style={{ display: "flex", flexDirection: "column", gap: "16px", margin: 0, padding: 0 }}>
              {passo(1, Share, "Toque em Compartilhar", barraEmCima
                ? "É o quadradinho com a seta para cima, na barra de cima."
                : "É o quadradinho com a seta para cima, na barra de baixo.")}
              {passo(2, SquarePlus, "Adicionar à Tela de Início", "Role o menu para baixo até achar essa opção.")}
              {passo(3, Check, "Confirme em Adicionar", "Fica no canto superior direito da tela.")}
              {passo(4, Bell, "Abra pelo ícone e permita as notificações", "É isso que faz a chamada tocar com o app fechado.")}
            </ol>

            <div style={{
              marginTop: "20px", padding: "14px 16px", borderRadius: "14px",
              background: escuro ? "rgba(77,159,255,0.12)" : "rgba(0,53,128,0.06)",
              color: corpo, fontSize: "13.5px", lineHeight: 1.5,
            }}>
              Pelo Safari em aba normal a chamada <strong style={{ color: corTitulo }}>não toca</strong>. Só pelo ícone.
              {" "}Não achou <em>Adicionar à Tela de Início</em>? Você abriu por um link dentro de outro app: toque em Compartilhar e escolha <strong style={{ color: corTitulo }}>Abrir no Safari</strong>.
            </div>

            <div style={{
              marginTop: "18px", display: "flex", flexDirection: "column",
              alignItems: "center", gap: "6px", color: destaque, fontWeight: 700, fontSize: "14px",
            }}>
              {barraEmCima && <ArrowUp style={{ width: "26px", height: "26px", animation: "iaPula 1.2s ease-in-out infinite" }} />}
              <span>O botão Compartilhar está {barraEmCima ? "lá em cima" : "aqui embaixo"}</span>
              {!barraEmCima && <ArrowDown style={{ width: "26px", height: "26px", animation: "iaPula 1.2s ease-in-out infinite" }} />}
            </div>
          </>
        )}

        {plataforma === "ios-outro" && (
          <>
            <ol style={{ display: "flex", flexDirection: "column", gap: "16px", margin: 0, padding: 0 }}>
              {passo(1, Copy, "Copie o endereço do site", "O botão abaixo já copia para você.")}
              {passo(2, Share, "Abra o Safari e cole na barra de endereço", "Se você abriu por um link dentro de outro app, toque em Compartilhar e escolha Abrir no Safari.")}
              {passo(3, SquarePlus, "Toque em Instalar agora de novo", "Aí aparecem os 3 passos da instalação.")}
            </ol>
            <button
              type="button"
              onClick={onCopiar}
              style={{
                marginTop: "20px", width: "100%", padding: "15px",
                borderRadius: "14px", border: "none", cursor: "pointer",
                background: copiado ? "#16a34a" : destaque, color: "#ffffff",
                fontWeight: 700, fontSize: "15px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "9px",
              }}
            >
              {copiado
                ? <><Check style={{ width: "18px", height: "18px" }} /> Link copiado</>
                : <><Copy style={{ width: "18px", height: "18px" }} /> Copiar o link do site</>}
            </button>
          </>
        )}

        {plataforma === "android" && (
          <ol style={{ display: "flex", flexDirection: "column", gap: "16px", margin: 0, padding: 0 }}>
            {passo(1, SquarePlus, "Abra o menu do navegador", "Os três pontinhos, no canto superior direito.")}
            {passo(2, Download, "Toque em Instalar aplicativo", "Em alguns aparelhos aparece como Adicionar à tela inicial.")}
            {passo(3, Bell, "Abra pelo ícone e permita as notificações", "É o que faz a chamada tocar com o app fechado.")}
          </ol>
        )}

        {plataforma === "desktop" && (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: corpo, fontSize: "14px", lineHeight: 1.5, margin: "0 0 16px" }}>
              Aponte a câmera do celular para o código e instale no aparelho que vai receber as chamadas.
            </p>
            {qr
              ? <img src={qr} alt="QR Code do site" width={200} height={200} style={{ borderRadius: "14px", background: "#ffffff", padding: "8px" }} />
              : <span style={{ color: corpo, fontSize: "13px" }}>Gerando o código…</span>}
          </div>
        )}

        <style>{`
          @keyframes iaFade { from { opacity: 0 } to { opacity: 1 } }
          @keyframes iaSobe { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }
          @keyframes iaPula { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(7px) } }
          @media (prefers-reduced-motion: reduce) {
            [role="dialog"], [role="dialog"] * { animation: none !important }
          }
        `}</style>
      </div>
    </div>
  );
}
