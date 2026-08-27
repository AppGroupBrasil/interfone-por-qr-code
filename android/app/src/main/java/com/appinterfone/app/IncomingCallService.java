package com.appinterfone.app;

import android.app.ActivityManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.List;
import java.util.Map;

/**
 * Serviço FCM do app. Intercepta a chamada do interfone (data.type ==
 * "interfone-call", enviada DATA-ONLY pelo servidor) e, com o app em
 * segundo plano ou tela bloqueada, mostra uma notificação de CHAMADA em
 * tela cheia (full-screen intent) — como uma ligação de verdade.
 *
 * Com o app em primeiro plano, delega ao serviço do Capacitor
 * (super.onMessageReceived) para preservar exatamente o fluxo atual
 * (WebSocket + tela de chamada React). Os demais pushes também são
 * sempre delegados ao Capacitor.
 */
public class IncomingCallService extends MessagingService {

    /**
     * v4 é SILENCIOSO de propósito: quem toca é o CallRinger (MediaPlayer no
     * volume de toque, em loop). O som do canal morria em milissegundos porque
     * a MainActivity cancela a notificação assim que o full-screen intent abre
     * o app — era essa a causa da "campainha baixa". Canais são imutáveis, daí
     * o novo id.
     */
    private static final String CALL_CHANNEL_ID = "interfone_calls_v4";
    private static final int CALL_NOTIFICATION_ID = 4001;

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        if (data != null && "interfone-call".equals(data.get("type"))) {
            if (isAppInForeground()) {
                // App aberto: o WebSocket/tela de chamada já cuidam (fluxo atual).
                super.onMessageReceived(remoteMessage);
            } else {
                // App em background/morto ou tela bloqueada: chamada em tela cheia.
                showIncomingCall(data);
            }
            return;
        }
        super.onMessageReceived(remoteMessage);
    }

    private void showIncomingCall(Map<String, String> data) {
        ensureCallChannel();
        CallRinger.start(this);

        String title = data.get("title");
        if (title == null || title.isEmpty()) title = "Chamada do Interfone";
        String body = data.get("body");
        if (body == null || body.isEmpty()) body = "Você está recebendo uma chamada";
        String callId = data.get("callId");

        // Intent que abre o app na chamada, por cima da tela bloqueada.
        Intent contentIntent = new Intent(this, MainActivity.class);
        contentIntent.setAction(Intent.ACTION_MAIN);
        contentIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        contentIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        contentIntent.putExtra("fromCall", true);
        if (callId != null) contentIntent.putExtra("callId", callId);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent callPendingIntent = PendingIntent.getActivity(this, 0, contentIntent, piFlags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CALL_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(true)
            .setContentIntent(callPendingIntent)
            .setFullScreenIntent(callPendingIntent, true);

        try {
            NotificationManagerCompat.from(this).notify(CALL_NOTIFICATION_ID, builder.build());
        } catch (SecurityException ignored) {
            // POST_NOTIFICATIONS negada — nada a fazer.
        }
    }

    /**
     * Cria o canal da chamada se ainda não existir. Canal SEM som e SEM vibração:
     * som e vibração são do CallRinger, que não morre quando a notificação é
     * cancelada. Serve só para a chamada aparecer em tela cheia.
     */
    private void ensureCallChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CALL_CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(
            CALL_CHANNEL_ID, "Chamadas do Interfone", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Chamadas recebidas do interfone");
        channel.enableVibration(false);
        channel.setSound(null, null);
        channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        nm.createNotificationChannel(channel);
    }

    /** True se o processo do app está em primeiro plano (Activity visível). */
    private boolean isAppInForeground() {
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) return false;
        List<ActivityManager.RunningAppProcessInfo> procs = am.getRunningAppProcesses();
        if (procs == null) return false;
        final String pkg = getPackageName();
        for (ActivityManager.RunningAppProcessInfo p : procs) {
            if (p.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
                && p.processName != null && p.processName.equals(pkg)) {
                return true;
            }
        }
        return false;
    }
}
