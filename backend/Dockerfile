# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────────────────────────────────────────
FROM ubuntu:22.04 AS builder

# Avoid interactive tzdata prompts
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    ninja-build \
    git \
    curl \
    pkg-config \
    libssl-dev \
    libboost-all-dev \
    libpqxx-dev \
    nlohmann-json3-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy only CMakeLists and source first for layer caching
COPY CMakeLists.txt .
COPY src/ ./src/
COPY include/ ./include/

RUN cmake -S . -B build \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_TESTS=OFF \
    -G Ninja \
  && cmake --build build --parallel $(nproc)

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime
# ─────────────────────────────────────────────────────────────────────────────
FROM ubuntu:22.04 AS runtime

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    libssl3 \
    libboost-system1.74.0 \
    libpqxx-6.4* \
    libpq5 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -r -u 1001 -g root connectx

WORKDIR /app

COPY --from=builder /build/build/bin/connectx ./connectx
RUN chmod +x ./connectx && chown connectx:root ./connectx

USER connectx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

ENTRYPOINT ["./connectx"]
