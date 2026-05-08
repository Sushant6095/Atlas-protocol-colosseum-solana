// MWASigner — Mobile Wallet Adapter delegated signing (Phase 24 §5.3).
//
// Atlas never holds private keys on iOS. We package the unsigned
// transaction + Atlas explanation hash + Squads vault context into
// the MWA `signTransactions` request and let the user-installed
// wallet (Phantom, Solflare, Backpack…) handle key custody. The
// signed payload comes back to us, we relay it to the Atlas
// /api/v1/approvals/{id}/submit endpoint.
//
// This file is the protocol surface — the concrete MWA bridge is
// owned by the host app's `solana-mobile/SolanaMobileWalletAdapter`
// dependency, kept out of SwiftPM here for hackathon scope.

import Foundation

public protocol MWASigner {
    /// Hand a base64-encoded unsigned transaction to the user's wallet.
    /// Returns the base64 signed transaction.
    func signTransaction(
        unsignedTxBase64: String,
        explanationHash: String,
        vaultId: String
    ) async throws -> String
}

public struct MWAUnavailableError: LocalizedError {
    public var errorDescription: String? {
        "No wallet found. Install Phantom or Solflare from the App Store, then return to Atlas."
    }
}

public struct MockMWASigner: MWASigner {
    public init() {}

    public func signTransaction(
        unsignedTxBase64: String,
        explanationHash: String,
        vaultId: String
    ) async throws -> String {
        // Stub for previews / Xcode tests. Real impl wired in the host app.
        try await Task.sleep(nanoseconds: 300_000_000)
        return unsignedTxBase64
    }
}
