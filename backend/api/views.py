from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Product
from .serializers import ProductSerializer, OrderItemSerializer
from django.shortcuts import get_object_or_404
from decimal import Decimal
from .models import Order, OrderItem
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

def get_or_create_cart(request):
    # гарантируем, что сессия существует
    if not request.session.session_key:
        request.session.create()

    session_key = request.session.session_key

    if request.user.is_authenticated:
        order, _ = Order.objects.get_or_create(
            user=request.user,
            status='draft',
            defaults={'session_key': session_key}
        )
    else:
        order, _ = Order.objects.get_or_create(
            session_key=session_key,
            status='draft'
        )

    return order

@api_view(['GET'])
def test_api(request):
    return Response({
        "status": "ok",
        "message": "Backend is working"
    })

@api_view(['GET'])
def product_list(request):
    products = Product.objects.filter(is_active=True)
    serializer = ProductSerializer(products, many=True)
    return Response(serializer.data)

@api_view(['POST'])
def add_to_cart(request):
    product_id = request.data.get('product_id')
    options = request.data.get('options', {})

    product = get_object_or_404(Product, id=product_id)

    order = order = get_or_create_cart(request)

    # Простейший расчет цены (пока)
    price = Decimal(product.base_price)

    item = OrderItem.objects.create(
        order=order,
        product=product,
        options=options,
        price=price
    )

    order.total_price += price
    order.save()

    return Response({
        'order_id': order.id,
        'total_price': order.total_price,
        'item_id': item.id
    })

@api_view(['GET'])
def get_cart(request):
    order = get_or_create_cart(request)

    if not order:
        return Response({
            'items': [],
            'total_price': 0
        })

    serializer = OrderItemSerializer(order.items.all(), many=True)

    return Response({
        'items': serializer.data,
        'total_price': order.total_price
    })

@api_view(['DELETE'])
def remove_from_cart(request, item_id):
    order = get_or_create_cart(request)
    item = get_object_or_404(OrderItem, id=item_id, order=order)
    

    order.total_price -= item.price
    order.save()

    item.delete()

    return Response({
        'total_price': order.total_price
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response({
        'id': request.user.id,
        'username': request.user.username
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def merge_cart(request):
    if not request.session.session_key:
        request.session.create()

    session_key = request.session.session_key

    try:
        session_order = Order.objects.get(
            session_key=session_key,
            status='draft',
            user__isnull=True
        )
    except Order.DoesNotExist:
        return Response({'detail': 'Nothing to merge'})

    user_order, _ = Order.objects.get_or_create(
        user=request.user,
        status='draft'
    )

    for item in session_order.items.all():
        item.order = user_order
        user_order.total_price += item.price
        item.save()

    user_order.save()
    session_order.delete()

    return Response({'detail': 'Cart merged'})

@api_view(['POST'])
def register(request):
    username = request.data.get('username')
    email = request.data.get('email')
    password = request.data.get('password')

    if not username or not password:
        return Response({'detail': 'Missing fields'}, status=400)

    if User.objects.filter(username=username).exists():
        return Response({'detail': 'Username already exists'}, status=400)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password
    )

    refresh = RefreshToken.for_user(user)

    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh)
    }, status=status.HTTP_201_CREATED)
