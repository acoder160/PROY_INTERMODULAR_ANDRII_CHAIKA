# PostgreSQL 17 + PostGIS 3 from the PGDG apt repository that the official image already
# configures. Builds for arm64 too (the postgis/postgis images are amd64 only).
FROM postgres:17-bookworm
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-17-postgis-3 \
    && rm -rf /var/lib/apt/lists/*
