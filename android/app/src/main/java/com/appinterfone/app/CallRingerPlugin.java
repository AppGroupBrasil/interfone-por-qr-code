package com.appinterfone.app;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Ponte JS → CallRinger: o app web liga/desliga o toque nativo da chamada. */
@CapacitorPlugin(name = "CallRinger")
public class CallRingerPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        CallRinger.start(getContext());
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        CallRinger.stop();
        call.resolve();
    }

    /**
     * Android 14+ (API 34) só deixa a chamada aparecer em tela cheia se o
     * usuário tiver permitido. Sem isso a campainha vira uma notificação comum
     * no topo — com o celular bloqueado, o morador não vê nada.
     */
    @PluginMethod
    public void canUseFullScreenIntent(PluginCall call) {
        boolean permitido = true;
        if (Build.VERSION.SDK_INT >= 34) {
            NotificationManager nm =
                (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            permitido = nm == null || nm.canUseFullScreenIntent();
        }
        JSObject ret = new JSObject();
        ret.put("value", permitido);
        call.resolve(ret);
    }

    /** Abre a tela do sistema onde o usuário libera a chamada em tela cheia. */
    @PluginMethod
    public void openFullScreenIntentSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                Intent i = new Intent(
                    Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                    Uri.parse("package:" + getContext().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            } catch (Exception ignored) {
                // Fabricante sem essa tela: nada a fazer.
            }
        }
        call.resolve();
    }

    /**
     * Doze: com o app dias sem abrir, o Android pode segurar o push da
     * campainha. Aqui só consultamos — pedir a isenção direto exigiria a
     * permissão restrita REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, que a Play
     * Store revisa caso a caso.
     */
    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        boolean liberado = true;
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            liberado = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        }
        JSObject ret = new JSObject();
        ret.put("value", liberado);
        call.resolve(ret);
    }

    /**
     * Tela do proprio app, onde fica o item Bateria. A lista geral do sistema
     * (ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS) abre com todos os apps
     * instalados e o morador teria de caçar o Interfone no meio deles.
     */
    @PluginMethod
    public void openBatteryOptimizationSettings(PluginCall call) {
        abrirDetalhesDoApp();
        call.resolve();
    }

    /**
     * Estado de camera e microfone. Só consulta: quem pede o acesso é o
     * getUserMedia do WebView, que o Capacitor encaminha para o Android.
     */
    @PluginMethod
    public void mediaPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("camera", concedida(Manifest.permission.CAMERA));
        ret.put("microphone", concedida(Manifest.permission.RECORD_AUDIO));
        call.resolve(ret);
    }

    /** Tela do app no sistema — saida quando o usuario negou "nao perguntar mais". */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        abrirDetalhesDoApp();
        call.resolve();
    }

    private boolean concedida(String permissao) {
        return ContextCompat.checkSelfPermission(getContext(), permissao)
            == PackageManager.PERMISSION_GRANTED;
    }

    private void abrirDetalhesDoApp() {
        abrir(new Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:" + getContext().getPackageName())));
    }

    private boolean abrir(Intent intent) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }
}
