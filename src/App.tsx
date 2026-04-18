import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, hasMinRole, type UserRole } from "@/hooks/useAuth";
import React, { useState, useEffect } from "react";
import Login from "@/pages/Login";
import SearchCondominio from "@/pages/SearchCondominio";
import RegisterMorador from "@/pages/RegisterMorador";
import RegisterCondominio from "@/pages/RegisterCondominio";
import DashboardRouter from "@/pages/DashboardRouter";
import ForgotPassword from "@/pages/ForgotPassword";
import Cadastros from "@/pages/Cadastros";
import DemoTrialModal from "@/components/DemoTrialModal";
import { onDemoBlocked } from "@/lib/api";
import PushPermissionModal from "@/components/PushPermissionModal";
import CadastroFuncionarios from "@/pages/CadastroFuncionarios";
import CadastroBlocos from "@/pages/CadastroBlocos";
import CadastroMoradores from "@/pages/CadastroMoradores";
import CadastroMoradoresManual from "@/pages/CadastroMoradoresManual";
import CadastroMoradoresLink from "@/pages/CadastroMoradoresLink";
import CadastroMoradoresQRCode from "@/pages/CadastroMoradoresQRCode";
import CadastroMoradoresPlanilha from "@/pages/CadastroMoradoresPlanilha";
import CadastroAdministradoras from "@/pages/CadastroAdministradoras";
import CadastroSindicos from "@/pages/CadastroSindicos";
import MasterCondominios from "@/pages/MasterCondominios";
import MasterUsuarios from "@/pages/MasterUsuarios";
import MasterConfig from "@/pages/MasterConfig";
import MasterLogs from "@/pages/MasterLogs";
import EspelhoPortaria from "@/pages/EspelhoPortaria";
import CadastrarVisitante from "@/pages/CadastrarVisitante";
import AutorizarVisitante from "@/pages/AutorizarVisitante";
import AutoCadastroVisitante from "@/pages/AutoCadastroVisitante";
import VisitanteQRCode from "@/pages/VisitanteQRCode";
import MoradorAutorizacoes from "@/pages/MoradorAutorizacoes";
import AutoCadastroPreAuth from "@/pages/AutoCadastroPreAuth";
import QRVisitantePublic from "@/pages/QRVisitantePublic";
import MoradorDelivery from "@/pages/MoradorDelivery";
import DeliveryPorteiro from "@/pages/DeliveryPorteiro";
import MoradorVeiculos from "@/pages/MoradorVeiculos";
import VeiculosPorteiro from "@/pages/VeiculosPorteiro";
import PortariaConfig from "@/pages/PortariaConfig";
import PersonalizarDashboard from "@/pages/PersonalizarDashboard";
import AprovarVeiculo from "@/pages/AprovarVeiculo";
import MinhaConta from "@/pages/MinhaConta";
import CorrespondenciasPorteiro from "@/pages/CorrespondenciasPorteiro";
import MoradorCorrespondencias from "@/pages/MoradorCorrespondencias";
import LivroProtocolo from "@/pages/LivroProtocolo";
import PortariaVirtualTutorial from "@/pages/PortariaVirtualTutorial";
import MoradorQRVisitante from "@/pages/MoradorQRVisitante";
import PorteiroQRScanner from "@/pages/PorteiroQRScanner";
import SindicoQRConfig from "@/pages/SindicoQRConfig";
import SindicoFeaturesConfig from "@/pages/SindicoFeaturesConfig";
import AdminFeaturesConfig from "@/pages/AdminFeaturesConfig";
import CadastroCameras from "@/pages/CadastroCameras";
import MonitoramentoCameras from "@/pages/MonitoramentoCameras";
import ControleRondasSindico from "@/pages/ControleRondasSindico";
import RegistroRonda from "@/pages/RegistroRonda";
import SindicoInterfoneConfig from "@/pages/SindicoInterfoneConfig";
import MoradorInterfoneConfig from "@/pages/MoradorInterfoneConfig";
import MoradorInterfone from "@/pages/MoradorInterfone";
import FuncionarioInterfone from "@/pages/FuncionarioInterfone";
import InterfoneVisitor from "@/pages/InterfoneVisitor";
import InterfoneWhatsApp from "@/pages/InterfoneWhatsApp";
import LandingPage from "@/pages/LandingPage";
import SindicoWhatsAppInterfone from "@/pages/SindicoWhatsAppInterfone";
import SindicoGateConfig from "@/pages/SindicoGateConfig";
import SindicoAccessConfig from "@/pages/SindicoAccessConfig";
import SindicoWhatsAppConfig from "@/pages/SindicoWhatsAppConfig";
import MasterWhatsAppDashboard from "@/pages/MasterWhatsAppDashboard";
import MasterGateConfig from "@/pages/MasterGateConfig";
import MoradorPortariaVirtual from "@/pages/MoradorPortariaVirtual";
import MasterPainelCondominios from "@/pages/MasterPainelCondominios";
import LiberacaoCadastros from "@/pages/LiberacaoCadastros";
import CentroComando from "@/pages/CentroComando";
import ConfiguracaoToque from "@/pages/ConfiguracaoToque";
import BibliotecaDispositivos from "@/pages/BibliotecaDispositivos";
import EwelinkCallback from "@/pages/EwelinkCallback";
import MasterGuiaInstalacao from "@/pages/MasterGuiaInstalacao";
import PortariaAcessoAuto from "@/pages/PortariaAcessoAuto";
import ContratoPage from "@/pages/ContratoPage";
import ApresentacaoPage from "@/pages/ApresentacaoPage";
import GlobalIncomingCall from "@/components/GlobalIncomingCall";

