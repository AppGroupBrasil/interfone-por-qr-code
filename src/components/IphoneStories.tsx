import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell, ChevronLeft, ChevronRight, CircleCheck, Compass,
  Home, Pause, Play, Share, Smartphone, SquarePlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import InstalarAgora from "@/components/InstalarAgora";
import { AppLogo } from "@/components/AppLogo";

/* ═══════════════════════════════════════════════
   INSTALAR NO IPHONE — passo a passo em Stories
   ═══════════════════════════════════════════════ */

type Passo = {
  titulo: string;
  texto: string;
  dica: string;
  icone: LucideIcon;
  cor: string;
};

const PASSOS: Passo[] = [
  {
    titulo: "Abra pelo Safari",
    texto: "Entre em appinterfone.com.br usando o Safari.",
    dica: "No iPhone, só o Safari instala. Chrome e Firefox não.",
    icone: Compass, cor: "#0a84ff",
  },
  {
    titulo: "Toque em Compartilhar",
    texto: "É o quadradinho com a seta para cima, na barra de baixo.",
    dica: "Não aparece? Toque uma vez na tela que a barra volta.",
    icone: Share, cor: "#5e5ce6",
  },
  {
    titulo: "Adicionar à Tela de Início",
    texto: "Role o menu, toque nessa opção e confirme em Adicionar.",
    dica: "Fica no canto superior direito da tela.",
    icone: SquarePlus, cor: "#ff9f0a",
  },
  {
    titulo: "Use pelo ícone novo",
    texto: "O App Interfone aparece junto com seus outros aplicativos.",
    dica: "Abra sempre por ele. Pelo Safari a chamada não toca.",
    icone: Home, cor: "#30d158",
  },
  {
    titulo: "Toque em Permitir",
    texto: "Faça login e libere as notificações do aplicativo.",
    dica: "É isso que faz a chamada chegar com o app fechado.",
    icone: Bell, cor: "#ff375f",
  },
  {
    titulo: "Pronto para receber visita",
    texto: "O visitante escaneia o QR Code e a chamada cai no seu iPhone.",
    dica: "Vídeo e áudio, sem interfone e sem App Store.",
    icone: CircleCheck, cor: "#0a84ff",
  },
];

const DURACAO_MS = 6500;

interface Props {
  mode: "dark" | "light";
}

