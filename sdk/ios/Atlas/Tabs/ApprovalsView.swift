// Approvals tab — pending Squads / governance signatures.
// MWA-delegated signing flows through MWASigner.

import SwiftUI

struct ApprovalsView: View {
    @EnvironmentObject var session: AtlasSession
    @State private var signing: ApprovalItem?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if session.approvals.isEmpty {
                        emptyState
                    } else {
                        ForEach(session.approvals) { approval in
                            ApprovalCard(approval: approval) { signing = approval }
                        }
                    }
                }
                .padding(16)
            }
            .background(AtlasColor.surface.ignoresSafeArea())
            .navigationTitle("Approvals")
        }
        .task { await session.refreshApprovals() }
        .sheet(item: $signing) { approval in
            PreSignSheet(approval: approval) { decision in
                Task {
                    await session.submitDecision(approval, decision: decision)
                    signing = nil
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("No pending approvals.").font(.system(size: 18, weight: .semibold)).foregroundStyle(AtlasColor.ink)
            Text("Squads-routed transactions awaiting your signature show up here. Atlas surfaces the explanation before you sign.")
                .foregroundStyle(AtlasColor.ink2)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AtlasColor.raised)
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}

struct ApprovalCard: View {
    let approval: ApprovalItem
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(approval.label).foregroundStyle(AtlasColor.ink).font(.system(size: 16, weight: .medium))
                    Spacer()
                    Text("\(approval.signaturesCollected)/\(approval.signaturesRequired)")
                        .font(.system(size: 12, design: .monospaced)).foregroundStyle(AtlasColor.electric)
                }
                Text(approval.summary).foregroundStyle(AtlasColor.ink2).font(.system(size: 13))
                Text(approval.explanationHash)
                    .font(.system(size: 11, design: .monospaced)).foregroundStyle(AtlasColor.ink3)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AtlasColor.raised)
            .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.plain)
    }
}

struct PreSignSheet: View {
    let approval: ApprovalItem
    let onDecision: (ApprovalDecision) -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(approval.label).font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(AtlasColor.ink)
                    Text(approval.headline).foregroundStyle(AtlasColor.ink)
                    if !approval.programs.isEmpty {
                        section(label: "PROGRAMS") {
                            ForEach(approval.programs, id: \.self) { p in
                                Text(p).font(.system(size: 13, design: .monospaced))
                                    .foregroundStyle(AtlasColor.ink2)
                            }
                        }
                    }
                    if !approval.balanceDeltas.isEmpty {
                        section(label: "BALANCE DELTAS") {
                            ForEach(approval.balanceDeltas) { d in
                                HStack {
                                    Text(d.mint).foregroundStyle(AtlasColor.ink2)
                                    Spacer()
                                    Text(d.delta).font(.system(size: 13, design: .monospaced))
                                        .foregroundStyle(d.delta.hasPrefix("-") ? AtlasColor.danger : AtlasColor.proof)
                                }
                            }
                        }
                    }
                    if !approval.risks.isEmpty {
                        section(label: "RISKS") {
                            ForEach(approval.risks, id: \.self) { r in
                                Text("• \(r)").foregroundStyle(AtlasColor.danger).font(.system(size: 13))
                            }
                        }
                    }
                }
                .padding(16)
            }
            .background(AtlasColor.surface.ignoresSafeArea())
            .navigationTitle("Pre-sign")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Reject") { onDecision(.reject) }.tint(AtlasColor.danger)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Approve") { onDecision(.approve) }.tint(AtlasColor.electric)
                }
            }
        }
    }

    @ViewBuilder
    private func section<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.system(size: 10, weight: .semibold)).tracking(1.2)
                .foregroundStyle(AtlasColor.ink3)
            content()
        }
    }
}
