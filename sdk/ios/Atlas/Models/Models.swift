// Atlas iOS models — Phase 24 §5.

import Foundation
import SwiftUI

// MARK: - Vault

public struct Vault: Identifiable, Hashable, Decodable {
    public let id: String
    public let label: String
    public let tvlAtomic: String
    public let decimals: Int

    public var shortId: String {
        guard id.count > 12 else { return id }
        return id.prefix(6) + "…" + id.suffix(4)
    }

    public var tvlFormatted: String {
        humanize(atomic: tvlAtomic, decimals: decimals)
    }
}

// MARK: - Activity

public struct ActivityEvent: Identifiable, Decodable {
    public enum Tone: String, Decodable { case info, good, warn, bad }

    public let id: String
    public let slot: Int
    public let emittedAtMs: Int64
    public let headline: String
    public let summary: String
    public let publicInputHash: String?
    public let tone: Tone

    public var publicInputHashShort: String? {
        guard let h = publicInputHash, h.count > 8 else { return publicInputHash }
        return String(h.prefix(8))
    }

    public var relativeTime: String {
        relativeTime(fromMs: emittedAtMs)
    }
}

// MARK: - Alerts

public struct AlertItem: Identifiable, Decodable {
    public enum Severity: String, Decodable {
        case info, warning, critical
        var label: String {
            switch self { case .info: return "INFO"; case .warning: return "WARN"; case .critical: return "CRIT" }
        }
        var color: Color {
            switch self {
            case .info:     return AtlasColor.electric
            case .warning:  return AtlasColor.warn
            case .critical: return AtlasColor.danger
            }
        }
    }

    public let id: String
    public let severity: Severity
    public let title: String
    public let detail: String
    public let emittedAtMs: Int64

    public var relativeTime: String { relativeTime(fromMs: emittedAtMs) }
}

// MARK: - Approvals

public struct BalanceDelta: Identifiable, Decodable {
    public let mint: String
    public let delta: String
    public var id: String { mint }
}

public enum ApprovalDecision { case approve, reject }

public struct ApprovalItem: Identifiable, Decodable {
    public let id: String
    public let label: String
    public let summary: String
    public let headline: String
    public let programs: [String]
    public let balanceDeltas: [BalanceDelta]
    public let risks: [String]
    public let signaturesCollected: Int
    public let signaturesRequired: Int
    public let explanationHash: String
    public let unsignedTxBase64: String
    public let vaultId: String
}

// MARK: - Helpers

func humanize(atomic: String, decimals: Int) -> String {
    let neg = atomic.hasPrefix("-")
    let digits = neg ? String(atomic.dropFirst()) : atomic
    if decimals <= 0 { return digits }
    let pad = String(repeating: "0", count: max(0, decimals + 1 - digits.count)) + digits
    let intPart = String(pad.prefix(pad.count - decimals))
    let fracPart = String(pad.suffix(decimals)).trimmingCharacters(in: CharacterSet(charactersIn: "0").union(.init()))
    let intNum = Int64(intPart) ?? 0
    let fmt = NumberFormatter()
    fmt.numberStyle = .decimal
    let intStr = fmt.string(from: NSNumber(value: intNum)) ?? "\(intNum)"
    let fracStr = fracPart.isEmpty ? "" : "." + fracPart.prefix(4)
    return "\(neg ? "-" : "")\(intStr)\(fracStr)"
}

func relativeTime(fromMs ms: Int64) -> String {
    let elapsed = Date().timeIntervalSince1970 - Double(ms) / 1000
    if elapsed < 60 { return "\(Int(elapsed))s ago" }
    if elapsed < 3600 { return "\(Int(elapsed / 60))m ago" }
    if elapsed < 86400 { return "\(Int(elapsed / 3600))h ago" }
    return "\(Int(elapsed / 86400))d ago"
}
