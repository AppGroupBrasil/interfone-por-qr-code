package com.appinterfone.app;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int CALL_NOTIFICATION_ID = 4001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(CallRingerPlugin.class);
        super.onCreate(savedInstanceState);
        handleCallIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleCallIntent(intent);
    }

    /**
     * Quando aberto pela notificação de chamada do interfone (full-screen intent),
     * mostra a Activity sobre a tela bloqueada e acorda a tela, e cancela a
     * notificação nativa (parando o toque do canal). A partir daí quem toca é a
     * tela de chamada do app (GlobalIncomingCall), alimentada pelo WebSocket.
     */
    private void handleCallIntent(Intent intent) {
        if (intent == null || !intent.getBooleanExtra("fromCall", false)) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        NotificationManagerCompat.from(this).cancel(CALL_NOTIFICATION_ID);
    }
}
