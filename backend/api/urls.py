from django.urls import path
from .views import test_api, product_list, add_to_cart, get_cart, remove_from_cart, me, merge_cart
from django.urls import path
from .views import register


urlpatterns = [
    path('test/', test_api),
    path('products/', product_list),
    path('cart/add/', add_to_cart),
    path('cart/', get_cart),
    path('cart/remove/<int:item_id>/', remove_from_cart),
    path('auth/me/', me),
    path('cart/merge/', merge_cart),
    path('auth/register/', register),

]