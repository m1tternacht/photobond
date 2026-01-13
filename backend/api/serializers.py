from rest_framework import serializers
from .models import Product, Order, OrderItem


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'title', 'slug', 'base_price']

class OrderItemSerializer(serializers.ModelSerializer):
    product_title = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ['id', 'product_title', 'options', 'price']
    def get_product_title(self, obj):
        return obj.product.title