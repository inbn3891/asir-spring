# 자바 17 기반 (VS Code 개발용 이미지 권장)
FROM mcr.microsoft.com/devcontainers/java:1-17-bullseye

# 영상 다이어트용 FFmpeg 및 필수 도구 설치
RUN rm -f /etc/apt/sources.list.d/yarn.list \
    && apt-get update || apt-get update --allow-insecure-repositories \
    && apt-get install -y --no-install-recommends \
       ffmpeg \
       mariadb-client \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 작업 디렉토리 설정
WORKDIR /workspaces