import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, hasMinRole, type UserRole } from "@/hooks/useAuth";
import React, { useState, useEffect, lazy, Suspense } from "react";
import { onDemoBlocked } from "@/lib/api";

// Carregados ansiosamente (boot crítico)
import Login from "@/pages/Login";
import LandingPage from "@/pages/LandingPage";
import DashboardRouter from "@/pages/DashboardRouter";
import DemoTrialModal from "@/components/DemoTrialModal";
import PushPermissionModal from "@/components/PushPermissionModal";
import GlobalIncomingCall from "@/components/GlobalIncomingCall";

// Lazy: telas de auth e onboarding
const SearchCondominio = lazy(() => import("@/pages/SearchCondominio"));
const RegisterMorador = lazy(() => import("@/pages/RegisterMorador"));
const RegisterCondominio = lazy(() => import("@/pages/RegisterCondominio"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));

// Lazy: cadastros
const Cadastros = lazy(() => import("@/pages/Cadastros"));
const CadastroFuncionarios = lazy(() => import("@/pages/CadastroFuncionarios"));
const CadastroBlocos = lazy(() => import("@/pages/CadastroBlocos"));
const CadastroMoradores = lazy(() => import("@/pages/CadastroMoradores"));
const CadastroMoradoresManual = lazy(() => import("@/pages/CadastroMoradoresManual"));
const CadastroMoradoresLink = lazy(() => import("@/pages/CadastroMoradoresLink"));
const CadastroMoradoresQRCode = lazy(() => import("@/pages/CadastroMoradoresQRCode"));
const CadastroMoradoresPlanilha = lazy(() => import("@/pages/CadastroMoradoresPlanilha"));
const CadastroAdministradoras = lazy(() => import("@/pages/CadastroAdministradoras"));
const CadastroSindicos = lazy(() => import("@/pages/CadastroSindicos"));

// Lazy: master
const MasterCondominios = lazy(() => import("@/pages/MasterCondominios"));
const MasterUsuarios = lazy(() => import("@/pages/MasterUsuarios"));
const MasterConfig = lazy(() => import("@/pages/MasterConfig"));
const MasterLogs = lazy(() => import("@/pages/MasterLogs"));
const MasterPainelCondominios = lazy(() => import("@/pages/MasterPainelCondominios"));
const MasterGateConfig = lazy(() => import("@/pages/MasterGateConfig"));
const MasterWhatsAppDashboard = lazy(() => import("@/pages/MasterWhatsAppDashboard"));
const MasterGuiaInstalacao = lazy(() => import("@/pages/MasterGuiaInstalacao"));

// Lazy: portaria
const EspelhoPortaria = lazy(() => import("@/pages/EspelhoPortaria"));
const CadastrarVisitante = lazy(() => import("@/pages/CadastrarVisitante"));
const VisitanteQRCode = lazy(() => import("@/pages/VisitanteQRCode"));
const DeliveryPorteiro = lazy(() => import("@/pages/DeliveryPorteiro"));
const VeiculosPorteiro = lazy(() => import("@/pages/VeiculosPorteiro"));
const PortariaConfig = lazy(() => import("@/pages/PortariaConfig"));
const PersonalizarDashboard = lazy(() => import("@/pages/PersonalizarDashboard"));
const CorrespondenciasPorteiro = lazy(() => import("@/pages/CorrespondenciasPorteiro"));
const LivroProtocolo = lazy(() => import("@/pages/LivroProtocolo"));
const PortariaAcessoAuto = lazy(() => import("@/pages/PortariaAcessoAuto"));
const PorteiroQRScanner = lazy(() => import("@/pages/PorteiroQRScanner"));
const MonitoramentoCameras = lazy(() => import("@/pages/MonitoramentoCameras"));
const RegistroRonda = lazy(() => import("@/pages/RegistroRonda"));
const FuncionarioInterfone = lazy(() => import("@/pages/FuncionarioInterfone"));
const CentroComando = lazy(() => import("@/pages/CentroComando"));

