## Android nativo

Base nativa criada com Capacitor em `android/`.

### O que ja esta pronto

- Plataforma Android criada.
- App ID: `com.appinterfone.app`.
- Push nativo via `@capacitor/push-notifications`.
- Canal Android `interfone_calls` configurado para chamadas do interfone.
- Permissao `POST_NOTIFICATIONS` adicionada para Android 13+.

### O que ainda falta para o push funcionar no Android

1. Baixar o arquivo `google-services.json` do app Android no Firebase.
2. Colocar esse arquivo em `android/app/google-services.json`.
3. Esse arquivo nao e o mesmo JSON de service account do backend.

Observacao:

- O arquivo de service account usado no servidor serve para `firebase-admin`.
- O app Android precisa especificamente do `google-services.json` do cliente Android.

### Como gerar o `google-services.json`

1. Abrir o projeto Firebase `app-interfone`.
2. Adicionar um app Android com package `com.appinterfone.app`.
3. Baixar o `google-services.json`.
4. Salvar em `android/app/google-services.json`.

### Como abrir o app nativo

1. Instalar JDK e definir `JAVA_HOME`.
2. Rodar `npm run build:android`.
3. Rodar `npm run cap:open`.
4. No Android Studio, sincronizar o Gradle e executar em dispositivo/emulador.

### Ambiente local necessario

- JDK 21 recomendado.
- Android Studio com SDK Android instalado.
- Variavel `JAVA_HOME` apontando para o JDK.

### Comandos uteis

```bash
npm run build:android
npx cap open android
```