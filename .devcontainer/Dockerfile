FROM mcr.microsoft.com/devcontainers/java:1-17-bullseye

RUN rm -f /etc/apt/sources.list.d/yarn.list \
    && apt-get update || apt-get update --allow-insecure-repositories \
    && apt-get install -y --no-install-recommends \
       ffmpeg \
       mariadb-client \
       python3-pip \
       python3-dev \
       gcc \
       g++ \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# torch 별도 설치 (CPU 버전)
RUN pip3 install torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu

RUN pip3 install 'git+https://github.com/facebookresearch/detectron2.git'

# 나머지 패키지 설치
COPY requirements.txt /tmp/requirements.txt
RUN pip3 install -r /tmp/requirements.txt

WORKDIR /workspaces