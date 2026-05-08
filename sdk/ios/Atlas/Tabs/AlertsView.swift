// Alerts tab — Phase 24 §5.2.

import SwiftUI

struct AlertsView: View {
    @EnvironmentObject var session: AtlasSession

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if session.alerts.isEmpty {
                        emptyState
                    } else {
                        ForEach(session.alerts) { alert in
                            AlertCard(alert: alert) {
                                Task { await session.acknowledge(alert) }
                            }
                        }
                    }
                }
                .padding(16)
            }
            .background(AtlasColor.surface.ignoresSafeArea())
            .navigationTitle("Alerts")
        }
        .task { await session.refreshAlerts() }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("All clear.").font(.system(size: 18, weight: .semibold))
                .foregroundStyle(AtlasColor.ink)
            Text("Atlas pushes alerts here when freshness, drift, or proof verification breaches your vault thresholds.")
                .foregroundStyle(AtlasColor.ink2)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColor.raised)
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}

struct AlertCard: View {
    let alert: AlertItem
    let onAcknowledge: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(alert.severity.label)
                    .font(.system(size: 10, weight: .bold))
                    .tracking(1.2)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(alert.severity.color.opacity(0.18))
                    .foregroundStyle(alert.severity.color)
                    .clipShape(RoundedRectangle(cornerRadius: 3))
                Spacer()
                Text(alert.relativeTime)
                    .font(.system(size: 11)).foregroundStyle(AtlasColor.ink3)
            }
            Text(alert.title).foregroundStyle(AtlasColor.ink).font(.system(size: 16, weight: .medium))
            Text(alert.detail).foregroundStyle(AtlasColor.ink2).font(.system(size: 13))
            Button("Acknowledge", action: onAcknowledge)
                .font(.system(size: 12))
                .padding(.top, 4)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColor.raised)
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}