// Lazy: morador
const MoradorAutorizacoes = lazy(() => import("@/pages/MoradorAutorizacoes"));
const MoradorDelivery = lazy(() => import("@/pages/MoradorDelivery"));
const MoradorVeiculos = lazy(() => import("@/pages/MoradorVeiculos"));
const MoradorCorrespondencias = lazy(() => import("@/pages/MoradorCorrespondencias"));
const MoradorQRVisitante = lazy(() => import("@/pages/MoradorQRVisitante"));
const MoradorInterfoneConfig = lazy(() => import("@/pages/MoradorInterfoneConfig"));
const MoradorInterfone = lazy(() => import("@/pages/MoradorInterfone"));
const MoradorPortariaVirtual = lazy(() => import("@/pages/MoradorPortariaVirtual"));
const MinhaConta = lazy(() => import("@/pages/MinhaConta"));

// Lazy: síndico
const SindicoQRConfig = lazy(() => import("@/pages/SindicoQRConfig"));
const SindicoFeaturesConfig = lazy(() => import("@/pages/SindicoFeaturesConfig"));
const SindicoInterfoneConfig = lazy(() => import("@/pages/SindicoInterfoneConfig"));
const SindicoInterfoneHistorico = lazy(() => import("@/pages/SindicoInterfoneHistorico"));
const MoradorInterfoneHistorico = lazy(() => import("@/pages/MoradorInterfoneHistorico"));
const SindicoWhatsAppInterfone = lazy(() => import("@/pages/SindicoWhatsAppInterfone"));
const SindicoGateConfig = lazy(() => import("@/pages/SindicoGateConfig"));
const SindicoAccessConfig = lazy(() => import("@/pages/SindicoAccessConfig"));
const SindicoWhatsAppConfig = lazy(() => import("@/pages/SindicoWhatsAppConfig"));
const AdminFeaturesConfig = lazy(() => import("@/pages/AdminFeaturesConfig"));
const CadastroCameras = lazy(() => import("@/pages/CadastroCameras"));
const ControleRondasSindico = lazy(() => import("@/pages/ControleRondasSindico"));
const LiberacaoCadastros = lazy(() => import("@/pages/LiberacaoCadastros"));

// Lazy: utilitários
const ConfiguracaoToque = lazy(() => import("@/pages/ConfiguracaoToque"));
const BibliotecaDispositivos = lazy(() => import("@/pages/BibliotecaDispositivos"));
const EwelinkCallback = lazy(() => import("@/pages/EwelinkCallback"));
const PortariaVirtualTutorial = lazy(() => import("@/pages/PortariaVirtualTutorial"));

// Lazy: páginas públicas (visitante via QR)
const AutorizarVisitante = lazy(() => import("@/pages/AutorizarVisitante"));
const AutoCadastroVisitante = lazy(() => import("@/pages/AutoCadastroVisitante"));
const AutoCadastroPreAuth = lazy(() => import("@/pages/AutoCadastroPreAuth"));
const QRVisitantePublic = lazy(() => import("@/pages/QRVisitantePublic"));
const AprovarVeiculo = lazy(() => import("@/pages/AprovarVeiculo"));
const InterfoneVisitor = lazy(() => import("@/pages/InterfoneVisitor"));
const InterfoneWhatsApp = lazy(() => import("@/pages/InterfoneWhatsApp"));
const ContratoPage = lazy(() => import("@/pages/ContratoPage"));
const ApresentacaoPage = lazy(() => import("@/pages/ApresentacaoPage"));

// ─── Loaders ─────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center" role="status" aria-live="polite">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

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

  if (isLoading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (minRole && !hasMinRole(user.role, minRole)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function LandingOrDashboard() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
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
    <Suspense fallback={<PageLoader />}>
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
        <Route path="/sindico/interfone-historico" element={<ProtectedRoute minRole="sindico"><SindicoInterfoneHistorico /></ProtectedRoute>} />
        <Route path="/morador/interfone-historico" element={<ProtectedRoute><MoradorInterfoneHistorico /></ProtectedRoute>} />
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
    </Suspense>
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
