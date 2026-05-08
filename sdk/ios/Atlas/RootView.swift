// RootView — five-tab shell (Phase 24 §5.2).

import SwiftUI

struct RootView: View {
    var body: some View {
        TabView {
            TreasuryView()
                .tabItem { Label("Treasury", systemImage: "rectangle.stack") }

            ActivityView()
                .tabItem { Label("Activity", systemImage: "waveform.path.ecg") }

            AlertsView()
                .tabItem { Label("Alerts", systemImage: "bell.badge") }

            ApprovalsView()
                .tabItem { Label("Approvals", systemImage: "signature") }

            DiscoverView()
                .tabItem { Label("Discover", systemImage: "sparkles") }
        }
    }
}

// ─────────────────────────────────────────────────────────────────
// AtlasColor — minimal token bridge so all views agree on palette.
// ─────────────────────────────────────────────────────────────────

enum AtlasColor {
    static let raised   = Color(red: 0.055, green: 0.07,  blue: 0.10)
    static let surface  = Color(red: 0.04,  green: 0.055, blue: 0.08)
    static let line     = Color(red: 0.115, green: 0.135, blue: 0.187)
    static let ink      = Color(red: 0.905, green: 0.918, blue: 0.94)
    static let ink2     = Color(red: 0.785, green: 0.815, blue: 0.866)
    static let ink3     = Color(red: 0.535, green: 0.578, blue: 0.659)
    static let electric = Color(red: 0.416, green: 0.651, blue: 1.0)
    static let zk       = Color(red: 0.604, green: 0.518, blue: 1.0)
    static let proof    = Color(red: 0.357, green: 0.882, blue: 0.628)
    static let warn     = Color(red: 0.945, green: 0.847, blue: 0.471)
    static let danger   = Color(red: 1.0,   green: 0.545, blue: 0.545)
}
