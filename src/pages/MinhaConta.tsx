import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Building2,
  DoorOpen,
  Lock,
  Trash2,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Volume2,
  ChevronRight,
  MessageCircle,
  Palette,
  Check,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";
import { THEME_LIST, type ThemeId } from "@/lib/themes";

const API = "/api/auth";

export default function MinhaConta() {
  const { isDark, p, theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const role = user?.role || "morador";
  const isMorador = role === "morador";
  const isFuncionario = role === "funcionario";

  // Profile fields
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [block, setBlock] = useState(user?.block || "");
  const [unit, setUnit] = useState(user?.unit || "");

  // Password fields
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Feedback
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // WhatsApp interfone
  const [whatsappInterfone, setWhatsappInterfone] = useState(false);
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);

  // Load interfone config on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/interfone/config");
        if (res.ok) {
          const data = await res.json();
          setWhatsappInterfone(data.whatsapp_interfone !== "0");
        }
      } catch {}
    })();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError("");
    setTimeout(() => setSuccess(""), 4000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setSuccess("");
    setTimeout(() => setError(""), 5000);
  };

  // ── Save profile ──
  const handleSaveProfile = async () => {
    if (!name.trim()) { showError("Nome é obrigatório."); return; }
    setSaving(true);
    try {
      const res = await apiFetch(`${API}/account`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone, email, block, unit }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "Erro ao salvar."); return; }
      showSuccess("Dados atualizados com sucesso!");
    } catch {
      showError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  };

  // ── Change password ──
  const handleChangePassword = async () => {
    if (!currentPassword) { showError("Digite sua senha atual."); return; }
    if (newPassword.length < 6) { showError("A nova senha deve ter pelo menos 6 caracteres."); return; }
    if (newPassword !== confirmPassword) { showError("As senhas não conferem."); return; }
    setSavingPw(true);
    try {
      const res = await apiFetch(`${API}/account/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "Erro ao alterar senha."); return; }
      showSuccess("Senha alterada com sucesso!");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setShowPasswordSection(false);
    } catch {
      showError("Erro de conexão.");
    } finally {
      setSavingPw(false);
    }
  };

  // ── Delete account ──
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "EXCLUIR") { showError("Digite EXCLUIR para confirmar."); return; }
    setDeleting(true);
    try {
      const res = await apiFetch(`${API}/account`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "Erro ao excluir."); return; }
      await logout();
      navigate("/login");
    } catch {
      showError("Erro de conexão.");
    } finally {
      setDeleting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: "12px",
    border: "1px solid #cbd5e1", fontSize: "14px", background: "#fff",
    color: "#0f172a", outline: "none", boxSizing: "border-box",
  };

  const readOnlyStyle: React.CSSProperties = {
    ...inputStyle,
    background: "#f1f5f9", color: "#64748b", cursor: "default",
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 600, fontSize: "13px", color: "#475569", marginBottom: "6px",
    display: "flex", alignItems: "center", gap: "6px",
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#f8fafc" }}>
      {/* Header */}
      <header style={{
        background: isDark ? "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" : "#ffffff",
        color: p.text, padding: "16px 20px",
        display: "flex", alignItems: "center", gap: "12px",
      }}>
        <button onClick={() => navigate("/dashboard")}
          style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "10px", padding: "8px", cursor: "pointer", display: "flex" }}>
          <ArrowLeft className="w-5 h-5" style={{ color: p.text }} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Minha Conta</h1>
          <p style={{ fontSize: "12px", color: isDark ? "rgba(255,255,255,0.6)" : "#64748b", margin: 0 }}>Gerencie seus dados pessoais</p>
        </div>
        <div style={{
          width: "42px", height: "42px", borderRadius: "50%",
          background: isDark ? "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" : "#ffffff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 800, fontSize: "18px", color: p.text,
        }}>
          {user?.name?.charAt(0)?.toUpperCase() || "U"}
        </div>
      </header>

      {/* Feedback */}
      {success && (
        <div style={{
          margin: "16px 16px 0", padding: "12px 16px", borderRadius: "12px",
          background: "#ecfdf5", border: "1px solid #86efac", color: "#15803d",
          fontSize: "13px", fontWeight: 500, display: "flex", alignItems: "center", gap: "8px",
        }}>
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}
      {error && (
        <div style={{
          margin: "16px 16px 0", padding: "12px 16px", borderRadius: "12px",
          background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c",
          fontSize: "13px", fontWeight: 500, display: "flex", alignItems: "center", gap: "8px",
        }}>
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      <div style={{ padding: "20px 16px 100px", display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* ═══════ CONDOMÍNIO ═══════ */}
        {isMorador && (
          <div style={{
            background: "#fff", borderRadius: "16px", padding: "20px",
            border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <h2 style={{
              fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 16px",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <Building2 className="w-4 h-4" style={{ color: "#003580" }} />
              Condomínio
            </h2>

            <p style={{
              fontSize: "14px", fontWeight: 600, color: "#334155", margin: "0 0 14px",
            }}>
              {user?.condominio_nome || "Meu Condomínio"}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>
                  <Building2 className="w-3.5 h-3.5" /> Bloco
                </label>
                <input type="text" value={block} onChange={(e) => setBlock(e.target.value)}
                  placeholder="Ex: A" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>
                  <DoorOpen className="w-3.5 h-3.5" /> Apartamento
                </label>
                <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)}
                  placeholder="Ex: 101" style={inputStyle} />
              </div>
            </div>
          </div>
        )}

        {/* ═══════ DADOS PESSOAIS ═══════ */}
        <div style={{
          background: "#fff", borderRadius: "16px", padding: "20px",
          border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <h2 style={{
            fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 16px",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <User className="w-4 h-4" style={{ color: "#6366f1" }} />
            Dados Pessoais
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Nome */}
            <div>
              <label style={labelStyle}>
                <User className="w-3.5 h-3.5" /> Nome
              </label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo" style={inputStyle} />
            </div>

            {/* WhatsApp */}
            <div>
              <label style={labelStyle}>
                <Phone className="w-3.5 h-3.5" /> WhatsApp
              </label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999" style={inputStyle} />
            </div>

            {/* E-mail — todos exceto portaria */}
            {!isFuncionario && (
              <div>
                <label style={labelStyle}>
                  <Mail className="w-3.5 h-3.5" /> E-mail
                </label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com" style={inputStyle} />
              </div>
            )}

            {/* Salvar */}
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              style={{
                width: "100%", padding: "14px", borderRadius: "12px", border: "none",
                background: saving ? "#94a3b8" : "linear-gradient(135deg, #0062d1 0%, #003580 100%)",
                color: "#ffffff", fontWeight: 700, fontSize: "15px", cursor: saving ? "wait" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                boxShadow: "0 4px 12px rgba(99,102,241,0.3)", marginTop: "4px",
              }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </div>

        {/* ═══════ TOQUE DE CHAMADA ═══════ */}
        <div
          onClick={() => navigate("/configuracao-toque")}
          style={{
            background: "#fff", borderRadius: "16px", padding: "20px",
            border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Volume2 className="w-4 h-4" style={{ color: "#003580" }} />
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                Toque de Chamada
              </h2>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0" }}>
                Escolha o som do interfone
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5" style={{ color: "#94a3b8" }} />
        </div>

        {/* ═══════ TEMA VISUAL ═══════ */}
        <div style={{
          background: "#fff", borderRadius: "16px", padding: "20px",
          border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <Palette className="w-4 h-4" style={{ color: "#003580" }} />
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                Tema Visual
              </h2>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0" }}>
                Escolha a aparência do sistema
              </p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {THEME_LIST.map((t) => {
              const isActive = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id as ThemeId)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px",
                    borderRadius: "12px",
                    border: isActive ? "2px solid #003580" : "2px solid #e2e8f0",
                    background: isActive ? "rgba(0,53,128,0.06)" : "#fff",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: t.swatch,
                    border: isActive ? "2px solid #003580" : "2px solid #e2e8f0",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    {isActive && <Check style={{ width: 16, height: 16, color: t.id === "light" ? "#003580" : "#fff" }} />}
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: isActive ? 700 : 500, color: isActive ? "#003580" : "#1e293b" }}>
                    {t.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══════ WHATSAPP NO INTERFONE ═══════ */}
        {(isMorador || isFuncionario) && (
          <div style={{
            background: "#fff", borderRadius: "16px", padding: "20px",
            border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                <MessageCircle className="w-4 h-4" style={{ color: "#25d366" }} />
                <div>
                  <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                    WhatsApp no Interfone
                  </h2>
                  <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0" }}>
                    {whatsappInterfone
                      ? "Visitantes podem te contactar pelo WhatsApp"
                      : "Permitir que visitantes enviem WhatsApp"}
                  </p>
                  {whatsappInterfone && !phone && (
                    <p style={{ fontSize: "11px", color: "#dc2626", margin: "4px 0 0", fontWeight: 600 }}>
                      ⚠️ Preencha seu WhatsApp acima para funcionar
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={async () => {
                  setSavingWhatsapp(true);
                  const newVal = !whatsappInterfone;
                  try {
                    const configRes = await apiFetch("/api/interfone/config");
                    const currentConfig = configRes.ok ? await configRes.json() : {};
                    const res = await apiFetch("/api/interfone/config", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        ...currentConfig,
                        whatsapp_interfone: newVal ? "1" : "0",
                      }),
                    });
                    if (res.ok) {
                      setWhatsappInterfone(newVal);
                      showSuccess(newVal
                        ? "WhatsApp habilitado no interfone!"
                        : "WhatsApp desabilitado no interfone.");
                    } else {
                      showError("Erro ao salvar configuração.");
                    }
                  } catch {
                    showError("Erro de conexão.");
                  } finally {
                    setSavingWhatsapp(false);
                  }
                }}
                disabled={savingWhatsapp}
                style={{
                  width: "52px", height: "28px", borderRadius: "14px", border: "none",
                  background: whatsappInterfone ? "#25d366" : "#cbd5e1",
                  cursor: savingWhatsapp ? "wait" : "pointer",
                  position: "relative", transition: "background 0.2s",
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: "22px", height: "22px", borderRadius: "50%",
                  background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  position: "absolute", top: "3px",
                  left: whatsappInterfone ? "27px" : "3px",
                  transition: "left 0.2s",
                }} />
              </button>
            </div>
          </div>
        )}

        {/* ═══════ ALTERAR SENHA ═══════ */}
        <div style={{
          background: "#fff", borderRadius: "16px", padding: "20px",
          border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <button
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <h2 style={{
              fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: 0,
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <Lock className="w-4 h-4" style={{ color: "#f59e0b" }} />
              Alterar Senha
            </h2>
            <svg
              className="w-5 h-5"
              style={{
                color: "#94a3b8", transition: "transform 0.2s",
                transform: showPasswordSection ? "rotate(180deg)" : "rotate(0)",
              }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showPasswordSection && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" }}>
              {/* Senha atual */}
              <div>
                <label style={labelStyle}>Senha Atual</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Digite sua senha atual"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    style={{
                      position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", padding: "2px",
                    }}
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" style={{ color: "#94a3b8" }} /> : <Eye className="w-4 h-4" style={{ color: "#94a3b8" }} />}
                  </button>
                </div>
              </div>

              {/* Nova senha */}
              <div>
                <label style={labelStyle}>Nova Senha</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    style={{
                      position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", padding: "2px",
                    }}
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" style={{ color: "#94a3b8" }} /> : <Eye className="w-4 h-4" style={{ color: "#94a3b8" }} />}
                  </button>
                </div>
              </div>

              {/* Confirmar nova senha */}
              <div>
                <label style={labelStyle}>Confirmar Nova Senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  style={inputStyle}
                />
              </div>

              {/* Botão alterar */}
              <button
                onClick={handleChangePassword}
                disabled={savingPw}
                style={{
                  width: "100%", padding: "14px", borderRadius: "12px", border: "none",
                  background: savingPw ? "#94a3b8" : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  color: "#fff", fontWeight: 700, fontSize: "15px", cursor: savingPw ? "wait" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
                }}
              >
                {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {savingPw ? "Alterando..." : "Alterar Senha"}
              </button>
            </div>
          )}
        </div>

        {/* ═══════ EXCLUIR CONTA — somente morador ═══════ */}
        {isMorador && (
          <div style={{
            background: "#fff", borderRadius: "16px", padding: "20px",
            border: "1px solid #fecaca", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <button
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
            >
              <h2 style={{
                fontSize: "15px", fontWeight: 700, color: "#dc2626", margin: 0,
                display: "flex", alignItems: "center", gap: "8px",
              }}>
                <Trash2 className="w-4 h-4" style={{ color: "#dc2626" }} />
                Excluir Minha Conta
              </h2>
              <svg
                className="w-5 h-5"
                style={{
                  color: "#fca5a5", transition: "transform 0.2s",
                  transform: showDeleteConfirm ? "rotate(180deg)" : "rotate(0)",
                }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDeleteConfirm && (
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{
                  padding: "12px 16px", borderRadius: "10px", background: "#fef2f2",
                  border: "1px solid #fecaca",
                }}>
                  <p style={{ fontSize: "13px", color: "#991b1b", margin: 0, lineHeight: 1.6 }}>
                    <strong>⚠️ Atenção:</strong> Esta ação é irreversível. Todos os seus dados, autorizações e histórico serão permanentemente excluídos.
                  </p>
                </div>

                <div>
                  <label style={{ ...labelStyle, color: "#dc2626" }}>
                    Digite <strong>EXCLUIR</strong> para confirmar
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                    placeholder="EXCLUIR"
                    style={{ ...inputStyle, borderColor: "#fecaca", textAlign: "center", fontWeight: 700, letterSpacing: "2px" }}
                  />
                </div>

                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirmText !== "EXCLUIR"}
                  style={{
                    width: "100%", padding: "14px", borderRadius: "12px", border: "none",
                    background: deleteConfirmText === "EXCLUIR"
                      ? (deleting ? "#94a3b8" : "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)")
                      : "#e2e8f0",
                    color: deleteConfirmText === "EXCLUIR" ? "#fff" : "#94a3b8",
                    fontWeight: 700, fontSize: "15px",
                    cursor: deleteConfirmText === "EXCLUIR" && !deleting ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    boxShadow: deleteConfirmText === "EXCLUIR" ? "0 4px 12px rgba(220,38,38,0.3)" : "none",
                  }}
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deleting ? "Excluindo..." : "Excluir Minha Conta"}
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
