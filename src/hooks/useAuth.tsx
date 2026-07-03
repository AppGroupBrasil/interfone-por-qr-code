import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { apiFetch, setToken, clearToken } from "@/lib/api";
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
    apiFetch("/api/auth/me", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          // Register push on session restore
          initPushNotifications().catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, []);

  // OTA: custom_id nas checagens de update — o servidor usa para decidir
  // o canal (beta/produção) por usuário via OTA_BETA_USERS
  useEffect(() => {
    if (!isNative) return;
    import("@capgo/capacitor-updater")
      .then(({ CapacitorUpdater }) =>
        CapacitorUpdater.setCustomId({ customId: user ? String(user.id) : "" })
      )
      .catch(() => {});
  }, [user?.id]);

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
