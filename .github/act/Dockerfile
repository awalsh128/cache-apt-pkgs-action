FROM ghcr.io/catthehacker/ubuntu:act-latest

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Keep local runner dependencies explicit so act behavior stays close to ubuntu-latest.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  git \
  gnupg \
  jq \
  lsb-release \
  sudo \
  unzip \
  wget \
  xz-utils \
  && rm -rf /var/lib/apt/lists/*
