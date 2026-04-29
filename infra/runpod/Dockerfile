FROM nvidia/cuda:12.4.0-devel-ubuntu22.04

RUN apt-get update && apt-get install -y \
    curl git build-essential pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"

RUN curl -L https://sp1.succinct.xyz | bash && /root/.sp1/bin/sp1up

WORKDIR /app
COPY . .

RUN cargo build --release --bin atlas-orchestrator

ENV SP1_PROVER=cuda
ENV RUST_LOG=info,atlas_orchestrator=debug

CMD ["./target/release/atlas-orchestrator"]
