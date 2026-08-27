/**
 * ═══════════════════════════════════════════════════════════
 * PRIMEIRO USO — deixa o celular pronto para receber chamada
 * Roda logo após o login no app instalado. Sem estes quatro
 * itens a campainha toca tarde, sem imagem, ou não toca.
 * Só consulta e leva o morador à tela certa: nada é forçado.
 * ═══════════════════════════════════════════════════════════
 */
import { BatteryCharging, BellRing, Camera, Check, Maximize2, PowerOff, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  abrirConfigApp,
  abrirConfigBateria,
  abrirConfigTelaCheia,
  bateriaLiberada,
  hibernacaoLiberada,
  permissoesDeMidia,
  podeUsarTelaCheia,
} from "@/lib/callRing";
import { EVENTO_CHAMADA_ATIVA, haChamadaAtiva } from "@/lib/appNav";
import { isNative } from "@/lib/config";
import { enablePushNotifications } from "@/lib/pushNotifications";

const DISPENSADO_KEY = "appinterfone:preparo-dispensado";

type ItemId = "notificacoes" | "midia" | "telaCheia" | "bateria" | "hibernacao";
type Estado = Record<ItemId, boolean>;

const TUDO_OK: Estado = {
  notificacoes: true,
  midia: true,
  telaCheia: true,
  bateria: true,
  hibernacao: true,
};

/**
 * Sem estes três a campainha não funciona — são eles que abrem a tela.
 * Os demais são reforço: em vários aparelhos (Motorola, por exemplo) o
 * sistema nem oferece a tela que os libera, e um item impossível de marcar
 * travaria o morador aqui para sempre.
 */
const ESSENCIAIS: ItemId[] = ["notificacoes", "midia", "telaCheia"];

const faltaEssencial = (e: Estado) => ESSENCIAIS.some((id) => !e[id]);

async function notificacoesLiberadas(): Promise<boolean> {
  if (!isNative) return true;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const r = await PushNotifications.checkPermissions();
    return r.receive === "granted";
  } catch {
    return true;
  }
}

/** Pede câmera e microfone pelo WebView — é o Capacitor que repassa ao Android. */
async function pedirCameraEMicrofone(): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    for (const track of stream.getTracks()) track.stop();
    return;
  } catch {
    // Pode ser recusa do morador ou falha do próprio hardware — confere abaixo.
  }
  const atual = await permissoesDeMidia();
  // Continua negado no Android: só a tela do app resolve ("não perguntar de novo").
  if (atual && (!atual.camera || !atual.microfone)) await abrirConfigApp();
}

const ITENS: {
  id: ItemId;
  icone: typeof BellRing;
  titulo: string;
  texto: string;
  botao: string;
  /** Caminho dentro da tela do sistema: sem isso o morador abre e não sabe onde tocar. */
  dica?: string;
}[] = [
  {
    id: "notificacoes",
    icone: BellRing,
    titulo: "Notificações",
    texto: "A chamada chega mesmo com o app fechado.",
    botao: "Ativar",
  },
  {
    id: "midia",
    icone: Camera,
    titulo: "Câmera e microfone",
    texto: "Para ver e falar com quem está na portaria.",
    botao: "Permitir",
  },
  {
    id: "telaCheia",
    icone: Maximize2,
    titulo: "Chamada em tela cheia",
    texto: "Faz o interfone abrir sozinho com o celular bloqueado.",
    botao: "Abrir ajuste",
  },
  {
    id: "bateria",
    icone: BatteryCharging,
    titulo: "Sem economia de bateria",
    texto: "Impede o Android de segurar a chamada.",
    botao: "Abrir ajuste",
    dica: "Bateria → liberar o uso em segundo plano.",
  },
  {
    id: "hibernacao",
    icone: PowerOff,
    titulo: "App sempre ativo",
    texto: "Meses sem abrir, o Android desliga as notificações.",
    botao: "Abrir ajuste",
    dica: "Desligue “Gerenciar o app fora de uso”.",
  },
];

