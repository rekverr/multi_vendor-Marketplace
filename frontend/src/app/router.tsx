import { createBrowserRouter } from "react-router-dom";
import { GoogleCallbackPage } from "../features/auth/GoogleCallbackPage";
import { LoginPage } from "../features/auth/LoginPage";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { RegisterPage } from "../features/auth/RegisterPage";
import { AuctionDetailPage } from "../features/auctions/AuctionDetailPage";
import { CatalogPage } from "../features/catalog/CatalogPage";
import { ProductDetailPage } from "../features/catalog/ProductDetailPage";
import { CartPage } from "../features/cart/CartPage";
import { OrderDetailPage } from "../features/orders/OrderDetailPage";
import { OrdersPage } from "../features/orders/OrdersPage";
import { AuctionEditorPage } from "../features/seller/AuctionEditorPage";
import { ProductEditorPage } from "../features/seller/ProductEditorPage";
import { SellerApplicationPage } from "../features/seller/SellerApplicationPage";
import { SellerDashboardPage } from "../features/seller/SellerDashboardPage";
import { SellerLayout } from "../features/seller/SellerLayout";
import { SellerOrderDetailPage } from "../features/seller/SellerOrderDetailPage";
import { SellerOrdersPage } from "../features/seller/SellerOrdersPage";
import { SellerProductsPage } from "../features/seller/SellerProductsPage";
import { AccountPage } from "../pages/AccountPage";
import { HomePage } from "../pages/HomePage";
import { RoleLandingPage } from "../pages/RoleLandingPage";
import { StatusPage } from "../pages/StatusPage";
import { AppRoot } from "./AppRoot";

export const router = createBrowserRouter([
  {
    element: <AppRoot />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/products", element: <CatalogPage /> },
      { path: "/products/:productId", element: <ProductDetailPage /> },
      { path: "/auctions/:auctionId", element: <AuctionDetailPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/auth/google/callback", element: <GoogleCallbackPage /> },
      { path: "/forbidden", element: <StatusPage forbidden /> },
      {
        element: <ProtectedRoute />,
        children: [{ path: "/account", element: <AccountPage /> }],
      },
      {
        element: <ProtectedRoute roles={["CUSTOMER"]} />,
        children: [
          { path: "/seller/apply", element: <SellerApplicationPage /> },
          { path: "/cart", element: <CartPage /> },
          { path: "/orders", element: <OrdersPage /> },
          { path: "/orders/:orderId", element: <OrderDetailPage /> },
        ],
      },
      {
        element: <ProtectedRoute roles={["SELLER"]} />,
        children: [
          {
            path: "/seller",
            element: <SellerLayout />,
            children: [
              { index: true, element: <SellerDashboardPage /> },
              { path: "products", element: <SellerProductsPage /> },
              { path: "products/new", element: <ProductEditorPage /> },
              { path: "products/:productId", element: <ProductEditorPage /> },
              {
                path: "products/:productId/auction",
                element: <AuctionEditorPage />,
              },
              { path: "orders", element: <SellerOrdersPage /> },
              {
                path: "orders/:sellerOrderId",
                element: <SellerOrderDetailPage />,
              },
            ],
          },
        ],
      },
      {
        element: <ProtectedRoute roles={["ADMIN"]} />,
        children: [
          { path: "/admin", element: <RoleLandingPage area="Admin" /> },
        ],
      },
      { path: "*", element: <StatusPage /> },
    ],
  },
]);
