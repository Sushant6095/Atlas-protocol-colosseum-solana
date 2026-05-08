// BiometricGate — Phase 24 §5.4.
//
// Locks the app on launch, on backgrounding > 30s, and on user
// request. Uses LocalAuthentication for Face ID / Touch ID; falls
// back to device passcode. While locked, the network client is
// paused (callers should observe `isUnlocked` via @Published).

import Foundation
import LocalAuthentication
#if canImport(UIKit)
import UIKit
#endif

@MainActor
final class BiometricGate: ObservableObject {
    @Published var isUnlocked: Bool = false
    @Published var lastError: String?

    private let backgroundLockGraceSeconds: TimeInterval = 30
    private var didEnterBackgroundAt: Date?

    init() {
        observeLifecycle()
    }

    func unlock() async {
        let context = LAContext()
        context.localizedFallbackTitle = "Use passcode"

        var nsError: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &nsError) else {
            self.lastError = nsError?.localizedDescription ?? "biometric unavailable"
            return
        }

        do {
            try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: "Unlock Atlas to view treasury"
            )
            self.isUnlocked = true
            self.lastError = nil
        } catch {
            self.isUnlocked = false
            self.lastError = error.localizedDescription
        }
    }

    func lock() {
        isUnlocked = false
    }

    // MARK: - Lifecycle

    private func observeLifecycle() {
        #if canImport(UIKit)
        NotificationCenter.default.addObserver(
            self, selector: #selector(handleBackground),
            name: UIApplication.didEnterBackgroundNotification, object: nil
        )
        NotificationCenter.default.addObserver(
            self, selector: #selector(handleForeground),
            name: UIApplication.willEnterForegroundNotification, object: nil
        )
        #endif
    }

    @objc private func handleBackground() {
        didEnterBackgroundAt = Date()
    }

    @objc private func handleForeground() {
        guard let entered = didEnterBackgroundAt else { return }
        if Date().timeIntervalSince(entered) > backgroundLockGraceSeconds {
            isUnlocked = false
        }
        didEnterBackgroundAt = nil
    }
}