export default function IphoneStories({ mode }: Props) {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [visivel, setVisivel] = useState(false);
  const telaRef = useRef<HTMLDivElement>(null);

  const passo = PASSOS[indice];
  const Icone = passo.icone;
  const rodando = visivel && !pausado;

  const avancar = useCallback(() => setIndice((i) => (i + 1) % PASSOS.length), []);
  const voltar = useCallback(() => setIndice((i) => (i - 1 + PASSOS.length) % PASSOS.length), []);

  // Story parado enquanto ninguém está olhando: nada de rodar fora da tela.
  useEffect(() => {
    const el = telaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setVisivel(true); return; }
    const obs = new IntersectionObserver(([e]) => setVisivel(e.isIntersecting), { threshold: 0.25 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); avancar(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); voltar(); }
  };

  const corTexto = mode === "dark" ? "#e2e8f0" : "#003580";
  const corSuave = mode === "dark" ? "#94a3b8" : "#336699";
  const corCard = mode === "dark" ? "rgba(0,40,100,0.55)" : "#ffffff";
  const corBorda = mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,53,128,0.18)";

  return (
    <section
      aria-labelledby="iphone-stories-titulo"
      style={{
        background: mode === "dark"
          ? "linear-gradient(180deg, #004aad 0%, #00306e 45%, #001c42 100%)"
          : "linear-gradient(180deg, #f4f7fc 0%, #ffffff 100%)",
        padding: "64px 24px 72px",
        borderTop: `1px solid ${corBorda}`,
        borderBottom: `1px solid ${corBorda}`,
        transition: "background 0.4s",
      }}
    >
      <style>{`
        @keyframes ifsFill { from { width: 0%; } to { width: 100%; } }
        @keyframes ifsSlideIn { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes ifsGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.18); } 50% { box-shadow: 0 0 0 14px rgba(255,255,255,0); } }
        .ifs-wrap { max-width: 1080px; margin: 0 auto; display: flex; align-items: center; justify-content: center; gap: 56px; flex-wrap: wrap; }
        .ifs-col { flex: 1 1 340px; min-width: 280px; max-width: 460px; }
        .ifs-phone { flex: 0 0 auto; width: 300px; }
        .ifs-screen { position: relative; width: 100%; aspect-ratio: 9 / 18.5; border-radius: 40px; overflow: hidden; }
        .ifs-slide { animation: ifsSlideIn 0.45s ease-out both; }
        .ifs-chip { cursor: pointer; border: none; font-family: inherit; }
        .ifs-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
        @media (max-width: 900px) {
          .ifs-wrap { gap: 36px; }
          .ifs-col { text-align: center; max-width: 520px; }
          .ifs-col-lista { justify-content: center; }
        }
        @media (max-width: 420px) {
          .ifs-phone { width: min(300px, 82vw); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ifs-slide { animation: none; }
        }
      `}</style>

      <div className="ifs-wrap">

        {/* ─── Texto ─── */}
        <div className="ifs-col">
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "linear-gradient(135deg, #0a84ff, #5e5ce6)",
            color: "#ffffff", borderRadius: "999px", padding: "7px 16px",
            fontSize: "13px", fontWeight: 800, letterSpacing: "0.3px", marginBottom: "18px",
          }}>
            <Smartphone style={{ width: "16px", height: "16px" }} /> TEM IPHONE? COMECE POR AQUI
          </div>

          <h2 id="iphone-stories-titulo" style={{
            fontSize: "clamp(1.6rem, 3.4vw, 2.4rem)", fontWeight: 900, lineHeight: 1.15,
            color: corTexto, marginBottom: "14px",
          }}>
            Instale no iPhone em 1 minuto
          </h2>

          <p style={{ fontSize: "16px", lineHeight: 1.7, color: corSuave, marginBottom: "22px" }}>
            Não existe App Interfone na App Store — e não precisa. O site vira um aplicativo
            de verdade na tela do seu iPhone, com ícone próprio e notificação de chamada.
          </p>

          <div className="ifs-col-lista" style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "22px" }}>
            {["Sem App Store", "Sem custo", "Funciona com o app fechado"].map((b) => (
              <span key={b} style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                background: corCard, border: `1px solid ${corBorda}`, borderRadius: "10px",
                padding: "8px 14px", fontSize: "13px", fontWeight: 600, color: corTexto,
              }}>
                <CircleCheck style={{ width: "15px", height: "15px", color: "#30d158" }} /> {b}
              </span>
            ))}
          </div>

          <div className="ifs-col-lista" style={{ display: "flex", marginBottom: "22px" }}>
            <InstalarAgora mode={mode} />
          </div>

          <div style={{
            background: corCard, border: `1px solid ${corBorda}`, borderLeft: "4px solid #ff9f0a",
            borderRadius: "12px", padding: "14px 16px",
          }}>
            <p style={{ fontSize: "13.5px", lineHeight: 1.6, color: corSuave }}>
              <strong style={{ color: corTexto }}>Precisa de iOS 16.4 ou mais novo.</strong>{" "}
              Toque nos cards para ver cada passo — igual aos Stories.
            </p>
          </div>
        </div>

        {/* ─── Stories ─── */}
        <div className="ifs-phone">
          <div
            ref={telaRef}
            onKeyDown={onKeyDown}
            role="group"
            aria-label="Passo a passo para instalar no iPhone"
            style={{
              position: "relative", padding: "10px", borderRadius: "50px",
              background: "linear-gradient(160deg, #3a3a3c 0%, #0b0b0d 40%, #1c1c1e 100%)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          >
            <div className="ifs-screen" style={{
              background: `linear-gradient(165deg, ${passo.cor} 0%, #14213d 58%, #0a0a0c 100%)`,
            }}>

              {/* Dynamic island */}
              <div style={{
                position: "absolute", top: "10px", left: "50%", transform: "translateX(-50%)",
                width: "88px", height: "24px", borderRadius: "14px", background: "#000000", zIndex: 5,
              }} />

              {/* Barras de progresso */}
              <div style={{
                position: "absolute", top: "44px", left: "0", right: "0", zIndex: 4,
                display: "flex", gap: "4px", padding: "0 14px",
              }} aria-hidden="true">
                {PASSOS.map((p, i) => (
                  <div key={p.titulo} style={{
                    flex: 1, height: "3px", borderRadius: "2px",
                    background: "rgba(255,255,255,0.28)", overflow: "hidden",
                  }}>
                    <div
                      key={i === indice ? `ativo-${indice}` : `estatico-${i}`}
                      onAnimationEnd={i === indice ? avancar : undefined}
                      style={{
                        height: "100%", borderRadius: "2px", background: "#ffffff",
                        width: i < indice ? "100%" : "0%",
                        ...(i === indice
                          ? {
                              animation: `ifsFill ${DURACAO_MS}ms linear forwards`,
                              animationPlayState: rodando ? "running" : "paused",
                            }
                          : {}),
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Cabeçalho */}
              <div style={{
                position: "absolute", top: "58px", left: "0", right: "0", zIndex: 4,
                display: "flex", alignItems: "center", gap: "9px", padding: "0 14px",
              }}>
                <AppLogo size={30} rounded={9} border="1.5px solid rgba(255,255,255,0.7)" objectFit="cover" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "12.5px", fontWeight: 800, color: "#ffffff", lineHeight: 1.2 }}>App Interfone</p>
                  <p style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.65)" }}>Passo {indice + 1} de {PASSOS.length}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPausado((p) => !p)}
                  aria-label={pausado ? "Retomar" : "Pausar"}
                  style={{
                    width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
                    background: "rgba(255,255,255,0.16)", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {pausado
                    ? <Play style={{ width: "13px", height: "13px", color: "#ffffff" }} />
                    : <Pause style={{ width: "13px", height: "13px", color: "#ffffff" }} />}
                </button>
              </div>

              {/* Conteúdo do passo */}
              <div key={indice} className="ifs-slide" style={{
                position: "absolute", inset: "0", zIndex: 2,
                display: "flex", flexDirection: "column", justifyContent: "center",
                padding: "0 26px", textAlign: "center",
              }}>
                <span aria-hidden="true" style={{
                  position: "absolute", right: "14px", bottom: "56px",
                  fontSize: "130px", fontWeight: 900, lineHeight: 1,
                  color: "rgba(255,255,255,0.07)", pointerEvents: "none",
                }}>
                  {indice + 1}
                </span>

                <div style={{
                  width: "72px", height: "72px", borderRadius: "22px", margin: "0 auto 22px",
                  background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  animation: "ifsGlow 2.4s ease-out infinite",
                }}>
                  <Icone style={{ width: "34px", height: "34px", color: "#ffffff" }} />
                </div>

                <h3 style={{ fontSize: "21px", fontWeight: 900, color: "#ffffff", lineHeight: 1.25, marginBottom: "12px" }}>
                  {passo.titulo}
                </h3>
                <p style={{ fontSize: "14.5px", lineHeight: 1.6, color: "rgba(255,255,255,0.92)", marginBottom: "16px" }}>
                  {passo.texto}
                </p>
                <p style={{
                  fontSize: "12.5px", lineHeight: 1.5, color: "rgba(255,255,255,0.75)",
                  background: "rgba(0,0,0,0.28)", borderRadius: "10px", padding: "9px 12px",
                }}>
                  {passo.dica}
                </p>
              </div>

              {/* Zonas de toque, como no Instagram */}
              <button
                type="button" onClick={voltar} aria-label="Passo anterior"
                style={{ position: "absolute", inset: "0 65% 44px 0", zIndex: 3, background: "transparent", border: "none", cursor: "pointer" }}
              />
              <button
                type="button" onClick={avancar} aria-label="Próximo passo"
                style={{ position: "absolute", inset: "0 0 44px 35%", zIndex: 3, background: "transparent", border: "none", cursor: "pointer" }}
              />

              <p aria-hidden="true" style={{
                position: "absolute", bottom: "14px", left: "0", right: "0", zIndex: 2,
                textAlign: "center", fontSize: "11px", color: "rgba(255,255,255,0.55)",
              }}>
                toque para avançar
              </p>
            </div>
          </div>

          {/* Navegação abaixo do aparelho */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginTop: "18px" }}>
            <button
              type="button" onClick={voltar} aria-label="Passo anterior"
              style={{
                width: "34px", height: "34px", borderRadius: "50%", cursor: "pointer",
                background: corCard, border: `1px solid ${corBorda}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <ChevronLeft style={{ width: "17px", height: "17px", color: corTexto }} />
            </button>

            {PASSOS.map((p, i) => (
              <button
                key={p.titulo}
                type="button"
                className="ifs-chip"
                onClick={() => setIndice(i)}
                aria-label={`Passo ${i + 1}: ${p.titulo}`}
                aria-current={i === indice}
                style={{
                  width: i === indice ? "24px" : "9px", height: "9px", borderRadius: "6px",
                  background: i === indice ? passo.cor : mode === "dark" ? "rgba(255,255,255,0.3)" : "rgba(0,53,128,0.25)",
                  transition: "width 0.25s, background 0.25s", padding: 0,
                }}
              />
            ))}

            <button
              type="button" onClick={avancar} aria-label="Próximo passo"
              style={{
                width: "34px", height: "34px", borderRadius: "50%", cursor: "pointer",
                background: corCard, border: `1px solid ${corBorda}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <ChevronRight style={{ width: "17px", height: "17px", color: corTexto }} />
            </button>
          </div>

          {/* Mesmo conteúdo, em texto corrido, para leitor de tela e busca */}
          <ol className="ifs-sr">
            {PASSOS.map((p) => (
              <li key={p.titulo}>{p.titulo}. {p.texto} {p.dica}</li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
