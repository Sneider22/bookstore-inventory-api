from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Book
from .serializers import BookSerializer
from .services import calculate_book_selling_price


class BookViewSet(viewsets.ModelViewSet):
    """
    Controlador principal de la API de libros.
    Provee automáticamente los endpoints CRUD estándar:
      - GET    /books/           (Listar paginado)
      - POST   /books/           (Crear libro)
      - GET    /books/{id}/      (Obtener por ID)
      - PUT    /books/{id}/      (Actualizar libro completo)
      - PATCH  /books/{id}/      (Actualización parcial)
      - DELETE /books/{id}/      (Eliminar libro)
    Y define acciones personalizadas para filtros y cálculo de precios.
    """
    queryset = Book.objects.all()
    serializer_class = BookSerializer

    @action(detail=False, methods=["get"], url_path="search")
    def search_by_category(self, request):
        """
        GET /books/search?category={category}
        Filtra libros por categoría (insensible a mayúsculas/minúsculas).
        """
        category = request.query_params.get("category", "").strip()
        if not category:
            return Response(
                {"error": "Debes proporcionar el parámetro 'category' en la consulta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        books = self.queryset.filter(category__icontains=category)
        page = self.paginate_queryset(books)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(books, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="low-stock")
    def low_stock(self, request):
        """
        GET /books/low-stock?threshold=10
        Retorna libros cuyo stock_quantity sea menor o igual al umbral indicado (default: 10).
        """
        threshold_param = request.query_params.get("threshold", "10")
        try:
            threshold = int(threshold_param)
            if threshold < 0:
                raise ValueError
        except ValueError:
            return Response(
                {"error": "El parámetro 'threshold' debe ser un número entero mayor o igual a 0."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        books = self.queryset.filter(stock_quantity__lte=threshold).order_by("stock_quantity")
        page = self.paginate_queryset(books)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(books, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="calculate-price")
    def calculate_price(self, request, pk=None):
        """
        POST /books/{id}/calculate-price
        Calcula el precio de venta sugerido usando la tasa de cambio actual (EUR por defecto)
        con un margen del 40%, actualiza selling_price_local en BD y retorna el desglose.
        """
        book = self.get_object()  # Retorna 404 automáticamente si el ID no existe
        currency = request.data.get("currency", "EUR")

        try:
            result = calculate_book_selling_price(book=book, currency=currency)
            # Persistir moneda y tasa de cambio usadas en el último cálculo
            book.price_currency = result.get("currency")
            book.price_exchange_rate = result.get("exchange_rate")
            book.save(update_fields=["price_currency", "price_exchange_rate"])
            return Response(result, status=status.HTTP_200_OK)
        except Exception as exc:
            return Response(
                {"error": "Error interno al procesar el cálculo de precio.", "detail": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )