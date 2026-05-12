import { useState, useEffect, useRef } from "react";
import { compressCanvas } from "@/lib/imageUtils";
import {
  UserPlus,
  Camera,
  FileText,
  Send,
  CheckCircle2,
  X,
  ChevronDown,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const API = "/api";

export default function AutoCadastroVisitante() {
  const [form, setForm] = useState({
    nome: "",
    documento: "",
    telefone: "",
    foto: "",
    documento_foto: "",
    bloco: "",
    apartamento: "",
    observacoes: "",
  });
  const [saving, setSaving] = useState(false);
  const [savingText, setSavingText] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [naoSeiBloco, setNaoSeiBloco] = useState(false);

  // Blocos e unidades do condomínio
  const [blocos, setBlocos] = useState<{ id: number; name: string; condominio_id?: number; unidades: string[] }[]>([]);
  const [loadingBlocos, setLoadingBlocos] = useState(true);
  const [condominioId, setCondominioId] = useState<number | null>(null);
  const [requiredFields, setRequiredFields] = useState({
    photo: false,
    document: false,
    phone: false,
    reason: false,
    docPhoto: false,
  });

  useEffect(() => {
    // condominio_id vem da URL (QR Code aponta para /visitante/auto-cadastro?cid=NN)
    const params = new URLSearchParams(globalThis.location.search);
    const cidParam = params.get("cid") || params.get("condominio_id");
    const cid = cidParam ? Number(cidParam) : NaN;
    if (!Number.isInteger(cid) || cid <= 0) {
      setError("Link inválido: condomínio não identificado. Escaneie o QR Code novamente.");
      setLoadingBlocos(false);
      return;
    }
    setCondominioId(cid);

    apiFetch(`${API}/blocos/public?condominio_id=${cid}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setBlocos(data);
      })
      .catch(() => {})
      .finally(() => setLoadingBlocos(false));

    apiFetch(`${API}/condominio-config/public?condominio_id=${cid}`)
      .then((r) => r.json())
      .then((data) => {
        setRequiredFields({
          photo: data.require_visit_photo === "true",
          document: data.require_visit_document === "true",
          phone: data.require_visit_phone === "true",
          reason: data.require_visit_reason === "true",
          docPhoto: data.require_visit_doc_photo === "true",
        });
      })
      .catch(() => {});
  }, []);

  // Unidades do bloco selecionado
  const unidadesDoBloco = blocos.find((b) => b.name === form.bloco)?.unidades || [];

  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraMode, setCameraMode] = useState<"foto" | "documento" | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Camera
  const startCamera = async (mode: "foto" | "documento") => {
    setCameraMode(mode);
    setCameraReady(false);
    try {
      // Tenta com facingMode primeiro, fallback para qualquer câmera
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode === "foto" ? "user" : "environment" },
        });
      } catch {
        // Fallback: pega qualquer câmera disponível
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      setCameraActive(true);

      // Pequeno delay para garantir que o ref do video já está no DOM
      await new Promise((r) => setTimeout(r, 100));

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onplaying = () => setCameraReady(true);
        try {
          await videoRef.current.play();
        } catch {
          // autoPlay já cuida disso
        }
      }
    } catch {
      setError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = compressCanvas(canvas, cameraMode === "foto" ? "face" : "document");
      if (cameraMode === "foto") {
        setForm((prev) => ({ ...prev, foto: dataUrl }));
      } else {
        setForm((prev) => ({ ...prev, documento_foto: dataUrl }));
      }
    }
    stopCamera();
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
      videoRef.current.onplaying = null;
    }
    setCameraActive(false);
    setCameraMode(null);
    setCameraReady(false);
  };

  // Submit
  const handleSubmit = async () => {
    if (!form.nome.trim()) {
      setError("Por favor, informe seu nome.");
      return;
    }
    if (requiredFields.photo && !form.foto) {
      setError("Por favor, tire uma foto.");
      return;
    }
    if (requiredFields.document && !form.documento.trim()) {
      setError("Por favor, informe o documento (RG/CPF).");
      return;
    }
    if (requiredFields.phone && !form.telefone.trim()) {
      setError("Por favor, informe seu telefone.");
      return;
    }
    if (requiredFields.reason && !form.observacoes.trim()) {
      setError("Por favor, informe o motivo da visita.");
      return;
    }
    if (requiredFields.docPhoto && !form.documento_foto) {
      setError("Por favor, tire uma foto do documento.");
      return;
    }
    setError("");
    setSaving(true);
    setSavingText("Enviando...");

    try {
      const res = await apiFetch(`${API}/visitors/self-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, condominio_id: condominioId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao enviar cadastro.");
        setSaving(false);
        return;
      }

      setDone(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
      setSavingText("");
    }
  };

  if (done) {
    return (
      <div role="status" aria-live="polite" className="min-h-dvh flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4 text-center" style={{ padding: "24px" }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: "#dcfce7" }}>
            <CheckCircle2 aria-hidden="true" className="w-10 h-10" style={{ color: "#16a34a" }} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Cadastro Enviado!</h2>
          <p className="text-sm text-gray-500">
            Seus dados foram enviados para a portaria. Aguarde a autorização do morador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">
      {/* Camera modal */}
      {cameraActive && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ height: "100dvh" }}>
          <div className="flex items-center justify-between p-4" style={{ flexShrink: 0 }}>
            <span className="text-white font-medium">
              {cameraMode === "foto" ? "Sua Foto" : "Foto do Documento"}
            </span>
            <button onClick={stopCamera} aria-label="Fechar câmera" style={{ color: "#fff" }}>
              <X aria-hidden="true" className="w-6 h-6" />
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <video
              ref={videoRef}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              autoPlay
              playsInline
              muted
            />
            {!cameraReady && (
              <div role="status" aria-live="polite" className="absolute inset-0 flex items-center justify-center">
                <Loader2 aria-hidden="true" className="w-10 h-10 text-white animate-spin" />
                <span className="sr-only">Iniciando câmera…</span>
              </div>
            )}
          </div>
          <div style={{ flexShrink: 0, padding: "16px 0 24px", display: "flex", justifyContent: "center" }}>
            <button
              onClick={capturePhoto}
              disabled={!cameraReady}
              className="rounded-full bg-white flex items-center justify-center transition-opacity"
              style={{ border: "4px solid rgba(255,255,255,0.5)", opacity: cameraReady ? 1 : 0.4, padding: "16px 32px", gap: "8px" }}
            >
              <Camera className="w-6 h-6 text-gray-800" />
              <span className="text-gray-800 font-bold text-sm">Clique aqui para tirar foto</span>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ color: "#fff", background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", padding: "24px 24px 32px" }}>
        <div className="flex items-center gap-2 mb-2">
          <UserPlus className="w-5 h-5" />
          <span className="font-semibold text-sm">Auto Cadastro de Visitante</span>
        </div>
        <p className="text-sky-100 text-[13px]">
          Preencha seus dados abaixo para solicitar a entrada no condomínio.
        </p>
      </div>

      {/* Form */}
      <div style={{ padding: "20px 24px", flex: 1 }}>
        {error && (
          <div role="alert" aria-live="assertive" className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
        )}

        <div className="space-y-4">
          {/* Foto */}
          <div>
            <label className="text-sm font-medium text-gray-800 mb-2 block">
              Sua Foto{requiredFields.photo ? " *" : ""}
              {!requiredFields.photo && <span className="text-gray-400 font-normal ml-1">(opcional)</span>}
            </label>
            {form.foto ? (
              <div className="relative w-24 h-24 rounded-xl overflow-hidden">
                <img src={form.foto} alt="Foto" className="w-full h-full object-cover" />
                <button
                  onClick={() => setForm({ ...form, foto: "" })}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => startCamera("foto")}
                className="w-24 h-24 rounded-xl flex flex-col items-center justify-center gap-1"
                style={{ border: "2px dashed #d1d5db" }}
              >
                <Camera className="w-6 h-6 text-gray-400" />
                <span className="text-[10px] text-gray-400">Tirar foto</span>
              </button>
            )}
          </div>

          {/* Nome */}
          <div>
            <label className="text-sm font-medium text-gray-800 mb-1 block">Nome completo *</label>
            <input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Seu nome"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </div>

          {/* Documento */}
          <div>
            <label className="text-sm font-medium text-gray-800 mb-1 block">
              Documento (RG/CPF){requiredFields.document ? " *" : ""}
              {!requiredFields.document && <span className="text-gray-400 font-normal ml-1">(opcional)</span>}
            </label>
            <input
              value={form.documento}
              onChange={(e) => setForm({ ...form, documento: e.target.value })}
              placeholder="Número do documento"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </div>

          {/* Telefone */}
          <div>
            <label className="text-sm font-medium text-gray-800 mb-1 block">
              Seu Telefone{requiredFields.phone ? " *" : ""}
              {!requiredFields.phone && <span className="text-gray-400 font-normal ml-1">(opcional)</span>}
            </label>
            <input
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="(11) 99999-9999"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          </div>

          {/* Checkbox "Não sei o bloco" */}
          <div className="flex items-start gap-2 mt-4">
            <input
              type="checkbox"
              id="naoSeiBloco"
              checked={naoSeiBloco}
              onChange={(e) => {
                setNaoSeiBloco(e.target.checked);
                if (e.target.checked) {
                  setForm({ ...form, bloco: "", apartamento: "" });
                }
              }}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
            />
            <label htmlFor="naoSeiBloco" className="text-sm text-gray-600 flex items-center gap-1">
              <HelpCircle className="w-4 h-4 text-amber-500" />
              Não sei o bloco ou apartamento do morador
            </label>
          </div>

          {naoSeiBloco && (
            <div className="p-3 rounded-lg bg-amber-50 text-amber-700 text-xs mt-1">
              Sem problema! A portaria irá identificar o bloco e apartamento quando você chegar.
            </div>
          )}

          {/* Bloco - Dropdown */}
          {!naoSeiBloco && (
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-800 mb-1 block">Bloco que vai visitar</label>
              {loadingBlocos ? (
                <div className="flex items-center gap-2 h-10 px-3 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando blocos...
                </div>
              ) : blocos.length === 0 ? (
                <input
                  value={form.bloco}
                  onChange={(e) => setForm({ ...form, bloco: e.target.value, apartamento: "" })}
                  placeholder="Ex: Bloco A"
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                />
              ) : (
                <div className="relative">
                  <select
                    value={form.bloco}
                    onChange={(e) => setForm({ ...form, bloco: e.target.value, apartamento: "" })}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 appearance-none"
                  >
                    <option value="">Selecione o bloco</option>
                    {blocos.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              )}
            </div>
          )}

          {/* Apartamento - Dropdown */}
          {!naoSeiBloco && (
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-800 mb-1 block">Apartamento</label>
              {form.bloco && unidadesDoBloco.length > 0 ? (
                <div className="relative">
                  <select
                    value={form.apartamento}
                    onChange={(e) => setForm({ ...form, apartamento: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 appearance-none"
                  >
                    <option value="">Selecione o apartamento</option>
                    {unidadesDoBloco.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              ) : (
                <input
                  value={form.apartamento}
                  onChange={(e) => setForm({ ...form, apartamento: e.target.value })}
                  placeholder={form.bloco ? "Digite o apartamento" : "Selecione o bloco primeiro"}
                  disabled={!form.bloco && blocos.length > 0}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-50 disabled:bg-gray-50"
                />
              )}
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="text-sm font-medium text-gray-800 mb-1 block">
              Observações{requiredFields.reason ? " *" : ""}
              {!requiredFields.reason && <span className="text-gray-400 font-normal ml-1">(opcional)</span>}
            </label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Descreva o motivo da sua visita: Visita pessoal, reunião com Sr. Mario, etc."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 resize-none"
            />
          </div>

          {/* Anexar documento */}
          <div>
            <label className="text-sm font-medium text-gray-800 mb-2 block">
              Foto do Documento{requiredFields.docPhoto ? " *" : ""}
              {!requiredFields.docPhoto && <span className="text-gray-400 font-normal ml-1">(opcional)</span>}
            </label>
            {form.documento_foto ? (
              <div className="relative w-full h-32 rounded-xl overflow-hidden">
                <img src={form.documento_foto} alt="Documento" className="w-full h-full object-cover" />
                <button
                  onClick={() => setForm({ ...form, documento_foto: "" })}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => startCamera("documento")}
                className="w-full h-20 rounded-xl flex items-center justify-center gap-2"
                style={{ border: "2px dashed #d1d5db" }}
              >
                <FileText className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-400">Fotografar documento</span>
              </button>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full h-12 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", marginTop: "12px" }}
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{savingText || "Enviando..."}</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Enviar Cadastro
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
