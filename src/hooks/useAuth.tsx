import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { apiFetch, setToken, clearToken, refreshSession } from "@/lib/api";
import { initPushNotifications, unregisterPushToken } from "@/lib/pushNotifications";
import { isDemoMode, setDemoMode } from "@/hooks/useDemoGuard";
import { isNative } from "@/lib/config";

// ─── ROLE TYPES ──────────────────────────────────────────
export type UserRole = "master" | "administradora" | "sindico" | "funcionario" | "morador";

const ROLE_LABELS: Record<UserRole, string> = {
  master: "Admin Master",
  administradora: "Administradora",
  sindico: "Síndico",
  funcionario: "Funcionário",
  morador: "Morador",
};

const ROLE_LEVEL: Record<UserRole, number> = {
  master: 100,
  administradora: 80,
  sindico: 60,
  funcionario: 40,
  morador: 20,
};

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role as UserRole] || role;
}

export function canEdit(role: string): boolean {
  return (ROLE_LEVEL[role as UserRole] || 0) >= ROLE_LEVEL.sindico;
}

export function canDelete(role: string): boolean {
  return (ROLE_LEVEL[role as UserRole] || 0) >= ROLE_LEVEL.sindico;
}

export function canDeleteCondominio(role: string): boolean {
  return role === "master";
}

export function hasMinRole(role: string, minRole: UserRole): boolean {
  return (ROLE_LEVEL[role as UserRole] || 0) >= ROLE_LEVEL[minRole];
}

interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  cpf?: string;
  role: UserRole;
  perfil?: string;
  unit?: string;
  block?: string;
  condominioId?: number;
  condominio_nome?: string;
  avatarUrl?: string;
  aprovado?: number;
}

interface RegisterMoradorData {
  name: string;
  email: string;
  phone?: string;
  perfil?: string;
  password: string;
  unit?: string;
  block?: string;
  condominioId?: number;
}

interface RegisterCondominioData {
  condominioName: string;
  cnpj?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  unitsCount?: string;
  hasPortaria?: boolean;
  adminName: string;
  email: string;
  phone?: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isDemo: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: (role: "sindico" | "portaria" | "morador") => Promise<void>;
  registerMorador: (data: RegisterMoradorData) => Promise<void>;
  registerCondominio: (data: RegisterCondominioData) => Promise<any>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(isDemoMode());

  // Check session on mount
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    // Falha de rede no boot (o app abrindo pela campainha pega o Wi-Fi/4G ainda
    // subindo) deixava user null e jogava o morador na landing no meio da
    // chamada. 401 é resposta legítima e não é repetido.
    const restore = async (attempt = 0) => {
      try {
        const res = await apiFetch("/api/auth/me", { signal: controller.signal });
        if (cancelled) return;
        if (!res.ok) {
          if (res.status !== 401 && attempt === 0) {
            setTimeout(() => restore(1), 1500);
            return;
          }
          setIsLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data?.user) {
          setUser(data.user);
          // Register push on session restore
          initPushNotifications().catch(() => {});
        }
        setIsLoading(false);
      } catch {
        if (cancelled) return;
        if (attempt === 0) {
          setTimeout(() => restore(1), 1500);
          return;
        }
        setIsLoading(false);
      }
    };

    void restore();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  // A campainha depende de sessão viva: o JWT vale 24h e o morador pode passar
  // dias sem abrir o app. Renova ao voltar do background e a cada 6h de app
  // aberto — sem sessão válida o push chega e não vira chamada.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let ultima = Date.now();
    const renovar = (forcar = false) => {
      if (cancelled) return;
      // No resume só renova se já passou 1h; abrir/fechar o app não vira rajada.
      if (!forcar && Date.now() - ultima < 60 * 60 * 1000) return;
      ultima = Date.now();
      void refreshSession();
    };
    const timer = setInterval(() => renovar(true), 6 * 60 * 60 * 1000);
    let remover: (() => void) | undefined;
    if (isNative) {
      import("@capacitor/app")
        .then(({ App }) =>
          App.addListener("appStateChange", ({ isActive }) => {
            if (isActive) renovar();
          })
        )
        .then((handle) => {
          if (cancelled) void handle.remove();
          else remover = () => void handle.remove();
        })
        .catch(() => {});
    } else {
      const onVisible = () => {
        if (document.visibilityState === "visible") renovar();
      };
      document.addEventListener("visibilitychange", onVisible);
      remover = () => document.removeEventListener("visibilitychange", onVisible);
    }
    return () => {
      cancelled = true;
      clearInterval(timer);
      remover?.();
    };
  }, [user?.id]);

  // OTA: custom_id nas checagens de update — o servidor usa para decidir
  // o canal (beta/produção) por usuário via OTA_BETA_USERS
  useEffect(() => {
    // Enquanto a sessão restaura, user é null — limpar o customId aqui faria a
    // checagem OTA cair no canal production; só mexe depois do auth resolver
    if (!isNative || isLoading) return;
    import("@capgo/capacitor-updater")
      .then(({ CapacitorUpdater }) =>
        CapacitorUpdater.setCustomId({ customId: user ? String(user.id) : "" })
      )
      .catch(() => {});
  }, [user?.id, isLoading]);

  const login = async (email: string, password: string) => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      let errorMsg = "Erro ao fazer login";
      try {
        const err = await res.json();
        errorMsg = err.error || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }
    const data = await res.json();
    if (data.token) setToken(data.token);
    setUser(data.user);
    // Register for push notifications after login
    initPushNotifications().catch(() => {});
  };

  const loginDemo = async (role: "sindico" | "portaria" | "morador") => {
    const res = await apiFetch("/api/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      let errorMsg = "Erro ao iniciar demonstração";
      try { const err = await res.json(); errorMsg = err.error || errorMsg; } catch {}
      throw new Error(errorMsg);
    }
    const data = await res.json();
    if (data.token) setToken(data.token);
    setDemoMode(true);
    setIsDemo(true);
    setUser(data.user);
  };

  const registerMorador = async (data: RegisterMoradorData) => {
    const res = await apiFetch("/api/auth/register/morador", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    let body: any;
    try { body = await res.json(); } catch { body = {}; }
    if (!res.ok) {
      throw new Error(body.error || "Erro ao criar conta");
    }
    if (body.pendingApproval) {
      throw new Error("__PENDING_APPROVAL__");
    }
    if (body.token) setToken(body.token);
    setUser(body.user);
  };

  const registerCondominio = async (data: RegisterCondominioData) => {
    const res = await apiFetch("/api/auth/register/condominio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    let body: any;
    try { body = await res.json(); } catch { body = {}; }
    if (!res.ok) {
      throw new Error(body.error || "Erro ao criar conta");
    }
    if (body.token) setToken(body.token);
    setUser(body.user);
    return body; // includes sampleMorador data
  };

  const logout = async () => {
    try {
      // Unregister push token before logout
      await unregisterPushToken();
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Network error — still clear local session
    }
    clearToken();
    setDemoMode(false);
    setIsDemo(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isDemo, login, loginDemo, registerMorador, registerCondominio, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
