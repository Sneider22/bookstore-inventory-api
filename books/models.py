from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


class Book(models.Model):
    """
    Modelo que representa un libro dentro del inventario de la librería.
    """
    title = models.CharField(max_length=255, verbose_name="Título")
    author = models.CharField(max_length=255, verbose_name="Autor")

    # unique=True impide libros duplicados con el mismo ISBN a nivel de BD
    isbn = models.CharField(
        max_length=20,
        unique=True,
        verbose_name="ISBN",
        help_text="Código ISBN de 10 o 13 dígitos"
    )

    # Costo en USD: estrictamente mayor a 0
    cost_usd = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        verbose_name="Costo en USD"
    )

    # Inicia en null hasta que se ejecute POST /books/{id}/calculate-price
    selling_price_local = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        default=None,
        verbose_name="Precio de venta local"
    )

    # Moneda usada en el último cálculo de precio (ej: "EUR", "VES", "USD")
    price_currency = models.CharField(
        max_length=10,
        null=True,
        blank=True,
        default=None,
        verbose_name="Moneda del último cálculo"
    )

    # Tasa de cambio aplicada en el último cálculo
    price_exchange_rate = models.DecimalField(
        max_digits=20,
        decimal_places=6,
        null=True,
        blank=True,
        default=None,
        verbose_name="Tasa de cambio aplicada"
    )

    # No puede ser negativo (mínimo 0)
    stock_quantity = models.PositiveIntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name="Cantidad en stock"
    )

    category = models.CharField(max_length=100, verbose_name="Categoría")
    supplier_country = models.CharField(max_length=10, verbose_name="País proveedor")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "books"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.isbn})"