import { describe, expect, it } from "vitest";

// Sem credencial do Firebase o módulo só avisa que o push está desativado;
// buildFcmMessage/toFcmToken são puros e não tocam a rede.
const { buildFcmMessage, toFcmToken } = await import("../pushService.js");

const CHAMADA = {
  title: "Interfone",
  body: "Visitante na portaria",
  data: { callId: "abc", type: "call" },
  fullScreen: true,
};

describe("toFcmToken", () => {
  it("aparelho sem app_build entra como build mínimo de tela cheia", () => {
    expect(toFcmToken({ token: "t", platform: "android", web_push_keys: null }).appBuild).toBe(13);
    expect(toFcmToken({ token: "t", platform: "android", web_push_keys: null, app_build: null }).appBuild).toBe(13);
    expect(toFcmToken({ token: "t", platform: "android", web_push_keys: null, app_build: 0 }).appBuild).toBe(13);
  });

  it("preserva o versionCode informado pelo app", () => {
    expect(toFcmToken({ token: "t", platform: "android", web_push_keys: null, app_build: 18 }).appBuild).toBe(18);
  });
});

describe("buildFcmMessage — chamada em app novo (data-only)", () => {
  const msg = buildFcmMessage(["a", "b"], CHAMADA, true) as any;

  it("não leva bloco notification, senão o Android monta a notificação sozinho", () => {
    expect(msg.notification).toBeUndefined();
    expect(msg.android?.notification).toBeUndefined();
  });

  it("manda título, corpo e canal v4 dentro do data", () => {
    expect(msg.data).toMatchObject({
      callId: "abc",
      title: "Interfone",
      body: "Visitante na portaria",
      channelId: "interfone_calls_v4",
    });
  });

  it("prioridade alta no Android e alerta no iOS", () => {
    expect(msg.android.priority).toBe("high");
    expect(msg.apns.payload.aps.alert).toEqual({ title: "Interfone", body: "Visitante na portaria" });
    expect(msg.apns.payload.aps["interruption-level"]).toBe("time-sensitive");
  });
});

describe("buildFcmMessage — notification message", () => {
  it("chamada em app antigo usa o canal v2, que existe naquele build", () => {
    const msg = buildFcmMessage(["a"], CHAMADA, false) as any;
    expect(msg.notification).toEqual({ title: "Interfone", body: "Visitante na portaria" });
    expect(msg.android.notification.channelId).toBe("interfone_calls_v2");
    expect(msg.android.notification.priority).toBe("max");
  });

  it("push comum (sem fullScreen) fica no canal padrão", () => {
    const msg = buildFcmMessage(["a"], { title: "Aviso", body: "Encomenda" }, false) as any;
    expect(msg.android.notification.channelId).toBe("appinterfone_default");
    expect(msg.data).toEqual({});
  });

  it("channelId explícito do chamador manda em qualquer formato", () => {
    const dataOnly = buildFcmMessage(["a"], { ...CHAMADA, channelId: "x" }, true) as any;
    const legado = buildFcmMessage(["a"], { ...CHAMADA, channelId: "x" }, false) as any;
    expect(dataOnly.data.channelId).toBe("x");
    expect(legado.android.notification.channelId).toBe("x");
  });
});
