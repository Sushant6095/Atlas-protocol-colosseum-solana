// AtlasApp — entry point (Phase 24 §5).
//
// Loads the dark theme tokens, registers the network client, and
// mounts RootView. Biometric unlock gates the app on launch and
// after backgrounding — the AtlasNetworking client is paused while
// locked to avoid leaking proof bodies to the system snapshot.

import SwiftUI

@main
struct AtlasApp: App {
    @StateObject private var biometrics = BiometricGate()
    @StateObject private var session    = AtlasSession()

    var body: some Scene {
        WindowGroup {
            Group {
                if biometrics.isUnlocked {
                    RootView()
                        .environmentObject(session)
                        .environmentObject(biometrics)
                } else {
                    BiometricLockScreen()
                        .environmentObject(biometrics)
                }
            }
            .preferredColorScheme(.dark)
            .tint(AtlasColor.electric)
        }
    }
}
