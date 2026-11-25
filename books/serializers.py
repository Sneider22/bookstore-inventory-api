import re
from decimal import Decimal
from rest_framework import serializers
from .models import Book


class BookSerializer(serializers.ModelSerializer):
    """
    Serializador encargado de convertir objetos Book a JSON y viceversa,
    aplicando todas las reglas de negocio antes de guardar en base de datos.
    """

    class Meta:
        model = Book
        fields = [
            "id",
            "title",
            "author",
            "isbn",
            "cost_usd",
            "selling_price_local",
            "price_currency",
            "price_exchange_rate",
            "stock_quantity",
            "category",
            "supplier_country",
            "created_at",
            "updated_at",
        ]
        # Estos campos los gestiona el sistema automáticamente, no el usuario al crear/editar
        read_only_fields = ["id", "selling_price_local", "price_currency", "price_exchange_rate", "created_at", "updated_at"]

    def validate_cost_usd(self, value):
        """Regla de negocio: cost_usd debe ser mayor a 0."""
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("El costo en USD debe ser estrictamente mayor a 0.")
        return value

    def validate_stock_quantity(self, value):
        """Regla de negocio: stock_quantity no puede ser negativo."""
        if value < 0:
            raise serializers.ValidationError("La cantidad en stock no puede ser negativa.")
        return value

    def validate_isbn(self, value):
        """
        Regla de negocio:
        1. Debe tener formato válido de 10 o 13 dígitos (ignorando guiones o espacios).
        2. No permitir libros duplicados con el mismo ISBN.
        """
        # Limpiamos guiones y espacios para contar los dígitos reales
        clean_isbn = re.sub(r"[-\s]", "", value).upper()

        # ISBN-10 puede terminar en dígito o en 'X' (dígito de control 10)
        is_valid_10 = bool(re.match(r"^\d{9}[\dX]$", clean_isbn))
        # ISBN-13 son exactamente 13 dígitos numéricos
        is_valid_13 = bool(re.match(r"^\d{13}$", clean_isbn))

        if not (is_valid_10 or is_valid_13):
            raise serializers.ValidationError(
                "El ISBN debe tener un formato válido de 10 o 13 dígitos."
            )

        # Verificamos duplicados comparando el ISBN limpio (con o sin guiones)
        queryset = Book.objects.all()
        if self.instance:
            # Si estamos actualizando (PUT), excluimos el libro actual de la búsqueda
            queryset = queryset.exclude(pk=self.instance.pk)

        for existing_book in queryset:
            existing_clean = re.sub(r"[-\s]", "", existing_book.isbn).upper()
            if existing_clean == clean_isbn:
                raise serializers.ValidationError(
                    "Ya existe un libro registrado con este número de ISBN."
                )

        return value.strip()