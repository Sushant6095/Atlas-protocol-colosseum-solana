// Activity tab — proven rebalance + alert stream.

import SwiftUI

struct ActivityView: View {
    @EnvironmentObject var session: AtlasSession

    var body: some View {
        NavigationStack {
            List(session.activity) { event in
                ActivityRow(event: event)
                    .listRowBackground(AtlasColor.raised)
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(AtlasColor.surface.ignoresSafeArea())
            .navigationTitle("Activity")
            .refreshable { await session.refreshActivity() }
        }
        .task { await session.refreshActivity() }
    }
}

struct ActivityRow: View {
    let event: ActivityEvent

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Circle().fill(toneColor.opacity(0.25))
                .frame(width: 8, height: 8).padding(.top, 6)
            VStack(alignment: .leading, spacing: 4) {
                Text(event.headline).foregroundStyle(AtlasColor.ink)
                Text(event.summary)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(AtlasColor.ink2)
                HStack(spacing: 8) {
                    Text("slot \(event.slot)")
                    Text("·")
                    Text(event.relativeTime)
                    if let hash = event.publicInputHashShort {
                        Text("·")
                        Text(hash).foregroundStyle(AtlasColor.electric)
                    }
                }
                .font(.system(size: 11))
                .foregroundStyle(AtlasColor.ink3)
            }
        }
        .padding(.vertical, 4)
    }

    private var toneColor: Color {
        switch event.tone {
        case .info:  return AtlasColor.electric
        case .good:  return AtlasColor.proof
        case .warn:  return AtlasColor.warn
        case .bad:   return AtlasColor.danger
        }
    }
}
