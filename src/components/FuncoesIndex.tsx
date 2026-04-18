import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import {
  ChevronDown,
  ChevronUp,
  List,
  Phone,
  Users2,
  Wrench,
  Layers,
  MessageCircle,
  BookOpen,
  Building2,
  FileText,
  Shield,
  BarChart3,
  UserPlus,
  Settings,
  type LucideIcon,
} from "lucide-react";

/* ── Role badge colors ── */
const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  morador:        { bg: "rgba(59,130,246,0.15)", text: "#60a5fa", label: "Morador" },
  funcionario:    { bg: "rgba(234,179,8,0.15)",  text: "#facc15", label: "Funcionário" },
  sindico:        { bg: "rgba(16,185,129,0.15)", text: "#34d399", label: "Síndico" },
  administradora: { bg: "rgba(168,85,247,0.15)", text: "#c084fc", label: "Administradora" },
  master:         { bg: "rgba(239,68,68,0.15)",  text: "#f87171", label: "Master" },
};

interface FuncaoItem {
  icon: LucideIcon;
  label: string;
  description: string;
  route: string;
  minRole: string;
}

/* ── Grouped by category ── */
interface FuncaoGroup {
  title: string;
  items: FuncaoItem[];
}

const ALL_FUNCOES: FuncaoGroup[] = [
  {
    title: "Morador",
    items: [
      { icon: Phone, label: "Interfone Digital", description: "Receber chamadas de visitantes com vídeo", route: "/morador/interfone-config", minRole: "morador" },
    ],
  },
  {
    title: "Portaria / Funcionário",
    items: [
      { icon: Phone, label: "Interfone", description: "Atender chamadas de visitantes", route: "/portaria/interfone", minRole: "funcionario" },
    ],
  },
  {
    title: "Síndico",
    items: [
      { icon: UserPlus, label: "Cadastros", description: "Gerenciar moradores e funcionários", route: "/cadastros", minRole: "sindico" },
      { icon: Layers, label: "Blocos", description: "Cadastrar e gerenciar blocos", route: "/cadastros/blocos", minRole: "sindico" },
      { icon: Users2, label: "Moradores", description: "Cadastrar e gerenciar moradores", route: "/cadastros/moradores", minRole: "sindico" },
      { icon: Wrench, label: "Funcionários", description: "Cadastrar e gerenciar funcionários", route: "/cadastros/funcionarios", minRole: "sindico" },
      { icon: Phone, label: "Interfone Config", description: "Configurar sistema de interfone", route: "/sindico/interfone-config", minRole: "sindico" },
      { icon: MessageCircle, label: "Interfone WhatsApp", description: "Configurar interfone via WhatsApp", route: "/sindico/whatsapp-interfone", minRole: "sindico" },
    ],
  },
  {
    title: "Administradora",
    items: [
      { icon: Shield, label: "Síndicos", description: "Cadastrar e gerenciar síndicos", route: "/cadastros/sindicos", minRole: "administradora" },
      { icon: Building2, label: "Condomínios", description: "Gerenciar condomínios", route: "/master/condominios", minRole: "administradora" },
      { icon: BarChart3, label: "Painel", description: "Painel de condomínios gerenciados", route: "/master/painel", minRole: "administradora" },
      { icon: Users2, label: "Usuários", description: "Gerenciar todos os usuários", route: "/master/usuarios", minRole: "administradora" },
      { icon: FileText, label: "Logs", description: "Histórico de atividades do sistema", route: "/master/logs", minRole: "administradora" },
      { icon: Settings, label: "Config Admin", description: "Configurações da administradora", route: "/admin/features-config", minRole: "administradora" },
    ],
  },
  {
    title: "Master",
    items: [
      { icon: Building2, label: "Administradoras", description: "Gerenciar empresas administradoras", route: "/cadastros/administradoras", minRole: "master" },
      { icon: Settings, label: "Config Master", description: "Configurações gerais do sistema", route: "/master/config", minRole: "master" },
      { icon: BookOpen, label: "Guia Instalação", description: "Tutorial de instalação completo", route: "/master/guia-instalacao", minRole: "master" },
    ],
  },
];

/* ── Role level for filtering ── */
const ROLE_LEVEL: Record<string, number> = {
  morador: 20,
  funcionario: 40,
  sindico: 60,
  administradora: 80,
  master: 100,
};

