FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim

WORKDIR /app

# Install Terraform (provider downloads on first validate request)
RUN apt-get update && apt-get install -y --no-install-recommends wget unzip \
    && wget -q https://releases.hashicorp.com/terraform/1.5.7/terraform_1.5.7_linux_amd64.zip \
    && unzip terraform_1.5.7_linux_amd64.zip -d /usr/local/bin/ \
    && rm terraform_1.5.7_linux_amd64.zip \
    && apt-get purge -y wget unzip && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

ENV TF_PLUGIN_CACHE_DIR=/app/.terraform_cache
RUN mkdir -p $TF_PLUGIN_CACHE_DIR

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY backend/ ./

COPY --from=frontend-builder /app/frontend/dist ./static

EXPOSE 8000

CMD ["gunicorn", "app.main:app", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120"]