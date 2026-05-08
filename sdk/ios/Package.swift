// swift-tools-version: 5.9
//
// Atlas iOS — SwiftPM manifest for the public surface (Phase 24 §5).
// The Xcode app project lives under `Atlas.xcodeproj` (not checked in
// for the hackathon — the SwiftUI code is the canonical source).
//
// This manifest exists so CI can `swift build` the non-UIKit modules
// (Models, Networking) headlessly.

import PackageDescription

let package = Package(
    name: "Atlas",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "AtlasModels",     targets: ["AtlasModels"]),
        .library(name: "AtlasNetworking", targets: ["AtlasNetworking"]),
    ],
    targets: [
        .target(name: "AtlasModels",     path: "Atlas/Models"),
        .target(name: "AtlasNetworking",
                dependencies: ["AtlasModels"],
                path: "Atlas/Networking"),
    ]
)
