import type {
  NamedReference,
  ProductType,
  SellerReference,
} from "../product/product.types";

export interface CartProduct {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  type: ProductType;
  price: string | null;
  stock: number;
  status: string;
  category: NamedReference;
  seller: SellerReference;
}

export interface CartItem {
  id: string;
  quantity: number;
  lineTotal: string | null;
  purchasable: boolean;
  product: CartProduct;
  pending?: boolean;
}

export interface Cart {
  id: string;
  items: CartItem[];
  itemCount: number;
  subtotal: string;
  createdAt: string;
  updatedAt: string;
  pending?: boolean;
}

export interface OrderItem {
  id: string;
  productId: string;
  productTitle: string;
  productImageUrl: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export interface CheckoutOrder {
  id: string;
  status: string;
  currency: string;
  totalAmount: string;
  createdAt: string;
  sellerOrders: Array<{
    id: string;
    status: string;
    currency: string;
    grossAmount: string;
    seller: SellerReference;
    items: OrderItem[];
  }>;
}

export interface CheckoutAttempt {
  customerId: string;
  idempotencyKey: string;
  requestContext: string;
  cartSignature: string;
}
