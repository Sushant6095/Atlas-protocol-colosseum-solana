// AtlasClient — typed wrapper around /api/v1.

import Foundation

public final class AtlasClient {
    public static let shared = AtlasClient()

    public var baseURL: URL = URL(string: "https://app.atlas.example")!
    public var bearerToken: String?

    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    // MARK: - Treasury

    public struct TreasuryResponse: Decodable {
        public let vaults: [Vault]
        public let totalTvlAtomic: String
        public let decimals: Int
        public let lastRebalanceAtMs: Int64
    }

    public func fetchTreasury() async throws -> TreasuryResponse {
        try await get(path: "/api/v1/treasury")
    }

    public func fetchActivity() async throws -> [ActivityEvent] {
        struct Wrap: Decodable { let events: [ActivityEvent] }
        let w: Wrap = try await get(path: "/api/v1/activity?limit=80")
        return w.events
    }

    public func fetchAlerts() async throws -> [AlertItem] {
        struct Wrap: Decodable { let alerts: [AlertItem] }
        let w: Wrap = try await get(path: "/api/v1/alerts")
        return w.alerts
    }

    public func fetchApprovals() async throws -> [ApprovalItem] {
        struct Wrap: Decodable { let approvals: [ApprovalItem] }
        let w: Wrap = try await get(path: "/api/v1/approvals")
        return w.approvals
    }

    public func acknowledgeAlert(id: String) async throws {
        try await post(path: "/api/v1/alerts/\(id)/ack", body: EmptyBody())
    }

    public func rejectApproval(id: String) async throws {
        try await post(path: "/api/v1/approvals/\(id)/reject", body: EmptyBody())
    }

    public func submitApproval(id: String, signedTxBase64: String) async throws {
        struct Body: Encodable { let signed_tx_base64: String }
        try await post(path: "/api/v1/approvals/\(id)/submit", body: Body(signed_tx_base64: signedTxBase64))
    }

    // MARK: - HTTP

    private struct EmptyBody: Encodable {}

    private func get<T: Decodable>(path: String) async throws -> T {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        applyAuth(&req)
        let (data, resp) = try await session.data(for: req)
        try check(resp)
        return try decode(data)
    }

    private func post<B: Encodable>(path: String, body: B) async throws {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        applyAuth(&req)
        req.httpBody = try JSONEncoder().encode(body)
        let (_, resp) = try await session.data(for: req)
        try check(resp)
    }

    private func applyAuth(_ req: inout URLRequest) {
        if let t = bearerToken {
            req.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization")
        }
    }

    private func check(_ resp: URLResponse) throws {
        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw NSError(domain: "AtlasClient", code: -1)
        }
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        let dec = JSONDecoder()
        dec.keyDecodingStrategy = .convertFromSnakeCase
        return try dec.decode(T.self, from: data)
    }
}
