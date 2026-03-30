import { useNavigate } from "react-router-dom";
import { useState } from "react";
import TutorialButton, { TSection, TStep, TBullet } from "@/components/TutorialButton";
import {
  ArrowLeft,
  Eye,
  Package,
  UserCheck,
  DoorOpen,
  Clock,
  Search,
  Mail,
  ShieldCheck,
  Camera,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

/* ═══ Mock data — Espelho da Portaria (somente visualização) ═══ */

const mockCorrespondencias = [
  { id: 1, morador: "João Silva - Apt 101 Bloco A", tipo: "Encomenda", origem: "Mercado Livre", dataRecebimento: "24/02/2026 09:15", status: "Aguardando retirada" },
  { id: 2, morador: "Maria Santos - Apt 302 Bloco B", tipo: "Carta registrada", origem: "Correios", dataRecebimento: "24/02/2026 10:30", status: "Retirada" },
  { id: 3, morador: "Carlos Oliveira - Apt 205 Bloco A", tipo: "Encomenda", origem: "Amazon", dataRecebimento: "23/02/2026 14:20", status: "Aguardando retirada" },
  { id: 4, morador: "Ana Pereira - Apt 401 Bloco C", tipo: "Documento", origem: "Banco do Brasil", dataRecebimento: "23/02/2026 11:00", status: "Retirada" },
  { id: 5, morador: "Pedro Costa - Apt 103 Bloco D", tipo: "Encomenda", origem: "Shopee", dataRecebimento: "22/02/2026 16:45", status: "Aguardando retirada" },
];

const mockAutorizacoes = [
  { id: 1, morador: "João Silva - Apt 101 Bloco A", visitante: "Ricardo Mendes", tipo: "Visita", dataAutorizacao: "24/02/2026", horario: "14:00 - 18:00", status: "Ativa" },
  { id: 2, morador: "Maria Santos - Apt 302 Bloco B", visitante: "Empresa CleanMax", tipo: "Prestador de serviço", dataAutorizacao: "24/02/2026", horario: "08:00 - 12:00", status: "Ativa" },
  { id: 3, morador: "Ana Pereira - Apt 401 Bloco C", visitante: "Dr. Paulo Ribeiro", tipo: "Visita", dataAutorizacao: "25/02/2026", horario: "10:00 - 11:00", status: "Pendente" },
  { id: 4, morador: "Carlos Oliveira - Apt 205 Bloco A", visitante: "Mudança Express", tipo: "Prestador de serviço", dataAutorizacao: "26/02/2026", horario: "07:00 - 17:00", status: "Pendente" },
];

const mockControleAcesso = [
  { id: 1, pessoa: "Ricardo Mendes", tipo: "Visitante", destino: "Apt 101 Bloco A", entrada: "24/02/2026 14:05", saida: "24/02/2026 17:30" },
  { id: 2, pessoa: "Entregador iFood", tipo: "Delivery", destino: "Apt 302 Bloco B", entrada: "24/02/2026 12:20", saida: "24/02/2026 12:25" },
  { id: 3, pessoa: "CleanMax - José", tipo: "Prestador", destino: "Apt 302 Bloco B", entrada: "24/02/2026 08:10", saida: "24/02/2026 11:50" },
  { id: 4, pessoa: "Entregador Correios", tipo: "Delivery", destino: "Portaria", entrada: "24/02/2026 10:30", saida: "24/02/2026 10:35" },
  { id: 5, pessoa: "Maria Santos", tipo: "Morador", destino: "Apt 302 Bloco B", entrada: "24/02/2026 07:00", saida: "—" },
  { id: 6, pessoa: "João Silva", tipo: "Morador", destino: "Apt 101 Bloco A", entrada: "24/02/2026 06:30", saida: "24/02/2026 08:00" },
];

type Tab = "correspondencias" | "autorizacoes" | "acesso";

const statusStyle: Record<string, { bg: string; text: string }> = {
  "Aguardando retirada": { bg: "#fef3c7", text: "#92400e" },
  "Retirada": { bg: "#d1fae5", text: "#065f46" },
  "Ativa": { bg: "#e8e9ef", text: "#2d3354" },
  "Pendente": { bg: "#fef3c7", text: "#92400e" },
};

const tipoAcessoStyle: Record<string, { bg: string; text: string }> = {
  "Visitante": { bg: "#e8e9ef", text: "#2d3354" },
  "Delivery": { bg: "#fce7f3", text: "#9d174d" },
  "Prestador": { bg: "#e0e7ff", text: "#3730a3" },
  "Morador": { bg: "#d1fae5", text: "#065f46" },
};

export default function EspelhoPortaria() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("correspondencias");
  const [search, setSearch] = useState("");

  const tabs: { key: Tab; label: string; icon: typeof Package; count: number }[] = [
    { key: "correspondencias", label: "Correspondências", icon: Package, count: mockCorrespondencias.filter(c => c.status === "Aguardando retirada").length },
    { key: "autorizacoes", label: "Autorizações", icon: UserCheck, count: mockAutorizacoes.filter(a => a.status === "Ativa" || a.status === "Pendente").length },
    { key: "acesso", label: "Controle de Acesso", icon: DoorOpen, count: mockControleAcesso.length },
  ];

  const filteredCorrespondencias = mockCorrespondencias.filter(c =>
    c.morador.toLowerCase().includes(search.toLowerCase()) ||
    c.tipo.toLowerCase().includes(search.toLowerCase()) ||
    c.origem.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAutorizacoes = mockAutorizacoes.filter(a =>
    a.morador.toLowerCase().includes(search.toLowerCase()) ||
    a.visitante.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAcesso = mockControleAcesso.filter(a =>
    a.pessoa.toLowerCase().includes(search.toLowerCase()) ||
    a.destino.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, color: p.text }}>
        <div style={{ padding: "0 24px", height: "4.5rem", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/dashboard")} style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Eye className="w-5 h-5" />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Espelho da Portaria</span>
          <div className="flex-1" />
          <TutorialButton title="Espelho da Portaria">
            <TSection icon={<span>📋</span>} title="O QUE E ESTA FUNCAO?">
              <p>Tela de <strong>monitoramento e consulta</strong> para sindicos e administradoras acompanharem <strong>tudo que acontece na portaria em tempo real</strong>. E uma visao completa e consolidada de correspondencias, autorizacoes, visitantes, veiculos, deliveries e registros do livro de protocolo — tudo em um so lugar.</p>
            </TSection>
            <TSection icon={<span>👁️</span>} title="O QUE VOCE CONSEGUE VER">
              <TBullet><strong>Correspondencias</strong> — Todas as encomendas e cartas recebidas, com status (aguardando/retirada)</TBullet>
              <TBullet><strong>Autorizacoes</strong> — Visitantes pre-autorizados pelos moradores, com status (ativa/expirada/utilizada)</TBullet>
              <TBullet><strong>Visitantes</strong> — Registro completo de todas as entradas com nome, foto, morador visitado e horario</TBullet>
              <TBullet><strong>Veiculos</strong> — Movimentacao de veiculos com placa, modelo, tipo e horarios de entrada/saida</TBullet>
              <TBullet><strong>Deliveries</strong> — Entregas recebidas na portaria com tipo, origem e status</TBullet>
              <TBullet><strong>Livro de Protocolo</strong> — Registros oficiais com assinaturas e fotos</TBullet>
            </TSection>
            <TSection icon={<span>🔧</span>} title="COMO USAR">
              <TStep n={1}>Selecione a <strong>aba desejada</strong> no topo da tela (Correspondencias, Autorizacoes, Visitantes, etc.)</TStep>
              <TStep n={2}>Use a <strong>barra de busca</strong> para encontrar registros especificos</TStep>
              <TStep n={3}>Use os <strong>filtros de data</strong> para ver registros de periodos especificos</TStep>
              <TStep n={4}>Toque em um registro para ver os <strong>detalhes completos</strong> (fotos, dados, horarios)</TStep>
              <TStep n={5}>Gere <strong>relatorios PDF</strong> por periodo quando necessario</TStep>
            </TSection>
            <TSection icon={<span>⚠️</span>} title="IMPORTANTE">
              <TBullet>Esta tela e <strong>somente para consulta</strong> — nao e possivel editar, excluir ou criar registros</TBullet>
              <TBullet>Os registros sao criados <strong>automaticamente</strong> pelas acoes dos porteiros e moradores</TBullet>
              <TBullet>Os dados sao <strong>atualizados em tempo real</strong> — nao precisa atualizar a pagina</TBullet>
              <TBullet>Ideal para <strong>sindicos que querem acompanhar</strong> o trabalho da portaria remotamente</TBullet>
              <TBullet>Use os <strong>relatorios PDF</strong> para apresentar em reunioes de condominio</TBullet>
            </TSection>
          </TutorialButton>
          <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Somente visualização</span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-border" style={{ marginTop: "0.5cm", background: p.cardBg }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearch(""); }}
              className="flex-1 flex items-center justify-center gap-2 py-4 text-base font-semibold transition-colors relative"
              style={{
                color: isActive ? "#ffffff" : p.textAccent,
                backgroundColor: isActive ? p.accent : p.cardBg,
                borderBottom: isActive ? "3px solid " + p.accent : "3px solid transparent",
              }}
            >
              <Icon className="w-6 h-6" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span
                className="ml-1 text-sm font-bold"
                style={{
                  color: isActive ? "#ffffff" : p.textAccent,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ padding: "12px 24px" }}>
        <div className="flex items-center gap-2 h-10 rounded-lg" style={{ paddingLeft: "24px", paddingRight: "12px", background: "#ffffff", border: "1px solid #e2e8f0" }}>
          <Search className="w-4 h-4 shrink-0" style={{ color: "#64748b" }} />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{ color: "#111827" }}
          />
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 pb-6" style={{ paddingLeft: "24px", paddingRight: "24px", marginTop: "19px", display: "flex", flexDirection: "column", gap: "19px" }}>

        {/* ═══ Correspondências ═══ */}
        {activeTab === "correspondencias" && (
          <>
            {filteredCorrespondencias.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhuma correspondência encontrada.</p>
            ) : (
              filteredCorrespondencias.map((c) => {
                const st = statusStyle[c.status] || { bg: "#f3f4f6", text: "#374151" };
                return (
                  <div key={c.id} className="rounded-xl overflow-hidden" style={{ padding: "16px", background: "#ffffff" }}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ border: "2px solid " + p.accent }}>
                        <Package className="w-5 h-5" style={{ color: p.accent }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: "#111827" }}>{c.morador}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs" style={{ color: "#374151" }}>{c.tipo}</span>
                          <span style={{ color: "#374151" }}>·</span>
                          <span className="text-xs" style={{ color: "#374151" }}>{c.origem}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Clock className="w-3 h-3" style={{ color: "#374151" }} />
                          <span className="text-[11px]" style={{ color: "#374151" }}>{c.dataRecebimento}</span>
                        </div>
                      </div>
                      <span
                        className="text-[20px] font-semibold whitespace-nowrap"
                        style={{ color: st.text }}
                      >
                        {c.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ═══ Autorizações de Entrada ═══ */}
        {activeTab === "autorizacoes" && (
          <>
            {filteredAutorizacoes.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhuma autorização encontrada.</p>
            ) : (
              filteredAutorizacoes.map((a) => {
                const st = statusStyle[a.status] || { bg: "#f3f4f6", text: "#374151" };
                return (
                  <div key={a.id} className="rounded-xl overflow-hidden" style={{ padding: "16px", background: "#ffffff" }}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ border: "2px solid " + p.accent }}>
                        <UserCheck className="w-5 h-5" style={{ color: p.accent }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: "#111827" }}>{a.visitante}</p>
                        <p className="text-xs mt-0.5" style={{ color: "#374151" }}>{a.morador}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[11px] rounded px-1.5 py-0.5" style={{ color: "#374151" }}>{a.tipo}</span>
                          <span style={{ color: "#374151" }}>·</span>
                          <span className="text-[11px]" style={{ color: "#374151" }}>{a.dataAutorizacao}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3" style={{ color: "#374151" }} />
                          <span className="text-[11px]" style={{ color: "#374151" }}>{a.horario}</span>
                        </div>
                      </div>
                      <span
                        className="text-[20px] font-semibold whitespace-nowrap"
                        style={{ color: st.text }}
                      >
                        {a.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ═══ Controle de Acesso ═══ */}
        {activeTab === "acesso" && (
          <>
            {filteredAcesso.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum registro encontrado.</p>
            ) : (
              filteredAcesso.map((a) => {
                const st = tipoAcessoStyle[a.tipo] || { bg: "#f3f4f6", text: "#374151" };
                return (
                  <div key={a.id} className="rounded-xl overflow-hidden" style={{ padding: "16px", background: "#ffffff" }}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ border: "2px solid " + p.accent }}>
                        <DoorOpen className="w-5 h-5" style={{ color: p.accent }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium" style={{ color: "#111827" }}>{a.pessoa}</p>
                          <span
                            className="text-[20px] font-semibold"
                            style={{ color: st.text }}
                          >
                            {a.tipo}
                          </span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "#374151" }}>{a.destino}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[20px] font-semibold" style={{ color: "#16a34a" }}>↓ Entrada</span>
                            <span className="text-[11px]" style={{ color: "#374151" }}>{a.entrada}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[20px] font-semibold" style={{ color: "#dc2626" }}>↑ Saída</span>
                            <span className="text-[11px]" style={{ color: "#374151" }}>{a.saida}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </main>
    </div>
  );
}