interface Props {
  userRole: string;
}

export default function FuncoesIndex({ userRole }: Props) {
  const navigate = useNavigate();
  const { p } = useTheme();
  const [open, setOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const userLevel = ROLE_LEVEL[userRole] || 0;

  // Filter groups to only show functions the user can access
  const visibleGroups = ALL_FUNCOES
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => userLevel >= (ROLE_LEVEL[item.minRole] || 0)),
    }))
    .filter((g) => g.items.length > 0);

  const totalCount = visibleGroups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div className="animate-fade-in" style={{ animationDelay: "0.08s", marginBottom: "10px" }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between cursor-pointer"
        style={{
          padding: "14px 18px",
          borderRadius: open ? "16px 16px 0 0" : 16,
          background: p.surfaceBg,
          border: p.featureBorder,
          color: p.text,
          transition: "all 0.2s ease",
        }}
      >
        <div className="flex items-center" style={{ gap: 10 }}>
          <List style={{ width: 18, height: 18, color: p.accentBright }} />
          <span style={{ fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Funções App Interfone
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 8,
            background: "rgba(59,130,246,0.15)",
            color: p.accentBright,
          }}>
            {totalCount}
          </span>
        </div>
        {open
          ? <ChevronUp style={{ width: 18, height: 18, color: p.textDim }} />
          : <ChevronDown style={{ width: 18, height: 18, color: p.textDim }} />
        }
      </button>

      {/* Expanded index */}
      {open && (
        <div
          style={{
            borderRadius: "0 0 16px 16px",
            background: p.surfaceBg,
            borderLeft: p.featureBorder.replace("2px", "").includes("solid") ? p.featureBorder : `2px solid ${p.textDim}`,
            borderRight: p.featureBorder.replace("2px", "").includes("solid") ? p.featureBorder : `2px solid ${p.textDim}`,
            borderBottom: p.featureBorder.replace("2px", "").includes("solid") ? p.featureBorder : `2px solid ${p.textDim}`,
            borderTop: "none",
            overflow: "hidden",
            maxHeight: "60vh",
            overflowY: "auto",
          }}
        >
          {visibleGroups.map((group) => {
            const isExpanded = expandedGroup === group.title;
            const roleInfo = ROLE_COLORS[group.title.toLowerCase()] ||
              ROLE_COLORS[group.items[0]?.minRole] ||
              { bg: "rgba(255,255,255,0.1)", text: "#fff", label: group.title };

            return (
              <div key={group.title}>
                {/* Group header */}
                <button
                  onClick={() => setExpandedGroup(isExpanded ? null : group.title)}
                  className="w-full flex items-center justify-between cursor-pointer"
                  style={{
                    padding: "10px 18px",
                    background: isExpanded ? "rgba(255,255,255,0.04)" : "transparent",
                    border: "none",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    color: p.text,
                    transition: "background 0.15s",
                  }}
                >
                  <div className="flex items-center" style={{ gap: 8 }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: roleInfo.bg,
                      color: roleInfo.text,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}>
                      {group.title}
                    </span>
                    <span style={{ fontSize: 11, color: p.textDim }}>
                      {group.items.length} {group.items.length === 1 ? "função" : "funções"}
                    </span>
                  </div>
                  {isExpanded
                    ? <ChevronUp style={{ width: 14, height: 14, color: p.textDim }} />
                    : <ChevronDown style={{ width: 14, height: 14, color: p.textDim }} />
                  }
                </button>

                {/* Items */}
                {isExpanded && group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.route}
                      onClick={() => { navigate(item.route); setOpen(false); }}
                      className="w-full flex items-center cursor-pointer"
                      style={{
                        padding: "8px 18px 8px 28px",
                        gap: 10,
                        background: "transparent",
                        border: "none",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                        color: p.text,
                        transition: "background 0.12s",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <div className="flex items-center justify-center shrink-0" style={{ width: 28, height: 28, borderRadius: 8, background: roleInfo.bg }}>
                        <Icon style={{ width: 14, height: 14, color: roleInfo.text }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{item.label}</p>
                        <p style={{ fontSize: 11, color: p.textDim, lineHeight: 1.2 }}>{item.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
