# Atlas iOS

SwiftUI app — Phase 24 §5. Five tabs (Treasury, Activity, Alerts,
Approvals, Discover), biometric gate, MWA-delegated signing.

## Layout

```
Atlas/
  AtlasApp.swift             entry point + biometric gate
  RootView.swift             5-tab shell + AtlasColor tokens
  Tabs/                      one file per tab
  Signing/                   BiometricGate, MWA contract, lock screen
  Networking/                AtlasSession (state) + AtlasClient (HTTP)
  Models/                    Vault, ActivityEvent, AlertItem, ApprovalItem
APP_STORE_NOTES.md           submission record
Package.swift                SwiftPM for non-UI modules so CI can build headlessly
```

## Build

The full UI app lives in an `Atlas.xcodeproj` not checked in (the
SwiftUI sources are canonical). Open in Xcode 15+ and add the Models
+ Networking targets via SwiftPM.

For headless validation:

```bash
swift build
```

## Wallet integration

`Signing/MWASigner.swift` is the protocol the host app implements
against the official `solana-mobile/SolanaMobileWalletAdapter` Swift
package. The Atlas core never imports private-key APIs.
