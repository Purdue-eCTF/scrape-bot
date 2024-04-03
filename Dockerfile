FROM --platform=linux/amd64 nixos/nix:2.19.3

RUN echo "filter-syscalls = false" >> /etc/nix/nix.conf
RUN nix-channel --update && \
    nix-env -iA nixpkgs.gh && \
    nix-env -iA nixpkgs.curl && \
    nix-env -iA nixpkgs.unzip && \
    nix-env -iA nixpkgs.zulu17 && \
    nix-env -iA nixpkgs.nodejs_21 && \
    nix-env -iA nixpkgs.cached-nix-shell

WORKDIR /app
COPY . .
RUN curl -LOL https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_11.0.2_build/ghidra_11.0.2_PUBLIC_20240326.zip && \
    unzip ghidra_11.0.2_PUBLIC_20240326.zip && \
    rm ghidra_11.0.2_PUBLIC_20240326.zip
RUN mkdir ghidra_proj
RUN npm i

RUN cd default-nix-cache && cached-nix-shell --run "cargo install cargo-make"

CMD ["npm", "run", "testAttackPipeline"]
