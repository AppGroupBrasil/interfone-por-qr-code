/**
 * Fila de candidatos ICE que chegam antes do RTCPeerConnection existir
 * ou antes do setRemoteDescription completar (ex.: getUserMedia lento no
 * arranque frio do app via push). Sem isso os candidatos são perdidos e o
 * ICE nunca conecta.
 */
export type PendingIce = { callId?: string; candidate: RTCIceCandidateInit };

export function queueOrAddIce(
  pc: RTCPeerConnection | null,
  msg: { callId?: string; candidate?: RTCIceCandidateInit },
  queue: PendingIce[],
  tag: string,
): void {
  if (!msg.candidate) return;
  if (pc && pc.remoteDescription) {
    pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch((e) =>
      console.warn(`[${tag}] addIceCandidate falhou:`, e));
  } else {
    queue.push({ callId: msg.callId, candidate: msg.candidate });
  }
}

export function flushPendingIce(
  pc: RTCPeerConnection | null,
  queue: PendingIce[],
  callId: string | undefined,
  tag: string,
): void {
  if (!pc) return;
  const items = queue.splice(0, queue.length);
  for (const item of items) {
    if (callId && item.callId && item.callId !== callId) continue;
    pc.addIceCandidate(new RTCIceCandidate(item.candidate)).catch((e) =>
      console.warn(`[${tag}] flush ICE falhou:`, e));
  }
}
