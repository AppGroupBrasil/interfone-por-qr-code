/**
 * Face Recognition Service — Server-side
 * 
 * Usa @vladmandic/face-api com backend WASM rodando no Node.js para:
 * - Extrair face descriptors de fotos base64
 * - Comparar um descriptor contra os cadastrados no DB
 * 
 * O navegador NÃO roda ML — apenas captura a foto e envia ao servidor.
 * Modelos são carregados UMA VEZ ao iniciar o servidor (~2-5s).
 * Backend: TF.js WASM (sem @tensorflow/tfjs-node, sem compilação nativa)
 */

import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { log } from "./logger.js";

const require2 = createRequire(import.meta.url);

// canvas e face-api entram por require dinâmico, não por import estático: assim o
// `tsc` compila este arquivo sem os pacotes instalados e o `npm ci` do build deixa
// de compilar o canvas do fonte (gcc pesado, já falhou por recurso e derrubaria o
// deploy inteiro por um módulo que a v1 nem usa). Fora do escopo v1 os dois pacotes
// não são instalados — o require abaixo lança e o import() em index.ts cai no catch,
// desligando só /api/face. Para reativar: npm i canvas @vladmandic/face-api.
const { Canvas, Image, createCanvas, loadImage } = require2("canvas");

// Versão WASM do face-api (não requer tfjs-node)
const faceapi = require2("@vladmandic/face-api/dist/face-api.node-wasm.js");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurar canvas para face-api no Node.js
faceapi.env.monkeyPatch({
  Canvas: Canvas as any,
  Image: Image as any,
});

let modelsLoaded = false;
let modelsLoading = false;

/**
 * Carrega modelos de detecção facial. Chamado uma vez no startup do servidor.
 */
export async function loadModels(): Promise<void> {
  if (modelsLoaded || modelsLoading) return;
  modelsLoading = true;

  const modelsPath = path.resolve(__dirname, "../public/models");
  console.log("[FaceService] Carregando modelos de:", modelsPath);
  console.log("[FaceService] Backend TF.js:", faceapi.tf?.getBackend?.() || "wasm");

  try {
    // Configurar WASM backend path
    const wasmPath = path.dirname(require2.resolve("@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm"));
    if (faceapi.tf?.wasm?.setWasmPaths) {
      faceapi.tf.wasm.setWasmPaths(wasmPath + "/");
    }

    // Aguardar backend estar pronto
    if (faceapi.tf?.ready) {
      await faceapi.tf.ready();
      console.log("[FaceService] Backend pronto:", faceapi.tf.getBackend());
    }

    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);
    modelsLoaded = true;
    console.log("[FaceService] ✅ Modelos carregados com sucesso");
  } catch (err) {
    log.error("[FaceService] ❌ Erro ao carregar modelos:", err);
    modelsLoading = false;
    throw err;
  }
}

export function isReady(): boolean {
  return modelsLoaded;
}

/**
 * Extrai o face_descriptor (Float32Array de 128 dimensões) de uma foto base64.
 * Retorna null se nenhum rosto for detectado.
 */
export async function extractDescriptor(base64Photo: string): Promise<number[] | null> {
  if (!modelsLoaded) throw new Error("Modelos não carregados");

  try {
    // Remover prefixo data:image/... se existir
    const raw = base64Photo.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(raw, "base64");
    const img = await loadImage(buffer);

    // Criar canvas com a imagem
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img as any, 0, 0);

    // Detectar rosto + landmarks + descriptor
    const detection = await faceapi
      .detectSingleFace(canvas as any, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;

    return Array.from(detection.descriptor);
  } catch (err) {
    log.error("[FaceService] Erro ao extrair descriptor:", err);
    return null;
  }
}

/**
 * Calcula distância euclidiana entre dois descriptors.
 */
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

export interface FaceMatchResult {
  matched: boolean;
  visitorId: number | null;
  visitorName: string | null;
  distance: number | null;
  similarity: number | null;
}

/**
 * Compara um descriptor contra uma lista de conhecidos.
 * Retorna o melhor match ou { matched: false }.
 */
export function compareFaces(
  descriptor: number[],
  knownFaces: Array<{ id: number; nome: string; face_descriptor: number[] }>,
  threshold: number = 0.6
): FaceMatchResult {
  let bestDistance = Infinity;
  let bestMatch: { id: number; nome: string } | null = null;

  for (const face of knownFaces) {
    const distance = euclideanDistance(descriptor, face.face_descriptor);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = { id: face.id, nome: face.nome };
    }
  }

  if (bestMatch && bestDistance < threshold) {
    return {
      matched: true,
      visitorId: bestMatch.id,
      visitorName: bestMatch.nome,
      distance: bestDistance,
      similarity: Math.round((1 - bestDistance) * 100),
    };
  }

  return {
    matched: false,
    visitorId: null,
    visitorName: null,
    distance: bestDistance === Infinity ? null : bestDistance,
    similarity: null,
  };
}
