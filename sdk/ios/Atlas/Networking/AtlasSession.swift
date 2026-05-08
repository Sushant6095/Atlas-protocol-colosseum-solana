// AtlasSession — single source of truth for the iOS app.
// Owns the network client + observable state for all five tabs.

import Foundation

@MainActor
final class AtlasSession: ObservableObject {
    @Published private(set) var vaults: [Vault] = []
    @Published private(set) var activity: [ActivityEvent] = []
    @Published private(set) var alerts: [AlertItem] = []
    @Published private(set) var approvals: [ApprovalItem] = []

    @Published private(set) var treasuryTvlFormatted: String = "—"
    @Published private(set) var lastRebalanceAge: String = "—"

    private let client: AtlasClient
    private let signer: MWASigner

    init(client: AtlasClient = .shared, signer: MWASigner = MockMWASigner()) {
        self.client = client
        self.signer = signer
    }

    func refreshTreasury() async {
        do {
            let t = try await client.fetchTreasury()
            self.vaults = t.vaults
            self.treasuryTvlFormatted = humanize(atomic: t.totalTvlAtomic, decimals: t.decimals)
            self.lastRebalanceAge = relativeTime(fromMs: t.lastRebalanceAtMs)
        } catch {
            // Silent fall-through — operator surfaces show errors only when they
            // cause a stale tile.
        }
    }

    func refreshActivity() async {
        if let events = try? await client.fetchActivity() {
            self.activity = events
        }
    }

    func refreshAlerts() async {
        if let items = try? await client.fetchAlerts() {
            self.alerts = items
        }
    }

    func refreshApprovals() async {
        if let items = try? await client.fetchApprovals() {
            self.approvals = items
        }
    }

    func acknowledge(_ alert: AlertItem) async {
        try? await client.acknowledgeAlert(id: alert.id)
        await refreshAlerts()
    }

    func submitDecision(_ approval: ApprovalItem, decision: ApprovalDecision) async {
        switch decision {
        case .reject:
            try? await client.rejectApproval(id: approval.id)
        case .approve:
            do {
                let signed = try await signer.signTransaction(
                    unsignedTxBase64: approval.unsignedTxBase64,
                    explanationHash: approval.explanationHash,
                    vaultId: approval.vaultId
                )
                try await client.submitApproval(id: approval.id, signedTxBase64: signed)
            } catch {
                // Surface via a separate error channel in a follow-up phase.
            }
        }
        await refreshApprovals()
    }
}
