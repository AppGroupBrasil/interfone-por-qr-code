package com.appinterfone.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

/**
 * Toque da chamada, tocado nativamente.
 *
 * Antes o toque vinha (a) do som do canal de notificação — que morria em
 * milissegundos, porque a MainActivity cancela a notificação assim que o
 * full-screen intent abre o app — e (b) do WebView (new Audio / Web Audio),
 * que sai no volume de MÍDIA e ainda é atenuado pelo AudioHardening da
 * Motorola. Resultado: campainha baixíssima.
 *
 * Aqui o som é um MediaPlayer com USAGE_NOTIFICATION_RINGTONE, ou seja, sai
 * no volume de TOQUE do aparelho, em loop, independente da notificação.
 */
public final class CallRinger {

    /** Trava de segurança: nunca tocar mais que isso, mesmo se ninguém mandar parar. */
    private static final long MAX_RING_MS = 45_000L;
    private static final long[] VIBRATE_PATTERN = {0, 1000, 200, 1000, 3000};

    private static final Handler HANDLER = new Handler(Looper.getMainLooper());
    private static final Runnable AUTO_STOP = new Runnable() {
        @Override public void run() { stop(); }
    };

    private static MediaPlayer player;
    private static Vibrator vibrator;

    private CallRinger() {}

    public static synchronized void start(Context context) {
        if (player != null || vibrator != null) return; // já tocando

        Context app = context.getApplicationContext();
        AudioManager am = (AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
        boolean silent = am != null && am.getRingerMode() == AudioManager.RINGER_MODE_SILENT;
        boolean vibrateOnly = am != null && am.getRingerMode() == AudioManager.RINGER_MODE_VIBRATE;

        if (!silent && !vibrateOnly) {
            try {
                MediaPlayer mp = new MediaPlayer();
                mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
                mp.setDataSource(app, Uri.parse("android.resource://" + app.getPackageName() + "/raw/ringtone"));
                mp.setLooping(true);
                mp.prepare();
                mp.setVolume(1f, 1f);
                mp.start();
                player = mp;
            } catch (Exception ignored) {
                player = null;
            }
        }

        if (!silent) startVibration(app);

        HANDLER.removeCallbacks(AUTO_STOP);
        HANDLER.postDelayed(AUTO_STOP, MAX_RING_MS);
    }

    public static synchronized void stop() {
        HANDLER.removeCallbacks(AUTO_STOP);
        if (player != null) {
            try { player.stop(); } catch (Exception ignored) {}
            try { player.release(); } catch (Exception ignored) {}
            player = null;
        }
        if (vibrator != null) {
            try { vibrator.cancel(); } catch (Exception ignored) {}
            vibrator = null;
        }
    }

    private static void startVibration(Context app) {
        try {
            Vibrator v = (Vibrator) app.getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createWaveform(VIBRATE_PATTERN, 0));
            } else {
                v.vibrate(VIBRATE_PATTERN, 0);
            }
            vibrator = v;
        } catch (Exception ignored) {
            vibrator = null;
        }
    }
}
