import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, CheckCircle2, Download, ShieldCheck, Smartphone } from "lucide-react";
import InstalarAgora from "@/components/InstalarAgora";
import { APK_URL, APK_VERSAO } from "@/lib/pwaInstall";

const AZUL = "#003580";

const cartao: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "20px",
  padding: "24px 22px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 12px 34px rgba(15, 23, 42, 0.07)",
};

function Passo({ n, titulo, detalhe }: Readonly<{ n: number; titulo: string; detalhe: string }>) {
  return (
    <li style={{ display: "flex", gap: "13px", alignItems: "flex-start" }}>
      <span
        style={{
          flexShrink: 0, width: "26px", height: "26px", borderRadius: "50%",
          background: AZUL, color: "#ffffff", fontSize: "13px", fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {n}
      </span>
      <span>
        <span style={{ display: "block", color: "#0f172a", fontSize: "15px", fontWeight: 700 }}>{titulo}</span>
        <span style={{ display: "block", color: "#475569", fontSize: "14px", marginTop: "3px", lineHeight: 1.45 }}>
          {detalhe}
        </span>
      </span>
    </li>
  );
}

export default function InstalarAndroid() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6fb", padding: "22px 18px 48px" }}>
      <div style={{ maxWidth: "560px", margin: "0 auto" }}>
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            display: "inline-flex", alignItems: "center", gap: "7px", marginBottom: "20px",
            background: "none", border: "none", padding: 0, cursor: "pointer",
            color: AZUL, fontSize: "14px", fontWeight: 600,
          }}
        >
          <ArrowLeft style={{ width: "16px", height: "16px" }} /> Voltar ao site
        </button>

        <header style={{ textAlign: "center", marginBottom: "26px" }}>
          <img src="/logo.png" alt="App Interfone" width={68} height={68} style={{ borderRadius: "16px" }} />
          <h1 style={{ margin: "14px 0 6px", fontSize: "26px", fontWeight: 800, color: "#0f172a" }}>
            Instalar no Android
          </h1>
          <p style={{ margin: 0, color: "#475569", fontSize: "15px", lineHeight: 1.5 }}>
            Escolha um dos dois caminhos. Os dois funcionam com o celular bloqueado.
          </p>
        </header>

        <section style={{ ...cartao, marginBottom: "18px" }}>
          <span
            style={{
              display: "inline-block", background: "#dcfce7", color: "#166534",
              fontSize: "12px", fontWeight: 700, padding: "4px 10px", borderRadius: "999px",
              marginBottom: "12px",
            }}
          >
            MAIS RÁPIDO
          </span>
          <h2 style={{ margin: "0 0 6px", fontSize: "19px", fontWeight: 800, color: "#0f172a" }}>
            <Smartphone style={{ width: "18px", height: "18px", color: AZUL, verticalAlign: "-3px", marginRight: "7px" }} />
            Instalar pelo navegador
          </h2>
          <p style={{ margin: "0 0 16px", color: "#475569", fontSize: "14px", lineHeight: 1.5 }}>
            Um toque, sem baixar arquivo. O ícone vai para a tela do celular e o app abre em tela cheia,
            com as notificações de chamada.
          </p>
          <InstalarAgora mode="light" />
        </section>

        <section style={cartao}>
          <h2 style={{ margin: "0 0 6px", fontSize: "19px", fontWeight: 800, color: "#0f172a" }}>
            <Download style={{ width: "18px", height: "18px", color: AZUL, verticalAlign: "-3px", marginRight: "7px" }} />
            Baixar o aplicativo completo
          </h2>
          <p style={{ margin: "0 0 18px", color: "#475569", fontSize: "14px", lineHeight: 1.5 }}>
            Versão {APK_VERSAO}, a mesma que vai para a Google Play. Toca a campainha por 30 segundos e
            abre a chamada em tela cheia, como uma ligação.
          </p>

          <a
            href={APK_URL}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              background: `linear-gradient(135deg, #0062d1 0%, ${AZUL} 100%)`,
              color: "#ffffff", textDecoration: "none",
              padding: "16px 24px", borderRadius: "14px", fontSize: "16px", fontWeight: 700,
              boxShadow: "0 10px 30px rgba(0, 53, 128, 0.25)", marginBottom: "20px",
            }}
          >
            <Download style={{ width: "18px", height: "18px" }} /> Baixar o app (Android)
          </a>

          <ol style={{ display: "flex", flexDirection: "column", gap: "15px", margin: "0 0 18px", padding: 0, listStyle: "none" }}>
            <Passo n={1} titulo="Toque no botão azul" detalhe="O download começa na hora, direto pelo celular." />
            <Passo
              n={2}
              titulo="Abra o arquivo baixado"
              detalhe="Se o navegador avisar que o arquivo pode ser perigoso, escolha Baixar mesmo assim: é o app oficial."
            />
            <Passo
              n={3}
              titulo="Permita instalar desta fonte"
              detalhe="O Android abre as configurações uma única vez. Ative para o navegador, volte e toque em Instalar."
            />
            <Passo
              n={4}
              titulo="Abra o app e permita as notificações"
              detalhe="É o que faz a chamada tocar com o celular bloqueado."
            />
          </ol>

          <p
            style={{
              display: "flex", gap: "9px", alignItems: "flex-start", margin: 0,
              background: "#f1f5f9", borderRadius: "12px", padding: "13px 14px",
              color: "#475569", fontSize: "13px", lineHeight: 1.5,
            }}
          >
            <ShieldCheck style={{ width: "17px", height: "17px", color: AZUL, flexShrink: 0, marginTop: "1px" }} />
            <span>
              Arquivo assinado pela AppGroupBrasil e publicado por nós mesmos, enquanto a versão da Google Play
              não é liberada. As melhorias chegam sozinhas, sem precisar baixar de novo.
            </span>
          </p>
        </section>

        <p
          style={{
            display: "flex", gap: "8px", alignItems: "center", justifyContent: "center",
            margin: "22px 0 0", color: "#64748b", fontSize: "13px", textAlign: "center",
          }}
        >
          <Bell style={{ width: "15px", height: "15px", flexShrink: 0 }} />
          Depois de instalar, mantenha as notificações ligadas e a economia de bateria desligada.
        </p>

        <p
          style={{
            display: "flex", gap: "8px", alignItems: "center", justifyContent: "center",
            margin: "10px 0 0", color: "#64748b", fontSize: "13px",
          }}
        >
          <CheckCircle2 style={{ width: "15px", height: "15px", flexShrink: 0 }} />
          Já instalou? <button
            type="button"
            onClick={() => navigate("/login")}
            style={{ background: "none", border: "none", padding: 0, color: AZUL, fontWeight: 700, cursor: "pointer", fontSize: "13px" }}
          >
            Entrar na conta
          </button>
        </p>
      </div>
    </div>
  );
}
