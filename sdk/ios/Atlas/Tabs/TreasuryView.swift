// Treasury tab — vault list + headline KPIs.

import SwiftUI

struct TreasuryView: View {
    @EnvironmentObject var session: AtlasSession

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    headerKPIs
                    vaultList
                }
                .padding(16)
            }
            .background(AtlasColor.surface.ignoresSafeArea())
            .navigationTitle("Treasury")
        }
        .task { await session.refreshTreasury() }
    }

    private var headerKPIs: some View {
        HStack(spacing: 12) {
            KpiTile(label: "TVL", value: session.treasuryTvlFormatted, tone: .neutral)
            KpiTile(label: "Vaults", value: "\(session.vaults.count)", tone: .neutral)
            KpiTile(label: "Last rebalance", value: session.lastRebalanceAge, tone: .good)
        }
    }

    private var vaultList: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("VAULTS")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(AtlasColor.ink3)
                .tracking(1.6)
                .padding(.bottom, 8)

            ForEach(session.vaults) { v in
                NavigationLink(destination: VaultDetailView(vault: v)) {
                    VaultRow(vault: v)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct VaultRow: View {
    let vault: Vault

    var body: some View {
        HStack(spacing: 12) {
            Circle().fill(AtlasColor.electric.opacity(0.18))
                .frame(width: 28, height: 28)
                .overlay(Text(vault.label.prefix(1)).foregroundStyle(AtlasColor.electric))
            VStack(alignment: .leading, spacing: 2) {
                Text(vault.label).foregroundStyle(AtlasColor.ink)
                Text(vault.shortId).font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(AtlasColor.ink3)
            }
            Spacer()
            Text(vault.tvlFormatted)
                .font(.system(size: 14, weight: .medium, design: .monospaced))
                .foregroundStyle(AtlasColor.ink)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 14)
        .background(AtlasColor.raised)
        .overlay(Rectangle().fill(AtlasColor.line).frame(height: 1), alignment: .bottom)
    }
}

struct VaultDetailView: View {
    let vault: Vault
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(vault.label).font(.system(size: 22, weight: .semibold))
                Text(vault.id).font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(AtlasColor.ink3)
                Text("Detail view stub — Phase 24 §5.2 only ships the tab shells; per-vault deep dive is wired to the operator surface in Phase 23.")
                    .foregroundStyle(AtlasColor.ink2)
            }
            .padding(16)
        }
        .background(AtlasColor.surface.ignoresSafeArea())
        .navigationTitle("Vault")
    }
}

struct KpiTile: View {
    enum Tone { case neutral, good, warn, bad }
    let label: String
    let value: String
    let tone: Tone

    private var ruleColor: Color {
        switch tone {
        case .neutral: return AtlasColor.line
        case .good:    return AtlasColor.proof
        case .warn:    return AtlasColor.warn
        case .bad:     return AtlasColor.danger
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .semibold))
                .tracking(1.2)
                .foregroundStyle(AtlasColor.ink3)
            Text(value).font(.system(size: 18, weight: .semibold, design: .monospaced))
                .foregroundStyle(AtlasColor.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 10)
        .padding(.horizontal, 12)
        .background(AtlasColor.raised)
        .overlay(Rectangle().fill(ruleColor).frame(width: 2), alignment: .leading)
        .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}
