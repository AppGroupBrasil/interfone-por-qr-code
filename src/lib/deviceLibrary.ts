/**
 * Biblioteca de Dispositivos – App Interfone
 * ─────────────────────────────────────────
 * Catálogo completo de hardware compatível com informações,
 * especificações, protocolos e guias de instalação.
 */

/* ── Tipos ─────────────────────────────────────── */

export type DeviceProtocol =
  | "ewelink"       // Sonoff / CoolKit cloud
  | "shelly_http"   // Shelly REST local
  | "esp_http"      // ESP32/ESP8266 HTTP
  | "tuya"          // Tuya / Smart Life cloud
  | "intelbras"     // Intelbras SIP / HTTP
  | "hikvision";    // Hikvision ISAPI / SDK

export type DeviceCategory =
  | "relay"         // Relé de acionamento (portão, fechadura)
  | "controller"    // Controladora de acesso
  | "intercom"      // Porteiro eletrônico / videoporteiro
  | "camera"        // Câmera IP
  | "biometric"     // Leitor biométrico
  | "reader"        // Leitor de cartão / tag
  | "module"        // Módulo de automação genérico
  | "sensor";       // Sensor (abertura, presença, etc.)

export type IntegrationType =
  | "cloud"         // Via API cloud (requer internet)
  | "local"         // Via rede local (HTTP/MQTT)
  | "hybrid";       // Suporta ambos

export interface DeviceSpec {
  channels?: number;
  voltage?: string;
  connectivity: string;
  power?: string;
  dimensions?: string;
  operatingTemp?: string;
  mounting?: string;
  protocols?: string[];
  extras?: string[];
}

export interface DeviceModel {
  id: string;
  brand: string;
  name: string;
  model: string;
  category: DeviceCategory;
  protocol: DeviceProtocol;
  integrationType: IntegrationType;
  description: string;
  specs: DeviceSpec;
  features: string[];
  useCase: string;          // Caso de uso recomendado
  installNotes: string;     // Notas de instalação
  purchaseUrl?: string;     // Link de compra
  imageUrl?: string;        // URL da imagem
  recommended?: boolean;    // Recomendado pela App Interfone
  available: boolean;       // Integração já implementada
  priceRange?: string;      // Faixa de preço aproximada
}

export interface BrandInfo {
  id: string;
  name: string;
  logo?: string;
  country: string;
  website: string;
  description: string;
  protocols: DeviceProtocol[];
  integrationType: IntegrationType;
  difficulty: number;          // 0-10 dificuldade de integração
}

/* ── Marcas ─────────────────────────────────────── */

export const BRANDS: BrandInfo[] = [
  {
    id: "sonoff",
    name: "Sonoff / eWeLink",
    country: "China",
    website: "https://sonoff.tech",
    description: "Switches e relés Wi-Fi acessíveis com integração via nuvem eWeLink (CoolKit). Grande variedade de módulos para automação residencial e comercial.",
    protocols: ["ewelink"],
    integrationType: "cloud",
    difficulty: 3,
  },
  {
    id: "shelly",
    name: "Shelly",
    country: "Bulgária",
    website: "https://shelly.cloud",
    description: "Relés e módulos Wi-Fi com API REST local. Não depende de nuvem — ideal para ambientes onde a resposta rápida é essencial.",
    protocols: ["shelly_http"],
    integrationType: "hybrid",
    difficulty: 4,
  },
  {
    id: "esp",
    name: "ESP32 / ESP8266 (DIY)",
    country: "China (Espressif)",
    website: "https://espressif.com",
    description: "Microcontroladores programáveis para soluções customizadas. Firmware personalizado via HTTP ou MQTT. Máxima flexibilidade para projetos sob medida.",
    protocols: ["esp_http"],
    integrationType: "local",
    difficulty: 8,
  },
  {
    id: "tuya",
    name: "Tuya / Smart Life",
    country: "China",
    website: "https://www.tuya.com",
    description: "Plataforma IoT cloud com milhares de dispositivos compatíveis. Switches, relés e módulos via Smart Life app com integração cloud API.",
    protocols: ["tuya"],
    integrationType: "cloud",
    difficulty: 3,
  },
  {
    id: "intelbras",
    name: "Intelbras",
    country: "Brasil",
    website: "https://www.intelbras.com",
    description: "Líder brasileira em segurança eletrônica. Porteiros eletrônicos, videoporteiros, controladoras de acesso e câmeras IP com suporte local.",
    protocols: ["intelbras"],
    integrationType: "local",
    difficulty: 6,
  },
  {
    id: "hikvision",
    name: "Hikvision",
    country: "China",
    website: "https://www.hikvision.com",
    description: "Referência mundial em videomonitoramento e controle de acesso. Leitores biométricos, controladoras e câmeras com protocolo ISAPI.",
    protocols: ["hikvision"],
    integrationType: "hybrid",
    difficulty: 7,
  },
];

