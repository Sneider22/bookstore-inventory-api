import logging
from decimal import Decimal, ROUND_HALF_UP
from django.utils import timezone
import requests

logger = logging.getLogger(__name__)

# Endpoint gratuito requerido por la prueba técnica
EXCHANGE_API_URL = "https://api.exchangerate-api.com/v4/latest/USD"

# Tasas de respaldo por si la API externa falla o tarda demasiado (Regla de Negocio)
FALLBACK_RATES = {
    "EUR": Decimal("0.85"),   # Tasa de referencia del enunciado
    "VES": Decimal("45.00"),  # Tasa de respaldo en Bolívares
    "USD": Decimal("1.00"),
}

# Margen de ganancia fijo del 40% según requerimiento
MARGIN_PERCENTAGE = Decimal("40")


def fetch_exchange_rate(target_currency: str = "EUR") -> tuple[Decimal, bool]:
    """
    Consulta la tasa de cambio actual USD -> moneda local desde exchangerate-api.com.
    Retorna una tupla: (tasa_de_cambio, uso_fallback).
    Si la API falla, cae de forma segura en FALLBACK_RATES sin tumbar el endpoint.
    """
    currency = target_currency.upper().strip()

    try:
        # Timeout de 5 segundos para evitar que una caída externa congele el servidor
        response = requests.get(EXCHANGE_API_URL, timeout=5)
        response.raise_for_status()
        data = response.json()

        rates = data.get("rates", {})
        if currency not in rates:
            raise ValueError(f"Moneda '{currency}' no soportada por la API de cambio.")

        rate = Decimal(str(rates[currency]))
        return rate, False

    except (requests.RequestException, ValueError, KeyError) as exc:
        # Registramos el fallo en consola/logs pero aplicamos la tasa por defecto
        logger.warning(
            "Fallo al consultar API de tasas (%s). Usando tasa de respaldo para %s.",
            exc,
            currency,
        )
        fallback_rate = FALLBACK_RATES.get(currency, FALLBACK_RATES["EUR"])
        return fallback_rate, True


def calculate_book_selling_price(book, currency: str = "EUR") -> dict:
    """
    Ejecuta la lógica de negocio completa para calcular el precio de venta sugerido:
    1. Toma cost_usd del libro.
    2. Obtiene tasa de cambio USD -> moneda local (EUR por defecto).
    3. Convierte el costo a moneda local y aplica margen del 40%.
    4. Actualiza selling_price_local en la base de datos.
    5. Retorna el desglose exacto solicitado por el contrato JSON.
    """
    target_currency = currency.upper().strip() if currency else "EUR"
    exchange_rate, used_fallback = fetch_exchange_rate(target_currency)

    # Costo en moneda local redondeado a 2 decimales
    cost_local = (book.cost_usd * exchange_rate).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    # Aplicación del margen del 40%: cost_local * 1.40
    margin_multiplier = Decimal("1") + (MARGIN_PERCENTAGE / Decimal("100"))
    selling_price_local = (cost_local * margin_multiplier).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    # Persistimos el nuevo precio calculado en la base de datos
    book.selling_price_local = selling_price_local
    book.save(update_fields=["selling_price_local", "updated_at"])

    return {
        "book_id": book.id,
        "cost_usd": float(book.cost_usd),
        "exchange_rate": float(exchange_rate),
        "cost_local": float(cost_local),
        "margin_percentage": int(MARGIN_PERCENTAGE),
        "selling_price_local": float(selling_price_local),
        "currency": target_currency,
        "used_fallback": used_fallback,
        "calculation_timestamp": timezone.now().isoformat().replace("+00:00", "Z"),
    }