# AmberKitchen Flutter

Flutter iOS and Android client for AmberKitchen.

## Run
```bash
GOOGLE_MAPS_API_KEY=your-google-maps-key flutter run \
  --dart-define=API_BASE_URL=http://localhost:4000
```

For Android emulator use:
```bash
GOOGLE_MAPS_API_KEY=your-google-maps-key flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:4000
```

For iOS, set `GOOGLE_MAPS_API_KEY` in the Xcode scheme or CI environment so `ios/Runner/Info.plist` can pass it to the Google Maps SDK.

Local native builds also require the Android SDK for Android and full Xcode plus CocoaPods for iOS.

## Demo
The app includes a `Demo` tab that lists every feature area covered by the Angular web app and backend.
