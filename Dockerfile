# Ena slika: zgradi Vue frontend in ga streže skupaj s FastAPI zaledjem na :8000

# 1) frontend
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# ključ za PostHog (anonimna statistika) se vgradi ob gradnji; brez njega je statistika izklopljena
ARG VITE_POSTHOG_KEY=""
ENV VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY
RUN npm run build

# 2) zaledje + zgrajen frontend
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    FRONTEND_DIST=/app/frontend/dist \
    DATABASE_URL=sqlite:////app/db/zrak.db
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=web /web/dist /app/frontend/dist
RUN mkdir -p /app/db
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
