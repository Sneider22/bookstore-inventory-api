# ──────────────────────────────────────────────
# Backend – Django REST API
# ──────────────────────────────────────────────
FROM python:3.12-slim

# Evita bytecode .pyc y buffers en stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código fuente
COPY . .

EXPOSE 8000

# Script de arranque:
#  1. Aplica migraciones (incluye los nuevos campos price_currency / price_exchange_rate)
#  2. Carga el catálogo inicial de libros desde el fixture
#  3. Levanta el servidor en 0.0.0.0 para que Docker lo exponga
CMD ["sh", "-c", \
    "python manage.py migrate --noinput && \
     python manage.py loaddata books/fixtures/initial_books.json && \
     python manage.py runserver 0.0.0.0:8000"]
