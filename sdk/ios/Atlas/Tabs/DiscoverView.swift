// Discover tab — curated public surface (proofs, deployments,
// market intel) for non-operators.

import SwiftUI

struct DiscoverView: View {
    @EnvironmentObject var session: AtlasSession

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    DiscoverCard(
                        title: "Solana network",
                        kicker: "tps · fees · validators",
                        body: "Live infra readout, identical to /infra on the web."
                    )
                    DiscoverCard(
                        title: "Latest proofs",
                        kicker: "verifiable",
                        body: "Most recent zk attestations across all public Atlas vaults."
                    )
                    DiscoverCard(
                        title: "Top vaults",
                        kicker: "tvl · proof velocity",
                        body: "Operators ranked by proof generation cadence and reserve attestations."
                    )
                    DiscoverCard(
                        title: "Atlas blueprint",
                        kicker: "architecture",
                        body: "End-to-end view of how a quorum becomes a settlement on mainnet."
                    )
                }
                .padding(16)
            }
            .background(AtlasColor.surface.ignoresSafeArea())
            .navigationTitle("Discover")
        }
    }
}

struct DiscoverCard: View {
    let title: String
    let kicker: String
    let body: String

    var content: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(kicker.uppercased())
                .font(.system(size: 10, weight: .semibold)).tracking(1.2)
                .foregroundStyle(AtlasColor.ink3)
            Text(title).font(.system(size: 18, weight: .semibold))
                .foregroundStyle(AtlasColor.ink)
            Text(body).foregroundStyle(AtlasColor.ink2).font(.system(size: 13))
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColor.raised)
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    var body: some View { content }
}
