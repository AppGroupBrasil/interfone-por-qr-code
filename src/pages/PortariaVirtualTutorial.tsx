import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Wifi,
  DoorOpen,
  ChevronDown,
  ChevronUp,
  Zap,
  Wrench,
  Cable,
  Plug,
  Smartphone,
  ClipboardCheck,
  Info,
  CheckCircle2,
  ExternalLink,
  ShoppingCart,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

/* ═══════════════════════════════════════════════
   TUTORIAL PÚBLICO — Portaria Virtual (IoT)
   Cópia exata do tutorial de PortariaVirtual.tsx
   Acessível sem login, via landing page
   ═══════════════════════════════════════════════ */

export default function PortariaVirtualTutorial() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();
  const [openStep, setOpenStep] = useState<number | null>(null);

  const tutorialSteps = [
    {
      num: 1,
      title: "ESCOLHA SEU DISPOSITIVO",
      icon: <ClipboardCheck className="w-6 h-6" />,
      color: "#6366f1",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ fontSize: "15px", lineHeight: 1.7, color: "#374151" }}>
            Voce tem <strong>2 opcoes</strong> de dispositivo. Recomendamos a <strong>Opcao 1</strong> (mais facil e mais barata).
          </p>

          {/* OPTION 1: Mini Smart Switch */}
          <div style={{ background: "#f0fdf4", borderRadius: "12px", padding: "16px", border: "2px solid #16a34a" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span style={{ background: "#16a34a", color: p.text, fontWeight: 800, fontSize: "13px", padding: "4px 10px", borderRadius: "6px" }}>OPCAO 1 — RECOMENDADA</span>
            </div>
            <p style={{ fontWeight: 800, fontSize: "16px", color: "#166534", marginBottom: "4px" }}>Mini Smart Switch (Tasmota)</p>
            <p style={{ fontSize: "13px", color: "#374151", lineHeight: 1.7, marginBottom: "12px" }}>
              Interruptor inteligente <strong>compacto e completo</strong> — WiFi + rele + alimentacao tudo em 1 peca.
              So liga 2 fios no motor e pronto!
            </p>
            <div style={{ background: "#fff", borderRadius: "8px", padding: "12px", border: "1px solid #d1fae5", marginBottom: "8px" }}>
              <p style={{ fontWeight: 700, fontSize: "14px", color: "#374151" }}>
                <ShoppingCart className="w-4 h-4 inline-block mr-1" style={{ verticalAlign: "-2px", color: "#16a34a" }} />
                1 x Mini Smart Switch WiFi
              </p>
              <p style={{ fontSize: "13px", color: "#16a34a", fontWeight: 700, marginTop: "4px" }}>R$20~35</p>
              <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                {[
                  { loja: "Mercado Livre", url: "https://lista.mercadolivre.com.br/mini-smart-switch-wifi" },
                  { loja: "Shopee", url: "https://shopee.com.br/search?keyword=mini%20smart%20switch%20wifi" },
                  { loja: "Amazon", url: "https://www.amazon.com.br/s?k=sonoff+mini+r2" },
                ].map((link) => (
                  <a key={link.loja} href={link.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: "11px", color: "#2d3354", textDecoration: "none", padding: "3px 8px", borderRadius: "4px", background: "#eef0f5", display: "flex", alignItems: "center", gap: "3px" }}>
                    {link.loja} <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
            <div style={{ background: "#ecfdf5", borderRadius: "8px", padding: "8px 12px", textAlign: "center" }}>
              <p style={{ fontWeight: 800, fontSize: "15px", color: "#16a34a" }}>CUSTO: R$22 a R$37 por portao</p>
            </div>
          </div>

          {/* OPTION 2: ESP32 */}
          <div style={{ background: "#f9fafb", borderRadius: "12px", padding: "16px", border: "1px solid #d1d5db" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span style={{ background: "#6b7280", color: p.text, fontWeight: 800, fontSize: "13px", padding: "4px 10px", borderRadius: "6px" }}>OPCAO 2 — ALTERNATIVA</span>
            </div>
            <p style={{ fontWeight: 800, fontSize: "16px", color: "#374151", marginBottom: "4px" }}>ESP32 DevKit + Modulo Rele</p>
            <p style={{ fontSize: "13px", color: "#6b7280", lineHeight: 1.7, marginBottom: "12px" }}>
              Monta voce mesmo: placa ESP32 + rele + fios + fonte USB. Mais passos na instalacao.
            </p>

            {[
              { nome: "1 x ESP32 DevKit V1", preco: "R$25~40", links: [
                { loja: "Mercado Livre", url: "https://lista.mercadolivre.com.br/esp32-devkit" },
                { loja: "Shopee", url: "https://shopee.com.br/search?keyword=esp32%20devkit" },
              ]},
              { nome: "1 x Modulo Rele 1 Canal 5V", preco: "R$8~12", links: [
                { loja: "Mercado Livre", url: "https://lista.mercadolivre.com.br/modulo-rele-1-canal-5v" },
              ]},
              { nome: "Fonte USB 5V + Cabo + 3 Jumpers + Fio", preco: "R$15~22", links: [] },
            ].map((item, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: "8px", padding: "10px", border: "1px solid #e5e7eb", marginBottom: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontWeight: 700, fontSize: "13px", color: "#374151" }}>{item.nome}</p>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "#d97706" }}>{item.preco}</p>
                </div>
                {item.links.length > 0 && (
                  <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                    {item.links.map((link) => (
                      <a key={link.loja} href={link.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: "11px", color: "#2d3354", textDecoration: "none", padding: "2px 6px", borderRadius: "4px", background: "#eef0f5" }}>
                        {link.loja} ↗
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div style={{ background: "#f3f4f6", borderRadius: "8px", padding: "8px 12px", textAlign: "center", marginTop: "4px" }}>
              <p style={{ fontWeight: 800, fontSize: "15px", color: "#6b7280" }}>CUSTO: R$50 a R$75 por portao</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      num: 2,
      title: "VERIFICAR O WIFI DO CONDOMINIO",
      icon: <Wifi className="w-6 h-6" />,
      color: "#0ea5e9",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ fontSize: "15px", lineHeight: 1.7, color: "#374151" }}>
            O ESP32 precisa de WiFi para funcionar. Antes de instalar, verifique se chega sinal perto do motor do portao.
          </p>

          <div style={{ background: "#fff", borderRadius: "12px", padding: "16px", border: "2px solid #0ea5e9" }}>
            <p style={{ fontWeight: 700, color: "#0c4a6e", marginBottom: "10px" }}>COMO TESTAR:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                "Pegue seu celular e va ate o motor do portao",
                "Conecte no WiFi do condominio",
                "Abra o Google ou qualquer site",
                "Se o site abriu = WiFi OK! Pode prosseguir.",
                "Se NAO abriu = precisa de um repetidor de WiFi (R$50~80)",
              ].map((txt, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <span style={{
                    width: "24px", height: "24px", borderRadius: "50%",
                    background: i === 4 ? "#fef2f2" : "#f0fdf4",
                    color: i === 4 ? "#dc2626" : "#16a34a",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: "13px", flexShrink: 0,
                  }}>
                    {i + 1}
                  </span>
                  <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.5 }}>{txt}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#fffbeb", borderRadius: "8px", padding: "12px", border: "1px solid #fde68a" }}>
            <p style={{ fontSize: "13px", color: "#92400e" }}>
              <strong>DICA:</strong> Se nao tem WiFi no condominio, o sindico pode contratar internet so
              para a portaria. Um plano basico de 50 megas (R$70/mes) ja e suficiente.
            </p>
          </div>
        </div>
      ),
    },
    {
      num: 3,
      title: "INSTALAR O MINI SMART SWITCH (OPCAO 1)",
      icon: <Zap className="w-6 h-6" />,
      color: "#16a34a",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "#f0fdf4", borderRadius: "12px", padding: "16px", border: "2px solid #16a34a" }}>
            <p style={{ fontWeight: 700, fontSize: "15px", color: "#166534", marginBottom: "8px" }}>SE VOCE ESCOLHEU O MINI SMART SWITCH:</p>
            <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#374151" }}>
              O Mini Smart Switch e muito mais simples de instalar que o ESP32. Ele liga direto na rede eletrica
              e tem bornes (parafusinhos) prontos para conectar. Siga estes passos:
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ background: "#fff", borderRadius: "8px", padding: "14px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontWeight: 700, color: "#059669" }}>1. Flashear com Tasmota (so 1 vez)</p>
              <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Use o site <strong>tasmota.github.io/install</strong> no computador. Conecte o switch via USB (se tiver porta)
                ou use <strong>Tuya-Convert</strong> pelo celular (OTA, sem fios). Escolha o firmware "Tasmota Lite".
              </p>
            </div>

            <div style={{ background: "#fff", borderRadius: "8px", padding: "14px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontWeight: 700, color: "#059669" }}>2. Configurar o WiFi no Tasmota</p>
              <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Apos flashear, o switch cria uma rede WiFi "tasmota-XXXX". Conecte nela pelo celular,
                vai abrir uma pagina automatica. Digite o nome e senha do WiFi do condominio. Pronto!
              </p>
            </div>

            <div style={{ background: "#fff", borderRadius: "8px", padding: "14px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontWeight: 700, color: "#059669" }}>3. Ache o IP do dispositivo</p>
              <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Depois de conectar no WiFi, abra o navegador e acesse o roteador (geralmente 192.168.1.1)
                para ver o IP que foi atribuido ao switch. Anote esse IP.
              </p>
            </div>

            <div style={{ background: "#fff", borderRadius: "8px", padding: "14px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontWeight: 700, color: "#059669" }}>4. Abrir o motor do portao</p>
              <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Abra a tampa do motor com chave Phillips. Procure os bornes marcados
                <strong> "FECHA"</strong> (ou FC/CLOSE) e <strong>"COM"</strong> (ou COMUM/COMMON).
              </p>
            </div>

            <div style={{ background: "#f0fdf4", borderRadius: "12px", padding: "14px", border: "2px solid #16a34a" }}>
              <p style={{ fontWeight: 700, fontSize: "15px", color: "#16a34a", marginBottom: "8px" }}>5. Ligar os fios — SO 2 FIOS!</p>
              <p style={{ fontSize: "14px", color: "#374151" }}>
                O Mini Smart Switch tem bornes marcados <strong>S1</strong> e <strong>S2</strong>. Ligue assim:
              </p>
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ background: "#fff", borderRadius: "8px", padding: "10px", border: "1px solid #bbf7d0" }}>
                  <p style={{ fontWeight: 700, color: "#16a34a" }}>FIO 1: Borne S1 do Switch → Borne FECHA do Motor</p>
                </div>
                <div style={{ background: "#fff", borderRadius: "8px", padding: "10px", border: "1px solid #bbf7d0" }}>
                  <p style={{ fontWeight: 700, color: "#16a34a" }}>FIO 2: Borne S2 do Switch → Borne COM do Motor</p>
                </div>
              </div>
              <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "8px" }}>
                Desencape as pontas dos fios (1cm), coloque no borne e aperte o parafuso.
              </p>
            </div>

            <div style={{ background: "#fff", borderRadius: "8px", padding: "14px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontWeight: 700, color: "#059669" }}>6. Alimentar o switch</p>
              <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                O Mini Smart Switch alimenta direto na rede eletrica (100-240V). Ligue os bornes
                <strong> L-In</strong> e <strong>N-In</strong> na fase e neutro da tomada mais proxima (peca a um eletricista se nao souber).
                Os bornes L-Out e N-Out nao sao usados neste caso.
              </p>
            </div>

            <div style={{ background: "#fff", borderRadius: "8px", padding: "14px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontWeight: 700, color: "#059669" }}>7. Configurar PulseTime no Tasmota</p>
              <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Acesse o IP do switch no navegador. Va em <strong>Console</strong> e digite: <strong>PulseTime 10</strong>
                (isso faz o rele ligar por 1 segundo e desligar automatico — perfeito para portao).
              </p>
            </div>
          </div>

          <div style={{ background: "#ecfdf5", borderRadius: "8px", padding: "12px", border: "1px solid #a7f3d0", textAlign: "center" }}>
            <p style={{ fontWeight: 800, fontSize: "15px", color: "#16a34a" }}>
              PRONTO! Pule direto para o Passo 8 (Testar pelo App)
            </p>
            <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
              Os Passos 4, 5, 6 e 7 sao apenas para quem escolheu ESP32+Rele.
            </p>
          </div>
        </div>
      ),
    },
    {
      num: 4,
      title: "ABRIR O MOTOR DO PORTAO (ESP32)",
      icon: <Wrench className="w-6 h-6" />,
      color: "#f59e0b",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "#fffbeb", borderRadius: "12px", padding: "16px", border: "1px solid #fde68a" }}>
            <p style={{ fontWeight: 700, fontSize: "15px", color: "#92400e", marginBottom: "8px" }}>NAO PRECISA TER MEDO!</p>
            <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#374151" }}>
              Voce NAO vai mexer na parte eletrica (220V). So vai ligar 2 fiozinhos de 5V
              (tipo pilha de controle remoto). E super seguro.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              "Desligue o motor na tomada (por seguranca, NAO E OBRIGATORIO mas recomendado)",
              "Ache os parafusos da tampa do motor (geralmente 2 ou 4 parafusos Phillips)",
              "Desparafuse e abra a tampa com cuidado",
              "Procure os BORNES DE LIGACAO (parafusos onde chegam fios)",
              'Ache o parafuso marcado "FECHA" (ou "FC" ou "CLOSE")',
              'Ache o parafuso marcado "COM" (ou "COMUM" ou "COMMON")',
            ].map((txt, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: "8px", padding: "12px", border: "1px solid #e5e7eb", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{
                  width: "28px", height: "28px", borderRadius: "50%",
                  background: "#f59e0b", color: p.text,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: "14px", flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <p style={{ fontSize: "14px", color: "#374151", lineHeight: 1.5 }}>{txt}</p>
              </div>
            ))}
          </div>

          <div style={{ background: "#fef2f2", borderRadius: "8px", padding: "12px", border: "1px solid #fecaca" }}>
            <p style={{ fontSize: "13px", color: "#991b1b" }}>
              <strong>IMPORTANTE:</strong> Nao desconecte nenhum fio que ja esta no motor!
              Voce so vai ADICIONAR fios novos. Todo mundo que ja usa o controle remoto continua usando normal.
            </p>
          </div>
        </div>
      ),
    },
    {
      num: 5,
      title: "LIGAR OS FIOS - PARTE 1 (ESP32 NO RELE)",
      icon: <Cable className="w-6 h-6" />,
      color: "#8b5cf6",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "#faf5ff", borderRadius: "12px", padding: "16px", border: "1px solid #e9d5ff" }}>
            <p style={{ fontWeight: 700, fontSize: "15px", color: "#5b21b6", marginBottom: "8px" }}>CONECTAR ESP32 NO MODULO RELE</p>
            <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#374151" }}>
              Pegue os 3 fios jumper (femea-femea) e ligue assim:
            </p>
          </div>

          <div style={{ background: "#fff", borderRadius: "12px", padding: "16px", border: "2px solid #8b5cf6" }}>
            <p style={{ fontWeight: 700, fontSize: "16px", color: "#5b21b6", marginBottom: "16px", textAlign: "center" }}>
              LIGUE OS 3 FIOS ASSIM:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { de: "Pino D26 do ESP32", para: "Pino IN do Rele", cor: "#3b82f6", corNome: "FIO AZUL (ou qualquer cor)" },
                { de: "Pino 5V do ESP32", para: "Pino VCC do Rele", cor: "#f59e0b", corNome: "FIO AMARELO (ou qualquer cor)" },
                { de: "Pino GND do ESP32", para: "Pino GND do Rele", cor: "#111827", corNome: "FIO PRETO (ou qualquer cor)" },
              ].map((fio, i) => (
                <div key={i} style={{ background: "#faf5ff", borderRadius: "8px", padding: "12px", border: "1px solid #e9d5ff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: fio.cor, display: "flex", alignItems: "center", justifyContent: "center", color: p.text, fontWeight: 700, fontSize: "14px", flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: "14px", color: "#374151" }}>
                        {fio.de} &rarr; {fio.para}
                      </p>
                      <p style={{ fontSize: "12px", color: "#9ca3af" }}>{fio.corNome}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "12px", textAlign: "center" }}>
              Os pinos tem o nome escrito na placa do ESP32. So olhar com atencao.
            </p>
          </div>

          <div style={{ background: "#f0fdf4", borderRadius: "8px", padding: "12px", border: "1px solid #bbf7d0" }}>
            <p style={{ fontSize: "13px", color: "#166534" }}>
              <strong>DICA:</strong> O fio jumper e aquele fiozinho com uma pontinha de plastico.
              Voce so ENCAIXA na ponta do ESP32. Nao precisa apertar parafuso nem soldar.
              Se nao encaixou, vire o fio e tente do outro lado.
            </p>
          </div>
        </div>
      ),
    },
    {
      num: 6,
      title: "LIGAR OS FIOS - PARTE 2 (RELE NO MOTOR)",
      icon: <Zap className="w-6 h-6" />,
      color: "#ef4444",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "#fef2f2", borderRadius: "12px", padding: "16px", border: "1px solid #fecaca" }}>
            <p style={{ fontWeight: 700, fontSize: "15px", color: "#991b1b", marginBottom: "8px" }}>AGORA VAMOS LIGAR NO MOTOR!</p>
            <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#374151" }}>
              Corte o fio paralelo em 2 pedacos. Desencape as pontas (tire 1cm do plastico com uma faca ou
              alicate). Agora ligue assim:
            </p>
          </div>

          <div style={{ background: "#fff", borderRadius: "12px", padding: "16px", border: "2px solid #ef4444" }}>
            <p style={{ fontWeight: 700, fontSize: "16px", color: "#dc2626", marginBottom: "16px", textAlign: "center" }}>
              LIGUE OS 2 FIOS ASSIM:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ background: "#fef2f2", borderRadius: "8px", padding: "14px", border: "1px solid #fecaca" }}>
                <p style={{ fontWeight: 700, fontSize: "15px", color: "#dc2626" }}>FIO 1:</p>
                <p style={{ fontSize: "14px", color: "#374151", marginTop: "4px" }}>
                  Parafuso <strong>COM</strong> do Rele &rarr; Parafuso <strong>FECHA</strong> do Motor
                </p>
                <p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "4px" }}>
                  (desparafuse, coloque a ponta do fio, reaparafuse)
                </p>
              </div>

              <div style={{ background: "#fef2f2", borderRadius: "8px", padding: "14px", border: "1px solid #fecaca" }}>
                <p style={{ fontWeight: 700, fontSize: "15px", color: "#dc2626" }}>FIO 2:</p>
                <p style={{ fontSize: "14px", color: "#374151", marginTop: "4px" }}>
                  Parafuso <strong>NO</strong> do Rele &rarr; Parafuso <strong>COM</strong> do Motor
                </p>
                <p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "4px" }}>
                  (NO quer dizer "Normalmente Aberto" - e o parafuso do meio do rele)
                </p>
              </div>
            </div>
          </div>

          <div style={{ background: "#fffbeb", borderRadius: "8px", padding: "12px", border: "1px solid #fde68a" }}>
            <p style={{ fontSize: "13px", color: "#92400e" }}>
              <strong>ATENCAO:</strong> Nao desconecte nenhum fio que ja estava ligado no motor!
              Os fios do controle remoto continuam onde estavam. Voce so ADICIONA 2 fios novos.
              O controle remoto e o app vao funcionar juntos.
            </p>
          </div>
        </div>
      ),
    },
    {
      num: 7,
      title: "LIGAR NA TOMADA",
      icon: <Plug className="w-6 h-6" />,
      color: "#10b981",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ background: "#fff", borderRadius: "8px", padding: "14px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontWeight: 700, color: "#059669" }}>1. Ache uma tomada perto do portao</p>
              <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Se nao tem tomada perto, use uma extensao.
              </p>
            </div>

            <div style={{ background: "#fff", borderRadius: "8px", padding: "14px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontWeight: 700, color: "#059669" }}>2. Plugue a fonte USB na tomada</p>
              <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                E igualzinho carregar um celular. A fonte vai na tomada.
              </p>
            </div>

            <div style={{ background: "#fff", borderRadius: "8px", padding: "14px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontWeight: 700, color: "#059669" }}>3. Conecte o cabo USB no ESP32</p>
              <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                O cabo micro USB vai na entradinha do ESP32 (igual entrada de celular antigo).
              </p>
            </div>

            <div style={{ background: "#f0fdf4", borderRadius: "12px", padding: "14px", border: "2px solid #16a34a" }}>
              <p style={{ fontWeight: 700, fontSize: "15px", color: "#16a34a" }}>4. Uma luzinha azul acendeu no ESP32?</p>
              <p style={{ fontSize: "14px", color: "#374151", marginTop: "4px" }}>
                <strong style={{ color: "#16a34a" }}>SIM</strong> = Esta ligado! Funcionou! Va para o proximo passo.<br />
                <strong style={{ color: "#dc2626" }}>NAO</strong> = Verifique se o cabo esta bem encaixado. Tente outra tomada.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      num: 8,
      title: "TESTAR PELO APLICATIVO",
      icon: <Smartphone className="w-6 h-6" />,
      color: "#06b6d4",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "#ecfeff", borderRadius: "12px", padding: "16px", border: "1px solid #a5f3fc" }}>
            <p style={{ fontWeight: 700, fontSize: "15px", color: "#155e75", marginBottom: "8px" }}>HORA DO TESTE!</p>
            <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#374151" }}>
              Se chegou ate aqui, esta quase pronto! Agora vamos testar se tudo funciona.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ background: "#fff", borderRadius: "8px", padding: "14px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontWeight: 700, color: "#059669" }}>1. Abra o app no celular</p>
              <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Entre com seu login e va ate esta tela (Portaria Virtual).
              </p>
            </div>

            <div style={{ background: "#fff", borderRadius: "8px", padding: "14px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontWeight: 700, color: "#059669" }}>2. Va na aba "Configuracao"</p>
              <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Digite o IP do ESP32 (aparece na tela do computador quando voce programa ele) e o token de seguranca.
              </p>
            </div>

            <div style={{ background: "#fff", borderRadius: "8px", padding: "14px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontWeight: 700, color: "#059669" }}>3. Va na aba "Controle"</p>
              <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Verifique se o status esta "ONLINE" (bolinha verde). Se sim, toque no botao grande "ABRIR PORTAO".
              </p>
            </div>

            <div style={{ background: "#f0fdf4", borderRadius: "12px", padding: "14px", border: "2px solid #16a34a" }}>
              <p style={{ fontWeight: 700, fontSize: "15px", color: "#16a34a" }}>4. O portao abriu?</p>
              <p style={{ fontSize: "14px", color: "#374151", marginTop: "4px" }}>
                <strong style={{ color: "#16a34a" }}>SIM</strong> = PARABENS! Instalacao concluida com sucesso!<br />
                <strong style={{ color: "#dc2626" }}>NAO</strong> = Revise os fios (Passo 4 e 5). Verifique se o WiFi esta funcionando (Passo 2).
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      num: 9,
      title: "ORGANIZAR E GUARDAR",
      icon: <ClipboardCheck className="w-6 h-6" />,
      color: "#16a34a",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ background: "#fff", borderRadius: "8px", padding: "14px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontWeight: 700, color: "#059669" }}>1. Coloque tudo dentro de uma caixinha</p>
              <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Compre uma caixinha plastica de sobrepor 4x2 (R$5 em loja de eletrica).
                Coloque o ESP32 e o rele dentro. Faca um furinho para passar os fios e o cabo USB.
              </p>
            </div>

            <div style={{ background: "#fff", borderRadius: "8px", padding: "14px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontWeight: 700, color: "#059669" }}>2. Fixe na parede</p>
              <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Use fita dupla face forte ou 2 parafusos. Fixe perto do motor do portao.
              </p>
            </div>

            <div style={{ background: "#fff", borderRadius: "8px", padding: "14px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontWeight: 700, color: "#059669" }}>3. Organize os fios</p>
              <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Use uma abracadeira (aquele plastico de prender fio) para deixar bonito.
              </p>
            </div>

            <div style={{ background: "#fff", borderRadius: "8px", padding: "14px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontWeight: 700, color: "#059669" }}>4. Feche a tampa do motor</p>
              <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                Recoloque os parafusos da tampa. Pronto, acabou!
              </p>
            </div>
          </div>

          <div style={{ background: "#f0fdf4", borderRadius: "12px", padding: "16px", border: "2px solid #16a34a", textAlign: "center" }}>
            <CheckCircle2 className="w-10 h-10 mx-auto" style={{ color: "#16a34a" }} />
            <p style={{ fontWeight: 700, fontSize: "18px", color: "#16a34a", marginTop: "8px" }}>
              INSTALACAO CONCLUIDA!
            </p>
            <p style={{ fontSize: "14px", color: "#374151", marginTop: "4px" }}>
              Agora os moradores podem abrir o portao pelo celular.
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "#ffffff", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{
        background: isDark ? "linear-gradient(135deg, #003580, #002a66)" : "#ffffff",
        padding: "18px 24px",
        paddingTop: "max(18px, env(safe-area-inset-top))",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => navigate("/")}
            style={{ background: "none", border: "none", color: p.text, cursor: "pointer", padding: "4px" }}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "18px", fontWeight: 700, color: p.text, display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
              <DoorOpen className="w-5 h-5" /> Portaria Virtual — Tutorial
            </h1>
            <p style={{ fontSize: "12px", color: isDark ? "rgba(255,255,255,0.7)" : "#475569", margin: 0, marginTop: "2px" }}>
              Guia de Instalação do Abridor de Portão IoT
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, overflowY: "auto", padding: "16px 24px 120px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
          {/* Intro */}
          <div style={{
            background: "linear-gradient(135deg, #eef0f5, #e0e2ea)",
            borderRadius: "16px",
            padding: "20px",
            border: "2px solid #2d3354",
            textAlign: "center",
          }}>
            <Info className="w-8 h-8 mx-auto" style={{ color: "#2d3354" }} />
            <p style={{ fontWeight: 800, fontSize: "17px", color: "#2d3354", marginTop: "8px" }}>
              COMO INSTALAR O ABRIDOR DE PORTAO
            </p>
            <p style={{ fontSize: "14px", color: "#374151", marginTop: "6px", lineHeight: 1.6 }}>
              Siga os passos abaixo, um de cada vez.
              Cada passo explica TUDO que voce precisa fazer.
              Qualquer pessoa consegue instalar!
            </p>
            <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "6px" }}>
              Tempo total: 30 a 40 minutos
            </p>
          </div>

          {/* Steps */}
          {tutorialSteps.map((step) => (
            <div
              key={step.num}
              style={{
                borderRadius: "14px",
                border: openStep === step.num ? `2px solid ${step.color}` : "2px solid #e5e7eb",
                overflow: "hidden",
                transition: "all 0.3s",
              }}
            >
              <button
                onClick={() => setOpenStep(openStep === step.num ? null : step.num)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "16px",
                  border: "none",
                  backgroundColor: openStep === step.num ? step.color : "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: openStep === step.num ? "rgba(255,255,255,0.25)" : step.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: p.text,
                  flexShrink: 0,
                }}>
                  {step.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: openStep === step.num ? "rgba(255,255,255,0.8)" : "#9ca3af",
                    textTransform: "uppercase",
                    margin: 0,
                  }}>
                    Passo {step.num} de 9
                  </p>
                  <p style={{
                    fontSize: "14px",
                    fontWeight: 800,
                    color: openStep === step.num ? "#fff" : "#374151",
                    marginTop: "2px",
                    margin: 0,
                  }}>
                    {step.title}
                  </p>
                </div>
                {openStep === step.num ? (
                  <ChevronUp className="w-5 h-5" style={{ color: p.text, flexShrink: 0 }} />
                ) : (
                  <ChevronDown className="w-5 h-5" style={{ color: "#9ca3af", flexShrink: 0 }} />
                )}
              </button>

              {openStep === step.num && (
                <div style={{ padding: "16px", backgroundColor: "#fafafa" }}>
                  {step.content}
                </div>
              )}
            </div>
          ))}

          {/* CTA to register */}
          <div style={{
            background: isDark ? "linear-gradient(135deg, #003580, #002a66)" : "#ffffff",
            borderRadius: "16px",
            padding: "24px",
            textAlign: "center",
            marginTop: "16px",
          }}>
            <p style={{ fontWeight: 800, fontSize: "17px", color: p.text, margin: 0 }}>
              Quer usar a Portaria Virtual?
            </p>
            <p style={{ fontSize: "14px", color: isDark ? "rgba(255,255,255,0.8)" : "#334155", marginTop: "8px", lineHeight: 1.6 }}>
              Assine o App Interfone e adicione o módulo IoT por apenas +R$200/mês
            </p>
            <button
              onClick={() => navigate("/register/condominio")}
              style={{
                marginTop: "16px",
                padding: "14px 32px",
                borderRadius: "12px",
                border: "2px solid #fff",
                background: isDark ? "rgba(255,255,255,0.15)" : "#f0f4f8",
                color: p.text,
                fontWeight: 700,
                fontSize: "15px",
                cursor: "pointer",
              }}
            >
              Testar Grátis 7 Dias
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