// ─── Error Boundary ──────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-background flex items-center justify-center p-8">
          <div className="text-center space-y-4 max-w-md">
            <h1 className="text-2xl font-bold text-foreground">Algo deu errado</h1>
            <p className="text-muted-foreground">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            <button
              onClick={() => globalThis.location.reload()}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Route Guards ────────────────────────────────────────

function ProtectedRoute({ children, minRole }: Readonly<{ children: React.ReactNode; minRole?: UserRole }>) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (minRole && !hasMinRole(user.role, minRole)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function LandingOrDashboard() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

function DemoBlockedListener() {
  const [show, setShow] = useState(false);
  useEffect(() => onDemoBlocked(() => setShow(true)), []);
  return <DemoTrialModal open={show} onClose={() => setShow(false)} />;
}

function PushPermissionListener() {
  const { user } = useAuth();
  const [status, setStatus] = useState<"prompt" | "blocked" | null>(null);

  useEffect(() => {
    const handlePushPermission = (event: Event) => {
      const customEvent = event as CustomEvent<{ status: "prompt" | "blocked" | "enabled" }>;
      const nextStatus = customEvent.detail?.status;
      if (nextStatus === "enabled") {
        setStatus(null);
        return;
      }
      if (nextStatus === "prompt" || nextStatus === "blocked") {
        setStatus(nextStatus);
      }
    };

    globalThis.addEventListener("appinterfone:push-permission", handlePushPermission as EventListener);
    return () => globalThis.removeEventListener("appinterfone:push-permission", handlePushPermission as EventListener);
  }, []);

  if (!user) return null;

  return <PushPermissionModal open={!!status} status={status || "prompt"} onClose={() => setStatus(null)} />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingOrDashboard />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/register/morador/search" element={<PublicRoute><SearchCondominio /></PublicRoute>} />
      <Route path="/register/morador" element={<PublicRoute><RegisterMorador /></PublicRoute>} />
      <Route path="/register/condominio" element={<PublicRoute><RegisterCondominio /></PublicRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
      <Route path="/cadastros" element={<ProtectedRoute><Cadastros /></ProtectedRoute>} />
      <Route path="/cadastros/administradoras" element={<ProtectedRoute minRole="master"><CadastroAdministradoras /></ProtectedRoute>} />
      <Route path="/cadastros/sindicos" element={<ProtectedRoute minRole="administradora"><CadastroSindicos /></ProtectedRoute>} />
      <Route path="/cadastros/funcionarios" element={<ProtectedRoute minRole="sindico"><CadastroFuncionarios /></ProtectedRoute>} />
      <Route path="/cadastros/blocos" element={<ProtectedRoute minRole="sindico"><CadastroBlocos /></ProtectedRoute>} />
      <Route path="/cadastros/moradores" element={<ProtectedRoute minRole="sindico"><CadastroMoradores /></ProtectedRoute>} />
      <Route path="/cadastros/moradores/manual" element={<ProtectedRoute minRole="sindico"><CadastroMoradoresManual /></ProtectedRoute>} />
      <Route path="/cadastros/moradores/link" element={<ProtectedRoute minRole="sindico"><CadastroMoradoresLink /></ProtectedRoute>} />
      <Route path="/cadastros/moradores/qrcode" element={<ProtectedRoute minRole="sindico"><CadastroMoradoresQRCode /></ProtectedRoute>} />
      <Route path="/cadastros/moradores/planilha" element={<ProtectedRoute minRole="sindico"><CadastroMoradoresPlanilha /></ProtectedRoute>} />
      <Route path="/master/condominios" element={<ProtectedRoute minRole="administradora"><MasterCondominios /></ProtectedRoute>} />
      <Route path="/master/painel" element={<ProtectedRoute minRole="administradora"><MasterPainelCondominios /></ProtectedRoute>} />
      <Route path="/master/usuarios" element={<ProtectedRoute minRole="administradora"><MasterUsuarios /></ProtectedRoute>} />
      <Route path="/master/config" element={<ProtectedRoute minRole="master"><MasterConfig /></ProtectedRoute>} />
      <Route path="/master/logs" element={<ProtectedRoute minRole="administradora"><MasterLogs /></ProtectedRoute>} />
      <Route path="/master/portao" element={<ProtectedRoute minRole="administradora"><MasterGateConfig /></ProtectedRoute>} />
      <Route path="/master/guia-instalacao" element={<ProtectedRoute minRole="master"><MasterGuiaInstalacao /></ProtectedRoute>} />
      <Route path="/master/whatsapp" element={<ProtectedRoute minRole="administradora"><MasterWhatsAppDashboard /></ProtectedRoute>} />
      <Route path="/callback" element={<EwelinkCallback />} />
      <Route path="/espelho-portaria" element={<ProtectedRoute><EspelhoPortaria /></ProtectedRoute>} />
      <Route path="/portaria/acesso-pedestres" element={<ProtectedRoute><CadastrarVisitante /></ProtectedRoute>} />
      <Route path="/portaria/visitante-qrcode" element={<ProtectedRoute><VisitanteQRCode /></ProtectedRoute>} />
      <Route path="/portaria/autorizacoes-previas" element={<Navigate to="/portaria/acesso-pedestres" replace />} />
      <Route path="/morador/autorizacoes" element={<ProtectedRoute><MoradorAutorizacoes /></ProtectedRoute>} />
      <Route path="/morador/delivery" element={<ProtectedRoute><MoradorDelivery /></ProtectedRoute>} />
      <Route path="/portaria/delivery" element={<ProtectedRoute><DeliveryPorteiro /></ProtectedRoute>} />
      <Route path="/morador/veiculos" element={<ProtectedRoute><MoradorVeiculos /></ProtectedRoute>} />
      <Route path="/portaria/acesso-veiculos" element={<ProtectedRoute><VeiculosPorteiro /></ProtectedRoute>} />
      <Route path="/portaria/configuracoes" element={<ProtectedRoute><PortariaConfig /></ProtectedRoute>} />
      <Route path="/portaria/personalizar-dashboard" element={<ProtectedRoute><PersonalizarDashboard /></ProtectedRoute>} />
      <Route path="/minha-conta" element={<ProtectedRoute><MinhaConta /></ProtectedRoute>} />
      <Route path="/configuracao-toque" element={<ProtectedRoute><ConfiguracaoToque /></ProtectedRoute>} />
      <Route path="/biblioteca-dispositivos" element={<ProtectedRoute><BibliotecaDispositivos /></ProtectedRoute>} />
      <Route path="/portaria/correspondencias" element={<ProtectedRoute><CorrespondenciasPorteiro /></ProtectedRoute>} />
      <Route path="/morador/correspondencias" element={<ProtectedRoute><MoradorCorrespondencias /></ProtectedRoute>} />
      <Route path="/portaria/livro-protocolo" element={<ProtectedRoute><LivroProtocolo /></ProtectedRoute>} />
      <Route path="/portaria/portaria-virtual" element={<ProtectedRoute><MoradorPortariaVirtual /></ProtectedRoute>} />
      <Route path="/portaria/acesso-auto" element={<ProtectedRoute minRole="funcionario"><PortariaAcessoAuto /></ProtectedRoute>} />
      <Route path="/morador/qr-visitante" element={<ProtectedRoute><MoradorQRVisitante /></ProtectedRoute>} />
      <Route path="/portaria/qr-scanner" element={<ProtectedRoute><PorteiroQRScanner /></ProtectedRoute>} />
      <Route path="/sindico/qr-config" element={<ProtectedRoute><SindicoQRConfig /></ProtectedRoute>} />
      <Route path="/sindico/features-config" element={<ProtectedRoute><SindicoFeaturesConfig /></ProtectedRoute>} />
      <Route path="/admin/features-config" element={<ProtectedRoute minRole="administradora"><AdminFeaturesConfig /></ProtectedRoute>} />
      <Route path="/sindico/cameras" element={<ProtectedRoute minRole="sindico"><CadastroCameras /></ProtectedRoute>} />
      <Route path="/portaria/monitoramento" element={<ProtectedRoute minRole="funcionario"><MonitoramentoCameras /></ProtectedRoute>} />
      <Route path="/sindico/rondas" element={<ProtectedRoute minRole="sindico"><ControleRondasSindico /></ProtectedRoute>} />
      <Route path="/portaria/rondas" element={<ProtectedRoute minRole="funcionario"><RegistroRonda /></ProtectedRoute>} />
      <Route path="/sindico/interfone-config" element={<ProtectedRoute minRole="sindico"><SindicoInterfoneConfig /></ProtectedRoute>} />
      <Route path="/morador/interfone-config" element={<ProtectedRoute><MoradorInterfoneConfig /></ProtectedRoute>} />
      <Route path="/morador/interfone" element={<ProtectedRoute><MoradorInterfone /></ProtectedRoute>} />
      <Route path="/portaria/interfone" element={<ProtectedRoute><FuncionarioInterfone /></ProtectedRoute>} />
      <Route path="/portaria/centro-comando" element={<ProtectedRoute><CentroComando /></ProtectedRoute>} />
      <Route path="/sindico/portao" element={<ProtectedRoute minRole="sindico"><SindicoGateConfig /></ProtectedRoute>} />
      <Route path="/sindico/acessos" element={<ProtectedRoute minRole="sindico"><SindicoAccessConfig /></ProtectedRoute>} />
      <Route path="/sindico/whatsapp" element={<ProtectedRoute minRole="sindico"><SindicoWhatsAppConfig /></ProtectedRoute>} />
      <Route path="/sindico/whatsapp-interfone" element={<ProtectedRoute minRole="sindico"><SindicoWhatsAppInterfone /></ProtectedRoute>} />
      <Route path="/liberacao-cadastros" element={<ProtectedRoute minRole="sindico"><LiberacaoCadastros /></ProtectedRoute>} />
      <Route path="/morador/portaria-virtual" element={<ProtectedRoute><MoradorPortariaVirtual /></ProtectedRoute>} />
      {/* Rotas públicas de visitante (sem autenticação) */}
      <Route path="/interfone/:token" element={<InterfoneVisitor />} />
      <Route path="/whatsapp/:token" element={<InterfoneWhatsApp />} />
      <Route path="/portaria-virtual-tutorial" element={<PortariaVirtualTutorial />} />
      <Route path="/contrato" element={<ContratoPage />} />
      <Route path="/apresentacao" element={<ApresentacaoPage />} />
      <Route path="/visitante/autorizar/:token" element={<AutorizarVisitante />} />
      <Route path="/visitante/auto-cadastro" element={<AutoCadastroVisitante />} />
      <Route path="/autorizacao/auto-cadastro/:token" element={<AutoCadastroPreAuth />} />
      <Route path="/visitante/qr/:token" element={<QRVisitantePublic />} />
      <Route path="/veiculo/aprovar/:token" element={<AprovarVeiculo />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <GlobalIncomingCall />
          <DemoBlockedListener />
          <PushPermissionListener />
          <AppRoutes />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
