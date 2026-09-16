from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from .models import ShoppingListItem, Recipe, HouseholdTask

class ShoppingListTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_shopping_item(self):
        response = self.client.post('/api/shopping/', {'title': 'Milk', 'description': 'Buy milk'})
        self.assertEqual(response.status_code, 201)
