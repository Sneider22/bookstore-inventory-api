from decimal import Decimal
from unittest.mock import Mock, patch
import requests
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Book


class BookAPITestCase(APITestCase):
    """Suite de pruebas unitarias e integración para la API de inventario de libros."""

    def setUp(self):
        self.book_classic = Book.objects.create(
            title="El Quijote",
            author="Miguel de Cervantes",
            isbn="978-84-376-0494-7",
            cost_usd=Decimal("15.99"),
            stock_quantity=25,
            category="Literatura Clásica",
            supplier_country="ES",
        )
        self.book_low_stock = Book.objects.create(
            title="La metamorfosis",
            author="Franz Kafka",
            isbn="978-84-206-5136-1",
            cost_usd=Decimal("22.60"),
            stock_quantity=4,
            category="Novela",
            supplier_country="CZ",
        )

    def _valid_payload(self, **overrides):
        payload = {
            "title": "Cien años de soledad",
            "author": "Gabriel García Márquez",
            "isbn": "978-84-397-2835-1",
            "cost_usd": "19.50",
            "stock_quantity": 18,
            "category": "Realismo Mágico",
            "supplier_country": "CO",
        }
        payload.update(overrides)
        return payload

    # ── Creación (POST /books) ─────────────────────────────────────────────

    def test_create_book_success(self):
        response = self.client.post("/books", self._valid_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Cien años de soledad")
        self.assertIsNone(response.data["selling_price_local"])
        self.assertEqual(Book.objects.count(), 3)

    def test_create_book_invalid_isbn_returns_400(self):
        response = self.client.post(
            "/books", self._valid_payload(isbn="123-invalid"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("isbn", response.data)

    def test_create_book_duplicate_isbn_returns_400(self):
        # Mismo ISBN que self.book_classic pero sin guiones
        response = self.client.post(
            "/books", self._valid_payload(isbn="9788437604947"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("isbn", response.data)

    def test_create_book_non_positive_cost_returns_400(self):
        for bad_cost in ("0.00", "-5.50"):
            response = self.client.post(
                "/books", self._valid_payload(cost_usd=bad_cost), format="json"
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("cost_usd", response.data)

    def test_create_book_negative_stock_returns_400(self):
        response = self.client.post(
            "/books", self._valid_payload(stock_quantity=-1), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("stock_quantity", response.data)

    # ── Lectura (GET /books y GET /books/{id}) ─────────────────────────────

    def test_list_books(self):
        response = self.client.get("/books")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 2)

    def test_retrieve_book_by_id(self):
        response = self.client.get(f"/books/{self.book_classic.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "El Quijote")

    def test_retrieve_nonexistent_book_returns_404(self):
        response = self.client.get("/books/99999")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ── Actualización y Eliminación (PUT / PATCH / DELETE) ─────────────────

    def test_update_book_put(self):
        payload = self._valid_payload(
            title="El Quijote (Edición Anotada)",
            author=self.book_classic.author,
            isbn=self.book_classic.isbn,
            cost_usd="18.00",
            stock_quantity=30,
        )
        response = self.client.put(
            f"/books/{self.book_classic.id}", payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.book_classic.refresh_from_db()
        self.assertEqual(self.book_classic.title, "El Quijote (Edición Anotada)")
        self.assertEqual(self.book_classic.stock_quantity, 30)

    def test_partial_update_stock_patch(self):
        response = self.client.patch(
            f"/books/{self.book_classic.id}", {"stock_quantity": 12}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.book_classic.refresh_from_db()
        self.assertEqual(self.book_classic.stock_quantity, 12)

    def test_delete_book_returns_204(self):
        response = self.client.delete(f"/books/{self.book_low_stock.id}")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Book.objects.filter(id=self.book_low_stock.id).exists())

    # ── Búsqueda y Stock Bajo (/books/search, /books/low-stock) ────────────

    def test_search_by_category(self):
        response = self.client.get("/books/search", {"category": "clásica"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.book_classic.id)

    def test_search_without_category_returns_400(self):
        response = self.client.get("/books/search")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_low_stock_filter(self):
        response = self.client.get("/books/low-stock", {"threshold": 10})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.book_low_stock.id)

    def test_low_stock_invalid_threshold_returns_400(self):
        response = self.client.get("/books/low-stock", {"threshold": -3})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Cálculo de Precio Local (POST /books/{id}/calculate-price) ─────────

    @patch("books.services.requests.get")
    def test_calculate_price_with_mocked_exchange_api(self, mock_get):
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {"rates": {"EUR": 0.90, "VES": 50.0}}
        mock_get.return_value = mock_response

        response = self.client.post(
            f"/books/{self.book_classic.id}/calculate-price",
            {"currency": "EUR"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["used_fallback"])
        self.assertEqual(response.data["currency"], "EUR")
        self.assertEqual(response.data["exchange_rate"], 0.9)
        # 15.99 * 0.90 = 14.391 -> 14.39; 14.39 * 1.40 = 20.146 -> 20.15
        self.assertEqual(response.data["cost_local"], 14.39)
        self.assertEqual(response.data["selling_price_local"], 20.15)
        self.assertEqual(response.data["margin_percentage"], 40)

        self.book_classic.refresh_from_db()
        self.assertEqual(self.book_classic.selling_price_local, Decimal("20.15"))
        self.assertEqual(self.book_classic.price_currency, "EUR")
        self.assertEqual(self.book_classic.price_exchange_rate, Decimal("0.900000"))

    @patch("books.services.requests.get")
    def test_calculate_price_uses_fallback_when_api_fails(self, mock_get):
        mock_get.side_effect = requests.RequestException("Timeout externo")

        response = self.client.post(
            f"/books/{self.book_classic.id}/calculate-price",
            {"currency": "EUR"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["used_fallback"])
        self.assertEqual(response.data["exchange_rate"], 0.85)
        # 15.99 * 0.85 = 13.5915 -> 13.59; 13.59 * 1.40 = 19.026 -> 19.03
        self.assertEqual(response.data["cost_local"], 13.59)
        self.assertEqual(response.data["selling_price_local"], 19.03)