/* ── Catálogo de Dispositivos ──────────────────── */

export const DEVICES: DeviceModel[] = [
  // ═══════════════════════════════════════════════
  // ────── SONOFF / eWeLink ──────────────────────
  // ═══════════════════════════════════════════════
  {
    id: "sonoff-basic-r4",
    brand: "sonoff",
    name: "SONOFF BASIC R4",
    model: "BASICR4",
    category: "relay",
    protocol: "ewelink",
    integrationType: "cloud",
    description: "Relé Wi-Fi compacto 1 canal, ideal para acionamento de portão ou fechadura elétrica. Suporta modo pulso (inching) nativo.",
    specs: {
      channels: 1,
      voltage: "100-240V AC",
      connectivity: "Wi-Fi 2.4GHz",
      power: "10A máx",
      dimensions: "55 × 32 × 17mm",
      protocols: ["eWeLink Cloud API"],
    },
    features: [
      "Modo pulso (inching) configurável",
      "Controle via nuvem eWeLink",
      "Timer e agendamento",
      "Compatível com Alexa e Google",
      "Firmware OTA",
    ],
    useCase: "Acionamento de portão veicular ou pedestres. Conecta direto no motor do portão substituindo a botoeira.",
    installNotes: "Instalar por eletricista. Conectar nos bornes da botoeira do motor. Necessita Wi-Fi 2.4GHz estável no local.",
    purchaseUrl: "https://www.amazon.com.br/s?k=sonoff+basic+r4",
    recommended: true,
    available: true,
    priceRange: "R$ 40–70",
  },
  {
    id: "sonoff-mini-r4",
    brand: "sonoff",
    name: "SONOFF MINI R4",
    model: "MINIR4",
    category: "relay",
    protocol: "ewelink",
    integrationType: "cloud",
    description: "Versão ultra-compacta do relé Wi-Fi. Cabe dentro de caixas de embutir 4×2. Suporta modo pulso e detach.",
    specs: {
      channels: 1,
      voltage: "100-240V AC",
      connectivity: "Wi-Fi 2.4GHz",
      power: "10A máx",
      dimensions: "39.5 × 33 × 16.8mm",
      protocols: ["eWeLink Cloud API"],
    },
    features: [
      "Ultra compacto — cabe em caixa 4x2",
      "Modo pulso (inching)",
      "Modo detach (switch externo independente)",
      "Controle via nuvem eWeLink",
    ],
    useCase: "Ideal quando o espaço é limitado. Perfeito para embutir junto à fechadura elétrica.",
    installNotes: "Instalar por eletricista dentro de caixa de embutir. Conectar L/N + saída no dispositivo controlado.",
    purchaseUrl: "https://www.amazon.com.br/s?k=sonoff+mini+r4",
    recommended: true,
    available: true,
    priceRange: "R$ 50–80",
  },
  {
    id: "sonoff-4ch-r3",
    brand: "sonoff",
    name: "SONOFF 4CH Pro R3",
    model: "4CHPROR3",
    category: "relay",
    protocol: "ewelink",
    integrationType: "cloud",
    description: "Módulo 4 canais independentes. Cada canal pode acionar um portão/fechadura diferente com modo pulso individual.",
    specs: {
      channels: 4,
      voltage: "100-240V AC / 5-24V DC",
      connectivity: "Wi-Fi 2.4GHz + RF 433MHz",
      power: "10A por canal",
      dimensions: "145 × 90 × 40mm",
      protocols: ["eWeLink Cloud API", "RF 433MHz"],
    },
    features: [
      "4 canais independentes",
      "Modo pulso individual por canal",
      "Entrada RF 433MHz",
      "Alimentação AC ou DC",
      "DIN rail / montagem em quadro",
    ],
    useCase: "Condomínios com múltiplos portões (veicular, pedestre, garagem, bloco). Um único módulo controla até 4 acessos.",
    installNotes: "Instalar em quadro elétrico. Cada canal conecta nos bornes de uma botoeira. Wi-Fi 2.4GHz necessário.",
    purchaseUrl: "https://www.amazon.com.br/s?k=sonoff+4ch+pro",
    recommended: true,
    available: true,
    priceRange: "R$ 120–180",
  },

  // ═══════════════════════════════════════════════
  // ────── SHELLY ────────────────────────────────
  // ═══════════════════════════════════════════════
  {
    id: "shelly-1",
    brand: "shelly",
    name: "Shelly 1 (Gen3)",
    model: "SNSW-001X16EU",
    category: "relay",
    protocol: "shelly_http",
    integrationType: "hybrid",
    description: "Relé Wi-Fi 1 canal com API REST local. Não precisa de nuvem — resposta instantânea via rede local. Suporta scripting.",
    specs: {
      channels: 1,
      voltage: "110-240V AC / 12V DC",
      connectivity: "Wi-Fi 2.4GHz + Bluetooth",
      power: "16A máx",
      dimensions: "42 × 36 × 17mm",
      protocols: ["HTTP REST local", "MQTT", "Shelly Cloud"],
    },
    features: [
      "API REST local (sem nuvem)",
      "MQTT nativo",
      "Scripting mJS embarcado",
      "Detecção de tensão/energia",
      "OTA updates",
      "Bluetooth para configuração",
    ],
    useCase: "Melhor opção para portões quando se deseja controle local sem dependência de internet. Resposta < 100ms.",
    installNotes: "Instalar por eletricista. Conectar nos bornes da botoeira. Acessar via IP local: http://<ip>/relay/0?cmd=on&timer=1",
    purchaseUrl: "https://www.amazon.com.br/s?k=shelly+1",
    recommended: true,
    available: false,
    priceRange: "R$ 80–130",
  },
  {
    id: "shelly-plus-1",
    brand: "shelly",
    name: "Shelly Plus 1",
    model: "SNSW-001P16EU",
    category: "relay",
    protocol: "shelly_http",
    integrationType: "hybrid",
    description: "Versão Plus com ESP32 e mais memória. API REST local + Bluetooth para setup. Ideal para automação profissional.",
    specs: {
      channels: 1,
      voltage: "110-240V AC / 12V DC",
      connectivity: "Wi-Fi 2.4GHz + Bluetooth 4.2",
      power: "16A máx",
      dimensions: "42 × 36 × 17mm",
      protocols: ["HTTP REST local", "MQTT", "Shelly Cloud", "Webhooks"],
    },
    features: [
      "ESP32 embarcado",
      "API REST local + Webhooks",
      "MQTT integrado",
      "Bluetooth para setup rápido",
      "Scripting mJS avançado",
      "Monitoramento de energia",
    ],
    useCase: "Recomendado para instalações profissionais que exigem confiabilidade máxima sem dependência de cloud.",
    installNotes: "Conectar fase + neutro + saída relé. Setup inicial via Bluetooth (app Shelly). API local disponível imediatamente.",
    purchaseUrl: "https://www.amazon.com.br/s?k=shelly+plus+1",
    available: false,
    priceRange: "R$ 100–160",
  },
  {
    id: "shelly-pro-2",
    brand: "shelly",
    name: "Shelly Pro 2",
    model: "SPSW-002XE16EU",
    category: "relay",
    protocol: "shelly_http",
    integrationType: "hybrid",
    description: "Módulo profissional 2 canais com Ethernet + Wi-Fi. Montagem em trilho DIN. Perfeito para quadros elétricos de condomínio.",
    specs: {
      channels: 2,
      voltage: "110-240V AC",
      connectivity: "Wi-Fi 2.4GHz + Ethernet + Bluetooth",
      power: "16A por canal",
      dimensions: "DIN rail 2 módulos",
      protocols: ["HTTP REST local", "MQTT", "Shelly Cloud", "Webhooks"],
    },
    features: [
      "2 canais independentes",
      "Ethernet + Wi-Fi (redundância)",
      "Montagem DIN rail",
      "Display LCD frontal",
      "API REST + MQTT + Webhooks",
      "Scripting avançado",
    ],
    useCase: "Ideal para quadros de automação do condomínio. Ethernet garante conexão estável. 2 canais para portão veicular + pedestre.",
    installNotes: "Encaixar no trilho DIN do quadro. Conectar Ethernet (recomendado) ou Wi-Fi. Cada canal controla um acionamento.",
    purchaseUrl: "https://www.amazon.com.br/s?k=shelly+pro+2",
    available: false,
    priceRange: "R$ 200–300",
  },

  // ═══════════════════════════════════════════════
  // ────── ESP32 / ESP8266 DIY ───────────────────
  // ═══════════════════════════════════════════════
  {
    id: "esp32-relay-1ch",
    brand: "esp",
    name: "ESP32 + Módulo Relé 1 Canal",
    model: "ESP32-RELAY-1CH",
    category: "relay",
    protocol: "esp_http",
    integrationType: "local",
    description: "Solução DIY com ESP32 DevKit + módulo relé. Firmware customizado para receber comandos HTTP. Máxima flexibilidade.",
    specs: {
      channels: 1,
      voltage: "5V DC (alimentação) / 250V AC 10A (relé)",
      connectivity: "Wi-Fi 2.4GHz + Bluetooth",
      power: "10A relé",
      protocols: ["HTTP REST custom", "MQTT", "WebSocket"],
    },
    features: [
      "Firmware 100% customizável",
      "API HTTP/MQTT/WebSocket",
      "GPIO livres para sensores extras",
      "OTA update via Wi-Fi",
      "Custo muito baixo",
      "Código aberto",
    ],
    useCase: "Para quem quer controle total do hardware e firmware. Ideal para integradores e desenvolvedores.",
    installNotes: "Requer programação do firmware (Arduino/PlatformIO). Alimentar ESP32 com 5V, conectar GPIO no módulo relé, relé na botoeira.",
    purchaseUrl: "https://www.amazon.com.br/s?k=esp32+rele+modulo",
    available: false,
    priceRange: "R$ 30–60",
  },
  {
    id: "esp32-relay-4ch",
    brand: "esp",
    name: "ESP32 + Módulo Relé 4 Canais",
    model: "ESP32-RELAY-4CH",
    category: "relay",
    protocol: "esp_http",
    integrationType: "local",
    description: "Solução DIY 4 canais. Um ESP32 controla 4 relés independentes via HTTP. Firmware customizado incluso no App Interfone.",
    specs: {
      channels: 4,
      voltage: "5V DC / 250V AC 10A por canal",
      connectivity: "Wi-Fi 2.4GHz + Bluetooth",
      power: "10A por canal",
      protocols: ["HTTP REST custom", "MQTT"],
    },
    features: [
      "4 canais independentes",
      "Firmware App Interfone disponível",
      "Custo muito baixo vs soluções comerciais",
      "Totalmente customizável",
      "Expansível com sensores",
    ],
    useCase: "Múltiplos acessos com custo mínimo. Firmware App Interfone já pronto para download.",
    installNotes: "Programar ESP32 com firmware App Interfone. Conectar cada GPIO em um módulo relé. Cada relé liga na botoeira do portão.",
    purchaseUrl: "https://www.amazon.com.br/s?k=esp32+modulo+rele+4+canais",
    available: false,
    priceRange: "R$ 50–90",
  },

  // ═══════════════════════════════════════════════
  // ────── TUYA / SMART LIFE ─────────────────────
  // ═══════════════════════════════════════════════
  {
    id: "tuya-wifi-switch-1ch",
    brand: "tuya",
    name: "Mini Switch Wi-Fi Tuya 1 Canal",
    model: "TYWE-MINI-1CH",
    category: "relay",
    protocol: "tuya",
    integrationType: "cloud",
    description: "Mini switch Wi-Fi com plataforma Tuya/Smart Life. Controle via cloud API. Grande variedade de fabricantes usando plataforma Tuya.",
    specs: {
      channels: 1,
      voltage: "100-240V AC",
      connectivity: "Wi-Fi 2.4GHz",
      power: "16A máx",
      dimensions: "~48 × 28 × 18mm",
      protocols: ["Tuya Cloud API", "Smart Life"],
    },
    features: [
      "Plataforma Tuya (milhares de fabricantes)",
      "Modo pulso configurável",
      "Timer e agendamento",
      "Compatível Alexa/Google/Siri",
      "API Cloud Tuya Open Platform",
    ],
    useCase: "Alternativa cloud ao eWeLink. Grande disponibilidade no mercado brasileiro com diversos fabricantes.",
    installNotes: "Instalar por eletricista nos bornes da botoeira. Parear pelo app Smart Life. Configurar Tuya Developer Account para integração.",
    purchaseUrl: "https://www.amazon.com.br/s?k=interruptor+wifi+tuya+mini",
    available: false,
    priceRange: "R$ 30–60",
  },
  {
    id: "tuya-wifi-switch-4ch",
    brand: "tuya",
    name: "Switch Wi-Fi Tuya 4 Canais",
    model: "TYWE-4CH",
    category: "relay",
    protocol: "tuya",
    integrationType: "cloud",
    description: "Módulo 4 canais Wi-Fi na plataforma Tuya. Cada canal com controle independente via cloud. Montagem em trilho DIN.",
    specs: {
      channels: 4,
      voltage: "100-240V AC",
      connectivity: "Wi-Fi 2.4GHz",
      power: "10A por canal",
      protocols: ["Tuya Cloud API"],
    },
    features: [
      "4 canais independentes",
      "Trilho DIN",
      "Cloud API Tuya",
      "Agendamento e automação",
    ],
    useCase: "Múltiplos acessos via Tuya. Alternativa 4CH ao Sonoff com ecossistema diferente.",
    installNotes: "Montar em trilho DIN. Conectar cada canal na botoeira correspondente. Parear via Smart Life.",
    purchaseUrl: "https://www.amazon.com.br/s?k=rele+wifi+4+canais+tuya+din",
    available: false,
    priceRange: "R$ 80–150",
  },

  // ═══════════════════════════════════════════════
  // ────── INTELBRAS ─────────────────────────────
  // ═══════════════════════════════════════════════
  {
    id: "intelbras-xpe-3101-ip",
    brand: "intelbras",
    name: "Intelbras XPE 3101 IP",
    model: "XPE 3101 IP",
    category: "intercom",
    protocol: "intelbras",
    integrationType: "local",
    description: "Porteiro eletrônico IP com câmera e relé integrado. Protocolo SIP para integração com centrais. Ideal para substituir porteiros analógicos.",
    specs: {
      channels: 1,
      voltage: "PoE 802.3af / 12V DC",
      connectivity: "Ethernet 10/100",
      dimensions: "120 × 168 × 45mm",
      protocols: ["SIP", "HTTP", "RTSP"],
      extras: ["Câmera 1MP", "Relé seco integrado", "Proteção IP65"],
    },
    features: [
      "Videoporteiro IP com câmera",
      "Protocolo SIP nativo",
      "Relé integrado para acionamento",
      "API HTTP para integração",
      "PoE — um único cabo",
      "Proteção contra chuva IP65",
    ],
    useCase: "Substituição do porteiro analógico. Faz chamada SIP + aciona portão via relé integrado.",
    installNotes: "Instalar na guarita/portão. Conectar via cabo Ethernet (PoE). Configurar SIP e relé via interface web.",
    purchaseUrl: "https://www.amazon.com.br/s?k=intelbras+xpe+3101+ip",
    available: false,
    priceRange: "R$ 800–1.200",
  },
  {
    id: "intelbras-ct-500-1r",
    brand: "intelbras",
    name: "Intelbras CT 500 1R",
    model: "CT 500 1R",
    category: "controller",
    protocol: "intelbras",
    integrationType: "local",
    description: "Controladora de acesso standalone com 1 relé. Suporta cartão/tag RFID 125kHz e senha. Ideal para portas e catracas.",
    specs: {
      channels: 1,
      voltage: "12V DC",
      connectivity: "Wiegand 26/34",
      power: "Relé seco NA/NF",
      protocols: ["Wiegand", "HTTP (via módulo)"],
      extras: ["Leitor RFID 125kHz", "Teclado touch", "Até 1000 cartões"],
    },
    features: [
      "Cartão RFID + senha",
      "Standalone (funciona sem rede)",
      "Interface Wiegand",
      "Relé ajustável (1-99s)",
      "Até 1000 cartões",
    ],
    useCase: "Controle de acesso por cartão/tag em portas de bloco, academia, piscina. Pode integrar com módulo de rede.",
    installNotes: "Fixar na parede ao lado da porta. Conectar na fechadura elétrica via relé. Cadastrar cartões via teclado.",
    purchaseUrl: "https://www.amazon.com.br/s?k=intelbras+ct+500",
    available: false,
    priceRange: "R$ 200–350",
  },
  {
    id: "intelbras-ss-230",
    brand: "intelbras",
    name: "Intelbras SS 230",
    model: "SS 230",
    category: "module",
    protocol: "intelbras",
    integrationType: "local",
    description: "Módulo de acionamento com relé, compatível com a linha de alarme e automação Intelbras. Acionamento via contato seco.",
    specs: {
      channels: 2,
      voltage: "12-24V DC",
      connectivity: "Sem fio 433MHz / Cabeado",
      power: "Relé 5A",
      protocols: ["433MHz Intelbras", "Contato seco"],
    },
    features: [
      "2 saídas relé",
      "Compatível com centrais Intelbras",
      "Sem fio 433MHz",
      "Temporização configurável",
    ],
    useCase: "Integrar acionamento de porta/portão com central de alarme Intelbras existente.",
    installNotes: "Conectar na central de alarme ou usar standalone. Relés conectam nas fechaduras/portões.",
    purchaseUrl: "https://www.amazon.com.br/s?k=intelbras+ss+230",
    available: false,
    priceRange: "R$ 150–250",
  },

  // ═══════════════════════════════════════════════
  // ────── HIKVISION ─────────────────────────────
  // ═══════════════════════════════════════════════
  {
    id: "hikvision-ds-k1t342mfwx",
    brand: "hikvision",
    name: "Hikvision DS-K1T342MFWX",
    model: "DS-K1T342MFWX",
    category: "biometric",
    protocol: "hikvision",
    integrationType: "hybrid",
    description: "Terminal de reconhecimento facial + impressão digital com tela 4.3\". Controla relé de porta e registra acesso. ISAPI para integração.",
    specs: {
      channels: 1,
      voltage: "12V DC / PoE",
      connectivity: "Ethernet + Wi-Fi",
      dimensions: "124 × 253 × 37mm",
      protocols: ["ISAPI", "HTTP", "Wiegand"],
      extras: ["Tela 4.3\"", "Face + Digital + Cartão", "Até 6000 faces", "Proteção IP65"],
    },
    features: [
      "Reconhecimento facial com IA",
      "Impressão digital + cartão RFID",
      "Detecção de máscara",
      "API ISAPI para integração",
      "Tela touch 4.3\"",
      "Registro de foto em cada acesso",
    ],
    useCase: "Controle de acesso premium com biometria facial. Ideal para entrada principal ou áreas restritas.",
    installNotes: "Fixar na parede (altura 1.4m). Conectar via Ethernet/PoE. Configurar via iVMS-4200 ou ISAPI.",
    purchaseUrl: "https://www.amazon.com.br/s?k=hikvision+reconhecimento+facial+acesso",
    available: false,
    priceRange: "R$ 2.500–4.000",
  },
  {
    id: "hikvision-ds-k1t502",
    brand: "hikvision",
    name: "Hikvision DS-K1T502 Series",
    model: "DS-K1T502",
    category: "intercom",
    protocol: "hikvision",
    integrationType: "hybrid",
    description: "Videoporteiro IP Hikvision com câmera 2MP e relé. Protocolo SIP e ISAPI. Integração com app Hik-Connect.",
    specs: {
      channels: 1,
      voltage: "PoE 802.3af / 12V DC",
      connectivity: "Ethernet 10/100",
      protocols: ["SIP", "ISAPI", "RTSP"],
      extras: ["Câmera 2MP", "Relé integrado", "IP65", "Infravermelho"],
    },
    features: [
      "Câmera 2MP com IR",
      "SIP + ISAPI",
      "Relé para portão integrado",
      "Integração Hik-Connect",
      "PoE",
    ],
    useCase: "Videoporteiro profissional com integração IP. Substitui porteiros analógicos mantendo visual premium.",
    installNotes: "Instalar na entrada do condomínio. Cabo Ethernet até switch PoE. Configurar via iVMS ou ISAPI.",
    purchaseUrl: "https://www.amazon.com.br/s?k=hikvision+video+porteiro+ip",
    available: false,
    priceRange: "R$ 1.500–2.500",
  },
  {
    id: "hikvision-ds-k2602t",
    brand: "hikvision",
    name: "Hikvision DS-K2602T",
    model: "DS-K2602T",
    category: "controller",
    protocol: "hikvision",
    integrationType: "hybrid",
    description: "Controladora de acesso 2 portas com suporte a leitor Wiegand, RS-485, e integração ISAPI. Gerencia até 2 pontos de acesso.",
    specs: {
      channels: 2,
      voltage: "12V DC",
      connectivity: "Ethernet 10/100 + RS-485",
      power: "Relé 5A por porta",
      protocols: ["ISAPI", "Wiegand 26/34", "RS-485"],
      extras: ["Até 100.000 cartões", "Bateria backup", "Anti-tamper"],
    },
    features: [
      "2 portas independentes",
      "Wiegand + RS-485",
      "API ISAPI completa",
      "100.000 cartões",
      "Eventos em tempo real",
      "Anti-passback",
    ],
    useCase: "Controladora profissional para condomínios grandes. Gerencia 2 acessos com leitores de cartão/biométricos.",
    installNotes: "Instalar em rack/quadro técnico. Conectar leitores via Wiegand. Conectar fechaduras nos relés. Ethernet para gerenciamento.",
    purchaseUrl: "https://www.amazon.com.br/s?k=hikvision+controladora+acesso",
    available: false,
    priceRange: "R$ 1.200–2.000",
  },
];

/* ── Helpers ───────────────────────────────────── */

export function getDevicesByBrand(brandId: string): DeviceModel[] {
  return DEVICES.filter((d) => d.brand === brandId);
}

export function getDevicesByCategory(category: DeviceCategory): DeviceModel[] {
  return DEVICES.filter((d) => d.category === category);
}

export function getDevicesByProtocol(protocol: DeviceProtocol): DeviceModel[] {
  return DEVICES.filter((d) => d.protocol === protocol);
}

export function getRecommendedDevices(): DeviceModel[] {
  return DEVICES.filter((d) => d.recommended);
}

export function getAvailableDevices(): DeviceModel[] {
  return DEVICES.filter((d) => d.available);
}

export function getDeviceById(id: string): DeviceModel | undefined {
  return DEVICES.find((d) => d.id === id);
}

export function getBrandById(id: string): BrandInfo | undefined {
  return BRANDS.find((b) => b.id === id);
}

/** Ícone label para cada categoria */
export const CATEGORY_LABELS: Record<DeviceCategory, string> = {
  relay: "Relé / Acionamento",
  controller: "Controladora de Acesso",
  intercom: "Porteiro Eletrônico",
  camera: "Câmera IP",
  biometric: "Biometria",
  reader: "Leitor de Cartão",
  module: "Módulo de Automação",
  sensor: "Sensor",
};

/** Labels para tipo de integração */
export const INTEGRATION_LABELS: Record<IntegrationType, string> = {
  cloud: "Cloud (Internet)",
  local: "Local (Rede Wi-Fi)",
  hybrid: "Híbrido (Local + Cloud)",
};

/** Labels para protocolo */
export const PROTOCOL_LABELS: Record<DeviceProtocol, string> = {
  ewelink: "eWeLink Cloud",
  shelly_http: "Shelly HTTP Local",
  esp_http: "ESP HTTP Local",
  tuya: "Tuya Cloud",
  intelbras: "Intelbras",
  hikvision: "Hikvision ISAPI",
};
