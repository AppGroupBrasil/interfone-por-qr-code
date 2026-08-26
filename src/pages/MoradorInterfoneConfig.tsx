import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import TutorialButton, { TSection, TStep, TBullet } from "@/components/TutorialButton";
import {
  ArrowLeft,
  Phone,
  Shield,
  ShieldCheck,
  ShieldAlert,
  User,
  Clock,
  Ban,
  Save,
  CheckCircle2,
  Info,
  Volume2,
  VolumeX,
  History,
  Settings,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";

const API = "/api";

interface InterfoneConfig {
  nivel_seguranca: number;
  nome_validacao: string;
  horario_silencioso_inicio: string | null;
  horario_silencioso_fim: string | null;
  bloqueados: string;
}

/* ═══════════════════════════════════════════════
   MORADOR — Configuração do Interfone Digital
   Níveis de segurança, horários silenciosos, etc.
   ═══════════════════════════════════════════════ */
export default function MoradorInterfoneConfig() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [config, setConfig] = useState<InterfoneConfig>({
    nivel_seguranca: 1,
    nome_validacao: user?.name || "",
    horario_silencioso_inicio: null,
    horario_silencioso_fim: null,
    bloqueados: "[]",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [silenciosoEnabled, setSilenciosoEnabled] = useState(false);
  const [newBloqueado, setNewBloqueado] = useState("");

  useEffect(() => {
    apiFetch(`${API}/interfone/config`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.nivel_seguranca) {
          setConfig(data);
          setSilenciosoEnabled(!!(data.horario_silencioso_inicio && data.horario_silencioso_fim));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const body = {
        ...config,
        horario_silencioso_inicio: silenciosoEnabled ? config.horario_silencioso_inicio : null,
        horario_silencioso_fim: silenciosoEnabled ? config.horario_silencioso_fim : null,
      };
      const res = await apiFetch(`${API}/interfone/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao salvar.");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch { setError("Erro de conexão."); }
    setSaving(false);
  };

  const bloqueados: string[] = (() => {
    try { return JSON.parse(config.bloqueados || "[]"); } catch { return []; }
  })();

  const addBloqueado = () => {
    if (!newBloqueado.trim()) return;
    const updated = [...bloqueados, newBloqueado.trim()];
    setConfig({ ...config, bloqueados: JSON.stringify(updated) });
    setNewBloqueado("");
  };

  const removeBloqueado = (idx: number) => {
    const updated = bloqueados.filter((_, i) => i !== idx);
    setConfig({ ...config, bloqueados: JSON.stringify(updated) });
  };

  const securityLevels = [
    {
      level: 1,
      icon: Shield,
      title: "Ligação Direta",
      desc: "Visitante liga sem nenhuma verificação. Mais rápido e prático.",
      color: "#10b981",
    },
    {
      level: 2,
      icon: ShieldCheck,
      title: "Confirmar Nome",
      desc: "Visitante precisa digitar seu nome para poder ligar. Evita ligações aleatórias.",
      color: "#f59e0b",
    },
    {
      level: 3,
      icon: ShieldAlert,
      title: "Autorização Completa",
      desc: "Visitante envia nome, empresa e foto. Você analisa e decide se aceita ou recusa.",
      color: "#ef4444",
    },
  ];

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: isDark ? "linear-gradient(180deg, #001533 0%, #002254 25%, #003580 55%, #004aad 100%)" : "#f0f4f8", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: isDark ? "linear-gradient(180deg, #001533 0%, #002254 25%, #003580 55%, #004aad 100%)" : "#f0f4f8", display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ background: isDark ? "linear-gradient(135deg, #001533 0%, #002a66 50%, #004aad 100%)" : "#ffffff", borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : "1px solid #e2e8f0", boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : "0 2px 8px rgba(0,0,0,0.06)", padding: '36px 48px' }}>
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(-1)} style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f8fafc', border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #cbd5e1', borderRadius: 14, padding: 10, color: isDark ? '#fff' : "#1e293b", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft className="w-7 h-7" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 className="font-bold flex items-center gap-4" style={{ fontSize: '22px', color: isDark ? '#fff' : "#1e293b" }}>
              <div style={{ width: 40, height: 40, borderRadius: 14, background: isDark ? 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))' : 'linear-gradient(135deg, #e2e8f0, #f1f5f9)', border: isDark ? '1.5px solid rgba(255,255,255,0.2)' : '1.5px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Phone className="w-5 h-5" style={{ color: isDark ? '#fff' : "#1e293b" }} />
              </div>
              Meu Interfone
            </h1>
            <p style={{ fontSize: '15px', marginTop: '6px', color: isDark ? '#93c5fd' : "#64748b" }}>Configure como deseja receber chamadas</p>
          </div>
          <TutorialButton title="Meu Interfone">
            <TSection icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
              <p>Configure como você deseja <strong>receber chamadas de visitantes</strong> pelo Interfone Digital. Escolha o nível de segurança, defina horários silenciosos e bloqueie pessoas indesejadas.</p>
            </TSection>
            <TSection icon={<span>🛡️</span>} title="NÍVEIS DE SEGURANÇA">
              <TStep n={1}><strong>Nível 1 — Ligação Direta:</strong> O visitante seleciona seu apartamento e liga imediatamente. Sem nenhuma verificação. Ideal para quem prefere praticidade.</TStep>
              <TStep n={2}><strong>Nível 2 — Verificação por Nome:</strong> O visitante precisa digitar o <strong>seu nome corretamente</strong> antes de conseguir ligar. O sistema aceita variações (maiúscula, minúscula, com ou sem acento). Bom equilíbrio entre segurança e praticidade.</TStep>
              <TStep n={3}><strong>Nível 3 — Autorização Completa:</strong> O visitante precisa informar <strong>nome, empresa e tirar uma foto</strong>. Você recebe tudo isso no app e decide se <strong>autoriza ou recusa</strong> antes da chamada iniciar. Máxima segurança.</TStep>
              <p style={{ marginTop: "8px", fontSize: "13px", color: "#1e40af" }}>👉 <strong>Recomendação:</strong> Nível 2 é o mais usado — simples pro visitante e seguro pra você.</p>
            </TSection>
            <TSection icon={<span>🌙</span>} title="HORÁRIO SILENCIOSO">
              <TBullet>Ative o <strong>horário silencioso</strong> para não receber chamadas em determinados horários</TBullet>
              <TBullet>Defina o <strong>horário de início</strong> e <strong>horário de fim</strong> (ex: 22:00 às 07:00)</TBullet>
              <TBullet>Durante o período silencioso, visitantes veem a mensagem <strong>"Morador indisponível no momento"</strong></TBullet>
              <TBullet>Ideal para <strong>noites, madrugadas e horários de descanso</strong></TBullet>
              <p style={{ marginTop: "8px", fontSize: "13px", color: "#1e40af" }}>👉 <strong>Dica:</strong> O horário silencioso funciona automaticamente — você não precisa ativar e desativar todo dia.</p>
            </TSection>
            <TSection icon={<span>🚫</span>} title="LISTA DE BLOQUEADOS">
              <TBullet>Adicione nomes de pessoas que você <strong>não quer receber chamadas</strong></TBullet>
              <TBullet>Se o visitante informar um nome bloqueado, a chamada é <strong>automaticamente recusada</strong></TBullet>
              <TBullet>Você pode <strong>adicionar e remover</strong> nomes da lista a qualquer momento</TBullet>
              <TBullet>Funciona nos <strong>3 níveis de segurança</strong></TBullet>
            </TSection>
            <TSection icon={<span>📱</span>} title="COMO FUNCIONA NA PRÁTICA">
              <TStep n={1}>Visitante chega no bloco e <strong>escaneia o QR Code</strong></TStep>
              <TStep n={2}>Seleciona seu <strong>apartamento</strong> na lista</TStep>
              <TStep n={3}>Passa pelo <strong>nível de segurança</strong> que você configurou</TStep>
              <TStep n={4}>Você recebe a <strong>chamada no app</strong> com toque sonoro</TStep>
              <TStep n={5}>Você vê o <strong>vídeo do visitante</strong> (ele só ouve sua voz)</TStep>
              <TStep n={6}>Pode <strong>atender</strong> ou <strong>recusar</strong> a chamada</TStep>
            </TSection>
            <TSection icon={<span>⭐</span>} title="DICAS IMPORTANTES">
              <TBullet>Mantenha o <strong>app aberto</strong> ou em segundo plano para receber chamadas</TBullet>
              <TBullet>No nível 2, seu nome pode ser configurado — coloque como os visitantes te conhecem</TBullet>
              <TBullet>Acesse o <strong>histórico de chamadas</strong> para ver quem ligou e quando</TBullet>
              <TBullet>Todas as chamadas ficam <strong>registradas</strong> mesmo que você não atenda</TBullet>
              <TBullet>O interfone funciona no <strong>navegador do celular</strong> — sem precisar instalar nada pro visitante</TBullet>
              <TBullet>Visitantes têm acesso ao botão <strong>PORTARIA</strong> para ligar direto para o porteiro — essas chamadas <strong>vão para o funcionário</strong>, não para você</TBullet>
            </TSection>
          </TutorialButton>
        </div>
      </header>

      <main className="flex-1 pb-16" style={{ maxWidth: 800, margin: "0 auto", width: "100%", padding: "24px 24px 48px" }}>
        {/* Success */}
        {saved && (
          <div className="flex items-center gap-4 rounded-xl" style={{ background: isDark ? 'rgba(34,197,94,0.1)' : '#f0fdf4', border: isDark ? '1px solid rgba(34,197,94,0.3)' : '1px solid #bbf7d0', padding: '18px', marginBottom: '24px' }}>
            <CheckCircle2 className="w-5 h-5" style={{ color: isDark ? '#4ade80' : '#16a34a' }} />
            <span className="font-medium" style={{ fontSize: '17px', color: isDark ? '#4ade80' : '#16a34a' }}>Configurações salvas!</span>
          </div>
        )}

        {/* Security Level */}
        <section style={{ marginBottom: '54px' }}>
          <h2 className="font-bold flex items-center" style={{ color: isDark ? '#93c5fd' : "#64748b", fontSize: '18px', marginBottom: '18px', gap: '12px' }}>
            <Shield className="w-5 h-5" /> Nível de Segurança
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {securityLevels.map((sl) => {
              const Icon = sl.icon;
              const selected = config.nivel_seguranca === sl.level;
              return (
                <button
                  key={sl.level}
                  onClick={() => setConfig({ ...config, nivel_seguranca: sl.level })}
                  className="w-full flex items-start rounded-xl text-left transition-all"
                  style={{
                    background: selected 
                      ? (isDark ? 'rgba(59,130,246,0.2)' : '#dbeafe') 
                      : (isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc'),
                    border: `2px solid ${selected 
                      ? (isDark ? 'rgba(59,130,246,0.5)' : '#60a5fa') 
                      : (isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1')}`,
                    color: isDark ? '#fff' : "#1e293b",
                    padding: '24px',
                    gap: '18px',
                    position: 'relative',
                  }}
                >
                  {selected && (
                    <div style={{ position: 'absolute', top: 12, right: 12 }}>
                      <CheckCircle2 style={{ width: 22, height: 22, color: '#22c55e' }} />
                    </div>
                  )}
                  <div
                    className="rounded-lg flex items-center justify-center shrink-0"
                    style={{ width: '44px', height: '44px', background: selected ? (isDark ? 'rgba(255,255,255,0.15)' : '#ffffff') : `${sl.color}25`, borderRadius: 14 }}
                  >
                    <Icon style={{ width: '22px', height: '22px', color: selected ? (isDark ? '#fff' : '#2563eb') : sl.color }} />
                  </div>
                  <div>
                    <div className="flex items-center" style={{ gap: '12px' }}>
                      <h3 className="font-bold" style={{ fontSize: '17px', color: isDark ? '#fff' : "#1e293b" }}>{sl.title}</h3>
                      <span
                        className="rounded-full font-bold"
                        style={{
                          fontSize: '12px',
                          padding: '4px 12px',
                          background: selected ? (isDark ? 'rgba(255,255,255,0.2)' : '#ffffff') : `${sl.color}25`,
                          color: selected ? (isDark ? '#fff' : '#2563eb') : sl.color,
                        }}
                      >
                        NÍVEL {sl.level}
                      </span>
                    </div>
                    <p style={{ fontSize: '15px', marginTop: '6px', color: selected ? (isDark ? 'rgba(255,255,255,0.7)' : '#334155') : (isDark ? '#93c5fd' : '#475569') }}>
                      {sl.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Level 2 - Name validation */}
        {config.nivel_seguranca === 2 && (
          <section className="rounded-xl" style={{ background: isDark ? 'rgba(245,158,11,0.1)' : '#fef3c7', border: isDark ? '1px solid rgba(245,158,11,0.3)' : '1px solid #fde68a', padding: '24px', marginBottom: '54px' }}>
            <h2 className="font-bold flex items-center" style={{ color: isDark ? '#fbbf24' : '#d97706', fontSize: '18px', marginBottom: '12px', gap: '12px' }}>
              <User className="w-5 h-5" /> Nome para Validação
            </h2>
            <p style={{ fontSize: '15px', marginBottom: '18px', color: isDark ? '#fcd34d' : '#92400e' }}>
              O visitante precisará digitar este nome para poder ligar:
            </p>
            <input
              type="text"
              value={config.nome_validacao}
              onChange={(e) => setConfig({ ...config, nome_validacao: e.target.value })}
              placeholder="Seu nome ou apelido"
              className="w-full rounded-lg"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff', border: isDark ? '1px solid rgba(245,158,11,0.3)' : '1px solid #fcd34d', fontSize: '17px', padding: '16px 24px', color: isDark ? '#fff' : "#1e293b" }}
            />
            <p style={{ fontSize: '13px', marginTop: '12px', color: isDark ? '#fbbf24' : '#b45309' }}>
              Dica: Use seu primeiro nome para facilitar. A comparação ignora letras maiúsculas e acentos.
            </p>
          </section>
        )}

        {/* Silent hours */}
        <section style={{ marginBottom: '54px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '18px' }}>
            <h2 className="font-bold flex items-center" style={{ color: isDark ? '#93c5fd' : "#64748b", fontSize: '18px', gap: '12px' }}>
              <Clock className="w-5 h-5" /> Horário Silencioso
            </h2>
            <button
              onClick={() => setSilenciosoEnabled(!silenciosoEnabled)}
              className="flex items-center font-bold"
              style={{ color: silenciosoEnabled ? '#4ade80' : '#64748b', fontSize: '15px', gap: '9px', background: 'none', border: 'none' }}
            >
              {silenciosoEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              {silenciosoEnabled ? 'Ativo' : 'Desativado'}
            </button>
          </div>

          {silenciosoEnabled && (
            <div className="rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc', border: isDark ? '1.5px solid rgba(255,255,255,0.1)' : '1.5px solid #cbd5e1', padding: '24px' }}>
              <p style={{ fontSize: '15px', marginBottom: '18px', color: isDark ? '#93c5fd' : "#64748b" }}>
                Chamadas não serão recebidas durante este horário.
              </p>
              <div className="flex items-center" style={{ gap: '18px' }}>
                <div className="flex-1">
                  <label className="font-bold" style={{ fontSize: '13px', color: isDark ? '#93c5fd' : "#64748b" }}>De</label>
                  <input
                    type="time"
                    value={config.horario_silencioso_inicio || '22:00'}
                    onChange={(e) => setConfig({ ...config, horario_silencioso_inicio: e.target.value })}
                    className="w-full rounded-lg"
                    style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc', border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #cbd5e1', fontSize: '17px', padding: '12px 18px', marginTop: '6px', color: isDark ? '#fff' : "#1e293b", colorScheme: 'dark' }}
                  />
                </div>
                <span style={{ fontSize: '17px', marginTop: '24px', color: isDark ? '#7dd3fc' : '#475569' }}>até</span>
                <div className="flex-1">
                  <label className="font-bold" style={{ fontSize: '13px', color: isDark ? '#93c5fd' : "#64748b" }}>Até</label>
                  <input
                    type="time"
                    value={config.horario_silencioso_fim || '07:00'}
                    onChange={(e) => setConfig({ ...config, horario_silencioso_fim: e.target.value })}
                    className="w-full rounded-lg"
                    style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc', border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #cbd5e1', fontSize: '17px', padding: '12px 18px', marginTop: '6px', color: isDark ? '#fff' : "#1e293b", colorScheme: 'dark' }}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Blocked list */}
        <section style={{ marginBottom: '54px' }}>
          <h2 className="font-bold flex items-center" style={{ color: isDark ? '#93c5fd' : "#64748b", fontSize: '18px', marginBottom: '18px', gap: '12px' }}>
            <Ban className="w-5 h-5" /> Lista de Bloqueio
          </h2>
          <div className="rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc', border: isDark ? '1.5px solid rgba(255,255,255,0.1)' : '1.5px solid #cbd5e1', padding: '24px' }}>
            <p style={{ fontSize: '15px', marginBottom: '18px', color: isDark ? '#93c5fd' : "#64748b" }}>
              Nomes bloqueados não conseguirão iniciar chamada (Nível 3).
            </p>
            <div className="flex" style={{ gap: '12px', marginBottom: '18px', flexDirection: 'column' }}>
              <input
                type="text"
                value={newBloqueado}
                onChange={(e) => setNewBloqueado(e.target.value)}
                placeholder="Nome para bloquear"
                className="w-full rounded-lg"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc', border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #cbd5e1', fontSize: '17px', padding: '12px 18px', color: isDark ? '#fff' : "#1e293b" }}
                onKeyDown={(e) => e.key === 'Enter' && addBloqueado()}
              />
              <button
                onClick={addBloqueado}
                className="w-full rounded-lg font-bold"
                style={{ background: isDark ? 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(59,130,246,0.15))' : '#2563eb', border: isDark ? '1.5px solid rgba(59,130,246,0.4)' : '1px solid #1d4ed8', color: '#fff', fontSize: '15px', padding: '12px 18px' }}
              >
                Adicionar
              </button>
            </div>
            {bloqueados.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {bloqueados.map((nome, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #cbd5e1', padding: '12px 18px' }}>
                    <span style={{ fontSize: '17px', color: isDark ? '#fff' : "#1e293b" }}>{nome}</span>
                    <button onClick={() => removeBloqueado(i)} style={{ color: '#ef4444', fontWeight: 700, fontSize: '15px', background: 'none', border: 'none' }}>✕</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center" style={{ fontSize: '15px', color: isDark ? '#7dd3fc' : '#64748b' }}>Nenhum nome bloqueado</p>
            )}
          </div>
        </section>

        {/* Call history link */}
        <section style={{ marginBottom: '54px' }}>
          <button
            onClick={() => navigate('/morador/interfone-historico')}
            className="w-full flex items-center rounded-xl"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc', border: isDark ? '1.5px solid rgba(255,255,255,0.1)' : '1.5px solid #cbd5e1', padding: '24px', gap: '18px' }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 14, background: isDark ? 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))' : 'linear-gradient(135deg, #e2e8f0, #f1f5f9)', border: isDark ? '1.5px solid rgba(255,255,255,0.2)' : '1.5px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <History style={{ width: '22px', height: '22px', color: isDark ? '#93c5fd' : "#64748b" }} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold" style={{ color: isDark ? '#fff' : "#1e293b", fontSize: '17px' }}>Histórico de Chamadas</p>
              <p style={{ fontSize: '15px', color: isDark ? '#93c5fd' : "#64748b" }}>Ver chamadas recebidas pelo interfone</p>
            </div>
            <ArrowLeft className="rotate-180" style={{ width: '18px', height: '18px', color: isDark ? '#7dd3fc' : '#2563eb' }} />
          </button>
        </section>

        {/* Error */}
        {error && (
          <div className="rounded-xl" style={{ background: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2', border: isDark ? '1px solid rgba(239,68,68,0.3)' : '1px solid #fecaca', padding: '18px', marginBottom: '24px' }}>
            <p style={{ fontSize: '17px', color: isDark ? '#fca5a5' : '#dc2626' }}>{error}</p>
          </div>
        )}

        {/* Success */}
        {saved && (
          <div className="rounded-xl flex items-center gap-3" style={{ background: isDark ? 'rgba(34,197,94,0.1)' : '#f0fdf4', border: isDark ? '1px solid rgba(34,197,94,0.3)' : '1px solid #bbf7d0', padding: '18px', marginBottom: '24px' }}>
            <CheckCircle2 style={{ width: '20px', height: '20px', color: isDark ? '#4ade80' : '#16a34a', flexShrink: 0 }} />
            <p style={{ fontSize: '17px', color: isDark ? '#4ade80' : '#16a34a', fontWeight: 600, margin: 0 }}>Configuração salva com sucesso!</p>
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl font-bold flex items-center justify-center transition-all"
          style={{ background: isDark ? 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(59,130,246,0.15))' : '#2563eb', border: isDark ? '1.5px solid rgba(59,130,246,0.4)' : '1px solid #1d4ed8', color: '#fff', fontSize: '17px', padding: '21px 0', gap: '12px' }}
        >
          <Save className="w-5 h-5" />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </main>
    </div>
  );
}