export default function PreparoDispositivoModal() {
  const [estado, setEstado] = useState<Estado>(TUDO_OK);
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState<ItemId | null>(null);

  const conferir = useCallback(async (): Promise<Estado> => {
    const [notificacoes, midia, telaCheia, bateria, hibernacao] = await Promise.all([
      notificacoesLiberadas(),
      permissoesDeMidia(),
      podeUsarTelaCheia(),
      bateriaLiberada(),
      hibernacaoLiberada(),
    ]);
    // midia null = navegador ou APK antigo: não dá para saber, então não cobra.
    const proximo: Estado = {
      notificacoes,
      midia: midia === null || (midia.camera && midia.microfone),
      telaCheia,
      bateria,
      hibernacao,
    };
    setEstado(proximo);
    return proximo;
  }, []);

  useEffect(() => {
    if (!isNative) return;
    let vivo = true;

    const rodar = async () => {
      const atual = await conferir();
      if (!vivo) return;
      // Chamada tocando ou em andamento manda na tela — o preparo espera.
      if (haChamadaAtiva()) {
        setAberto(false);
        return;
      }
      if (!Object.values(atual).includes(false)) {
        setAberto(false);
        // Voltou a faltar algo um dia? A tela aparece de novo.
        localStorage.removeItem(DISPENSADO_KEY);
        return;
      }
      // Só recomendado pendente não insiste: em muitos aparelhos o sistema nem
      // oferece a tela que os libera, e o morador ficaria vendo isto para sempre.
      if (localStorage.getItem(DISPENSADO_KEY) !== "1") setAberto(true);
    };

    void rodar();

    // Volta das configurações do sistema: reconfere o que o morador liberou.
    const onVis = () => {
      if (document.visibilityState === "visible") void rodar();
    };
    // Cold start pela notificação: a chamada chega depois do mount e tem
    // prioridade; quando ela acaba, o preparo volta se ainda faltar algo.
    const onChamada = (e: Event) => {
      if ((e as CustomEvent<boolean>).detail) setAberto(false);
      else void rodar();
    };
    document.addEventListener("visibilitychange", onVis);
    globalThis.addEventListener(EVENTO_CHAMADA_ATIVA, onChamada);
    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", onVis);
      globalThis.removeEventListener(EVENTO_CHAMADA_ATIVA, onChamada);
    };
  }, [conferir]);

  if (!aberto) return null;

  const resolver = async (id: ItemId) => {
    setOcupado(id);
    try {
      if (id === "notificacoes") {
        await enablePushNotifications();
        // Bloqueado de vez: o pedido não abre diálogo nenhum, então leva à tela do app.
        if (!(await notificacoesLiberadas())) await abrirConfigApp();
      }
      else if (id === "midia") await pedirCameraEMicrofone();
      else if (id === "telaCheia") await abrirConfigTelaCheia();
      else if (id === "hibernacao") await abrirConfigApp();
      else await abrirConfigBateria();
      await conferir();
    } finally {
      setOcupado(null);
    }
  };

  const fechar = () => {
    localStorage.setItem(DISPENSADO_KEY, "1");
    setAberto(false);
  };

  const pendentes = ITENS.filter((i) => ESSENCIAIS.includes(i.id) && !estado[i.id]).length;

  const linha = ({ id, icone: Icone, titulo, texto, botao, dica }: (typeof ITENS)[number]) => {
    const ok = estado[id];
    return (
      <div
        key={id}
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "center",
          // Fonte grande do sistema: o botão desce para a linha de baixo
          // em vez de espremer o texto numa coluna de duas palavras.
          flexWrap: "wrap",
          background: ok ? "#f0fdf4" : "#f8fafc",
          border: `1px solid ${ok ? "#bbf7d0" : "#e2e8f0"}`,
          borderRadius: "12px",
          padding: "10px 11px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "9px",
            flexShrink: 0,
            background: ok ? "#dcfce7" : "#e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {ok ? (
            <Check style={{ width: "16px", height: "16px", color: "#16a34a" }} />
          ) : (
            <Icone style={{ width: "16px", height: "16px", color: "#475569" }} />
          )}
        </div>

        <div style={{ flex: "1 1 120px", minWidth: 0 }}>
          <p style={{ fontSize: "12.5px", fontWeight: 700, color: "#0f172a" }}>{titulo}</p>
          <p style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.45 }}>{texto}</p>
          {ok || !dica ? null : (
            <p style={{ fontSize: "11px", color: "#003580", fontWeight: 600, marginTop: "3px" }}>{dica}</p>
          )}
        </div>

        {ok ? null : (
          <button
            onClick={() => void resolver(id)}
            disabled={ocupado !== null}
            style={{
              flexShrink: 0,
              // Com dica, o texto ocupa a largura toda e o botão desce:
              // lado a lado ele espremeria a frase em três linhas.
              ...(dica ? { flexBasis: "100%" } : { marginLeft: "auto" }),
              padding: "8px 12px",
              borderRadius: "9px",
              background: "#003580",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "12px",
              whiteSpace: "nowrap",
              border: "none",
              cursor: ocupado ? "default" : "pointer",
              opacity: ocupado ? 0.6 : 1,
            }}
          >
            {ocupado === id ? "..." : botao}
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Preparar o celular para receber chamadas"
      style={{
        position: "fixed",
        inset: 0,
        // Acima do aviso de notificação (99999): este passo cobre aquele.
        zIndex: 100000,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
        display: "flex",
        // flex-start + margin auto no cartão: centraliza quando cabe e, com
        // fonte grande do sistema, ainda deixa rolar até o topo em vez de cortar.
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))",
        overflowY: "auto",
        // Nada de arrastar o cartão para os lados: some com a borda do celular.
        overflowX: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "18px",
          padding: "20px 16px",
          maxWidth: "380px",
          width: "100%",
          margin: "auto",
          boxSizing: "border-box",
          // Palavra longa com fonte grande do sistema não empurra a largura.
          overflowWrap: "anywhere",
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            width: "46px",
            height: "46px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #003580, #0062d1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 12px",
            flexShrink: 0,
          }}
        >
          <ShieldCheck style={{ width: "24px", height: "24px", color: "#ffffff" }} />
        </div>

        <h2 style={{ fontSize: "17px", fontWeight: 800, color: "#0f172a", textAlign: "center", marginBottom: "6px" }}>
          Deixe seu celular pronto
        </h2>
        <p style={{ fontSize: "12.5px", color: "#475569", lineHeight: 1.5, textAlign: "center", marginBottom: "14px" }}>
          {pendentes === 0
            ? "O essencial já está pronto. Abaixo, o que deixa a campainha ainda mais garantida."
            : pendentes === 1
              ? "Falta 1 ajuste para o interfone tocar sempre que alguém chamar."
              : `Faltam ${pendentes} ajustes para o interfone tocar sempre que alguém chamar.`}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
          {ITENS.filter((i) => ESSENCIAIS.includes(i.id)).map(linha)}
        </div>

        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#94a3b8",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}
        >
          Recomendado
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
          {ITENS.filter((i) => !ESSENCIAIS.includes(i.id)).map(linha)}
        </div>

        <button
          onClick={fechar}
          style={{
            width: "100%",
            padding: "11px",
            borderRadius: "10px",
            background: pendentes === 0 ? "#003580" : "transparent",
            color: pendentes === 0 ? "#ffffff" : "#334155",
            fontWeight: 700,
            fontSize: "12.5px",
            boxSizing: "border-box",
            border: pendentes === 0 ? "none" : "1px solid #cbd5e1",
            cursor: "pointer",
          }}
        >
          {pendentes === 0 ? "Pronto" : "Fazer isso depois"}
        </button>
      </div>
    </div>
  );
}
