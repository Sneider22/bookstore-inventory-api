from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BookViewSet

# trailing_slash=False permite consumir /books y /books/{id}/calculate-price sin exigir "/" al final
router = DefaultRouter(trailing_slash=False)
router.register(r"books", BookViewSet, basename="book")

urlpatterns = [
    path("", include(router.urls)),
]