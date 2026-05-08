// BiometricLockScreen — pre-unlock cover view.

import SwiftUI

struct BiometricLockScreen: View {
    @EnvironmentObject var biometrics: BiometricGate

    var body: some View {
        ZStack {
            AtlasColor.surface.ignoresSafeArea()
            VStack(spacing: 18) {
                Spacer()
                Text("ATLAS")
                    .font(.system(size: 32, weight: .semibold, design: .monospaced))
                    .tracking(8)
                    .foregroundStyle(AtlasColor.ink)
                Text("Verifiable AI · Treasury OS")
                    .font(.system(size: 12)).foregroundStyle(AtlasColor.ink3)
                Spacer()
                if let err = biometrics.lastError {
                    Text(err).font(.system(size: 12)).foregroundStyle(AtlasColor.danger)
                }
                Button { Task { await biometrics.unlock() } } label: {
                    Label("Unlock", systemImage: "faceid")
                        .font(.system(size: 16, weight: .medium))
                        .padding(.horizontal, 24).padding(.vertical, 12)
                        .background(AtlasColor.electric.opacity(0.18))
                        .foregroundStyle(AtlasColor.electric)
                        .clipShape(Capsule())
                }
                .padding(.bottom, 36)
            }
        }
        .task { await biometrics.unlock() }
    }
}
