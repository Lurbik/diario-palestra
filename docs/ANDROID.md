# APK Android con Capacitor

**Stato**: il progetto nativo `android/` è generato e sincronizzato con `dist/`, ma **nessun APK è stato compilato**
in questo ambiente (Android SDK assente). Le istruzioni seguenti non sono state eseguite fin qui: vanno provate sul tuo PC.

Configurazione: `capacitor.config.json` (appId `it.diario.palestra`), minSdk 24 (Android 7.0), target/compile SDK 36,
plugin `@capacitor/local-notifications` 8.3.

## Prerequisiti

1. **Android Studio** (versione recente) con Android SDK Platform 36 e Build-Tools.
2. **JDK 21**: usa quello incluso in Android Studio (JBR). Il JDK 25 installato sul PC potrebbe non essere supportato da Gradle/AGP.

## Build APK di prova (debug)

```bash
npm run cap:sync
```

```bash
npx cap open android
```

In Android Studio: attendi la sincronizzazione Gradle → menu **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
L'APK di debug si trova in `android/app/build/outputs/apk/debug/app-debug.apk`.

In alternativa da terminale (con `JAVA_HOME` sul JDK 21 di Android Studio e `ANDROID_HOME` impostato):

```bash
cd android && gradlew.bat assembleDebug
```

Installazione sul telefono collegato con debug USB:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

È un APK **di prova** (firmato con chiave di debug): non distribuirlo. Una release firmata richiede un keystore personale.

## Differenze rispetto alla PWA

- Notifiche locali programmate (Altro → Impostazioni → Promemoria → "Programma notifiche sul telefono"), soggette a
  permesso notifiche e risparmio energetico di Android.
- Aggiornamenti: si installa un nuovo APK con lo stesso `appId`; i dati della WebView restano. Fai comunque un backup prima.
- PWA installata da Chrome e APK sono **due archivi separati**: per passare dall'una all'altro usa Backup → esporta/importa.
