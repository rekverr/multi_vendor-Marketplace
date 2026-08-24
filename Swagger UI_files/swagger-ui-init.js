
window.onload = function() {
  // Build a system
  let url = window.location.search.match(/url=([^&]+)/);
  if (url && url.length > 1) {
    url = decodeURIComponent(url[1]);
  } else {
    url = window.location.origin;
  }
  let options = {
  "swaggerDoc": {
    "openapi": "3.0.0",
    "paths": {
      "/seller/dashboard": {
        "get": {
          "operationId": "SellerDashboardController_get",
          "parameters": [
            {
              "name": "from",
              "required": false,
              "in": "query",
              "description": "Inclusive UTC range start; defaults to 30 days before to",
              "schema": {
                "example": "2026-07-01T00:00:00.000Z",
                "type": "string"
              }
            },
            {
              "name": "to",
              "required": false,
              "in": "query",
              "description": "Inclusive UTC range end; defaults to current time",
              "schema": {
                "example": "2026-08-01T00:00:00.000Z",
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Read authenticated Seller analytics dashboard",
          "tags": [
            "seller-dashboard"
          ]
        }
      },
      "/admin/analytics": {
        "get": {
          "operationId": "AdminAnalyticsController_get",
          "parameters": [
            {
              "name": "from",
              "required": false,
              "in": "query",
              "description": "Inclusive UTC range start; defaults to 30 days before to",
              "schema": {
                "example": "2026-07-01T00:00:00.000Z",
                "type": "string"
              }
            },
            {
              "name": "to",
              "required": false,
              "in": "query",
              "description": "Inclusive UTC range end; defaults to current time",
              "schema": {
                "example": "2026-08-01T00:00:00.000Z",
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Read marketplace analytics",
          "tags": [
            "admin-analytics"
          ]
        }
      },
      "/admin/analytics/sales.csv": {
        "get": {
          "operationId": "AdminAnalyticsController_exportSales",
          "parameters": [
            {
              "name": "from",
              "required": false,
              "in": "query",
              "description": "Inclusive UTC range start; defaults to 30 days before to",
              "schema": {
                "example": "2026-07-01T00:00:00.000Z",
                "type": "string"
              }
            },
            {
              "name": "to",
              "required": false,
              "in": "query",
              "description": "Inclusive UTC range end; defaults to current time",
              "schema": {
                "example": "2026-08-01T00:00:00.000Z",
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Export marketplace sales snapshots as CSV",
          "tags": [
            "admin-analytics"
          ]
        }
      },
      "/auth/register": {
        "post": {
          "operationId": "AuthController_register",
          "parameters": [],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RegisterDto"
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "summary": "Register a customer account",
          "tags": [
            "auth"
          ]
        }
      },
      "/auth/login": {
        "post": {
          "operationId": "AuthController_login",
          "parameters": [],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/LoginDto"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "summary": "Log in with email and password",
          "tags": [
            "auth"
          ]
        }
      },
      "/auth/refresh": {
        "post": {
          "operationId": "AuthController_refresh",
          "parameters": [],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RefreshTokenDto"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "summary": "Rotate a refresh session",
          "tags": [
            "auth"
          ]
        }
      },
      "/auth/logout": {
        "post": {
          "operationId": "AuthController_logout",
          "parameters": [],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RefreshTokenDto"
                }
              }
            }
          },
          "responses": {
            "204": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "summary": "Revoke a refresh session",
          "tags": [
            "auth"
          ]
        }
      },
      "/auth/me": {
        "get": {
          "operationId": "AuthController_me",
          "parameters": [],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Get the authenticated user",
          "tags": [
            "auth"
          ]
        }
      },
      "/auth/google": {
        "get": {
          "operationId": "AuthController_google",
          "parameters": [],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "summary": "Start Google OAuth2 authentication",
          "tags": [
            "auth"
          ]
        }
      },
      "/auth/google/callback": {
        "get": {
          "operationId": "AuthController_googleCallback",
          "parameters": [],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "summary": "Complete Google OAuth2 authentication",
          "tags": [
            "auth"
          ]
        }
      },
      "/orders/{orderId}/disputes": {
        "post": {
          "operationId": "CustomerDisputesController_create",
          "parameters": [
            {
              "name": "orderId",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/CreateDisputeDto"
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Open a dispute for an owned purchase",
          "tags": [
            "customer-disputes"
          ]
        }
      },
      "/disputes": {
        "get": {
          "operationId": "CustomerDisputesController_list",
          "parameters": [
            {
              "name": "page",
              "required": false,
              "in": "query",
              "schema": {
                "minimum": 1,
                "default": 1,
                "allOf": [
                  {
                    "$ref": "#/components/schemas/Object"
                  }
                ]
              }
            },
            {
              "name": "pageSize",
              "required": false,
              "in": "query",
              "schema": {
                "minimum": 1,
                "maximum": 50,
                "default": 20,
                "allOf": [
                  {
                    "$ref": "#/components/schemas/Object"
                  }
                ]
              }
            },
            {
              "name": "status",
              "required": false,
              "in": "query",
              "schema": {
                "type": "string",
                "enum": [
                  "OPEN",
                  "UNDER_REVIEW",
                  "RESOLVED",
                  "REJECTED",
                  "CLOSED"
                ]
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "List authenticated Customer disputes",
          "tags": [
            "customer-disputes"
          ]
        }
      },
      "/disputes/{id}": {
        "get": {
          "operationId": "CustomerDisputesController_get",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Read an owned Customer dispute",
          "tags": [
            "customer-disputes"
          ]
        }
      },
      "/seller/disputes": {
        "get": {
          "operationId": "SellerDisputesController_list",
          "parameters": [
            {
              "name": "page",
              "required": false,
              "in": "query",
              "schema": {
                "minimum": 1,
                "default": 1,
                "allOf": [
                  {
                    "$ref": "#/components/schemas/Object"
                  }
                ]
              }
            },
            {
              "name": "pageSize",
              "required": false,
              "in": "query",
              "schema": {
                "minimum": 1,
                "maximum": 50,
                "default": 20,
                "allOf": [
                  {
                    "$ref": "#/components/schemas/Object"
                  }
                ]
              }
            },
            {
              "name": "status",
              "required": false,
              "in": "query",
              "schema": {
                "type": "string",
                "enum": [
                  "OPEN",
                  "UNDER_REVIEW",
                  "RESOLVED",
                  "REJECTED",
                  "CLOSED"
                ]
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "List disputes for owned SellerOrders",
          "tags": [
            "seller-disputes"
          ]
        }
      },
      "/seller/disputes/{id}": {
        "get": {
          "operationId": "SellerDisputesController_get",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Read a dispute for an owned SellerOrder",
          "tags": [
            "seller-disputes"
          ]
        }
      },
      "/admin/disputes": {
        "get": {
          "operationId": "AdminDisputesController_list",
          "parameters": [
            {
              "name": "page",
              "required": false,
              "in": "query",
              "schema": {
                "minimum": 1,
                "default": 1,
                "allOf": [
                  {
                    "$ref": "#/components/schemas/Object"
                  }
                ]
              }
            },
            {
              "name": "pageSize",
              "required": false,
              "in": "query",
              "schema": {
                "minimum": 1,
                "maximum": 50,
                "default": 20,
                "allOf": [
                  {
                    "$ref": "#/components/schemas/Object"
                  }
                ]
              }
            },
            {
              "name": "status",
              "required": false,
              "in": "query",
              "schema": {
                "type": "string",
                "enum": [
                  "OPEN",
                  "UNDER_REVIEW",
                  "RESOLVED",
                  "REJECTED",
                  "CLOSED"
                ]
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "List disputes for Admin review",
          "tags": [
            "admin-disputes"
          ]
        }
      },
      "/admin/disputes/{id}": {
        "get": {
          "operationId": "AdminDisputesController_get",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Read a dispute for Admin review",
          "tags": [
            "admin-disputes"
          ]
        }
      },
      "/admin/disputes/{id}/status": {
        "patch": {
          "operationId": "AdminDisputesController_transition",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UpdateDisputeStatusDto"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Transition dispute resolution state",
          "tags": [
            "admin-disputes"
          ]
        }
      },
      "/metrics": {
        "get": {
          "operationId": "MetricsController_metrics",
          "parameters": [],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "tags": [
            "Metrics"
          ]
        }
      },
      "/cart": {
        "get": {
          "operationId": "CartController_getCurrent",
          "parameters": [],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Get the authenticated Customer cart",
          "tags": [
            "cart"
          ]
        },
        "delete": {
          "operationId": "CartController_clear",
          "parameters": [],
          "responses": {
            "204": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Clear the current cart",
          "tags": [
            "cart"
          ]
        }
      },
      "/cart/items": {
        "post": {
          "operationId": "CartController_add",
          "parameters": [],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AddCartItemDto"
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Add a Product to the current cart",
          "tags": [
            "cart"
          ]
        }
      },
      "/cart/items/{productId}": {
        "patch": {
          "operationId": "CartController_update",
          "parameters": [
            {
              "name": "productId",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UpdateCartItemDto"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Update a current cart item quantity",
          "tags": [
            "cart"
          ]
        },
        "delete": {
          "operationId": "CartController_remove",
          "parameters": [
            {
              "name": "productId",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Remove a Product from the current cart",
          "tags": [
            "cart"
          ]
        }
      },
      "/seller/products/{productId}/auction": {
        "put": {
          "operationId": "SellerAuctionsController_configure",
          "parameters": [
            {
              "name": "productId",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ConfigureAuctionDto"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Create or update an owned Auction configuration",
          "tags": [
            "seller-auctions"
          ]
        },
        "get": {
          "operationId": "SellerAuctionsController_getOwn",
          "parameters": [
            {
              "name": "productId",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Read an owned Auction configuration",
          "tags": [
            "seller-auctions"
          ]
        }
      },
      "/auctions/{id}": {
        "get": {
          "operationId": "PublicAuctionsController_get",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "summary": "Read public Auction detail and recent bid history",
          "tags": [
            "auctions"
          ]
        }
      },
      "/auctions/{auctionId}/bids": {
        "post": {
          "operationId": "BidsController_place",
          "parameters": [
            {
              "name": "auctionId",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "Idempotency-Key",
              "in": "header",
              "required": true,
              "schema": {
                "type": "string"
              }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/PlaceBidDto"
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Place a race-safe Auction bid",
          "tags": [
            "auction-bids"
          ]
        }
      },
      "/admin/auctions/{id}/finalize": {
        "post": {
          "operationId": "AdminAuctionsController_finalize",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "201": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Idempotently finalize an expired Auction",
          "tags": [
            "admin-auctions"
          ]
        }
      },
      "/admin/auctions/{id}/expire-winner-window": {
        "post": {
          "operationId": "AdminAuctionsController_expireWinnerWindow",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "201": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Expire stale Auction winner purchase eligibility",
          "tags": [
            "admin-auctions"
          ]
        }
      },
      "/categories": {
        "post": {
          "operationId": "CategoriesController_create",
          "parameters": [],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/CreateCategoryDto"
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Create a Category",
          "tags": [
            "categories"
          ]
        },
        "get": {
          "operationId": "CategoriesController_list",
          "parameters": [],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "summary": "List Categories",
          "tags": [
            "categories"
          ]
        }
      },
      "/categories/{id}": {
        "patch": {
          "operationId": "CategoriesController_update",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UpdateCategoryDto"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Update a Category",
          "tags": [
            "categories"
          ]
        },
        "delete": {
          "operationId": "CategoriesController_remove",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "204": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Delete an unused Category",
          "tags": [
            "categories"
          ]
        }
      },
      "/admin/products": {
        "get": {
          "operationId": "AdminProductsController_list",
          "parameters": [
            {
              "name": "status",
              "required": false,
              "in": "query",
              "schema": {
                "default": "PENDING_REVIEW",
                "type": "string",
                "enum": [
                  "DRAFT",
                  "PENDING_REVIEW",
                  "PUBLISHED",
                  "REJECTED",
                  "ARCHIVED"
                ]
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "List Products for Admin moderation",
          "tags": [
            "admin-products"
          ]
        }
      },
      "/admin/products/{id}/approve": {
        "patch": {
          "operationId": "AdminProductsController_approve",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Approve a pending Product for publication",
          "tags": [
            "admin-products"
          ]
        }
      },
      "/admin/products/{id}/reject": {
        "patch": {
          "operationId": "AdminProductsController_reject",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RejectProductDto"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Reject a pending Product publication request",
          "tags": [
            "admin-products"
          ]
        }
      },
      "/seller/products": {
        "post": {
          "operationId": "ProductsController_create",
          "parameters": [],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/CreateProductDto"
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Create a Seller-owned Product draft",
          "tags": [
            "seller-products"
          ]
        },
        "get": {
          "operationId": "ProductsController_listOwn",
          "parameters": [],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "List own Products",
          "tags": [
            "seller-products"
          ]
        }
      },
      "/seller/products/{id}": {
        "get": {
          "operationId": "ProductsController_getOwn",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Get an owned Product",
          "tags": [
            "seller-products"
          ]
        },
        "patch": {
          "operationId": "ProductsController_update",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UpdateProductDto"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Update an editable owned Product",
          "tags": [
            "seller-products"
          ]
        },
        "delete": {
          "operationId": "ProductsController_archive",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Archive an owned Product",
          "tags": [
            "seller-products"
          ]
        }
      },
      "/seller/products/{id}/request-publication": {
        "patch": {
          "operationId": "ProductsController_requestPublication",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Request Product publication review",
          "tags": [
            "seller-products"
          ]
        }
      },
      "/products": {
        "get": {
          "operationId": "PublicProductsController_list",
          "parameters": [
            {
              "name": "q",
              "required": false,
              "in": "query",
              "description": "Full-text Product search",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "page",
              "required": false,
              "in": "query",
              "schema": {
                "minimum": 1,
                "default": 1,
                "allOf": [
                  {
                    "$ref": "#/components/schemas/Object"
                  }
                ]
              }
            },
            {
              "name": "pageSize",
              "required": false,
              "in": "query",
              "schema": {
                "minimum": 1,
                "maximum": 50,
                "default": 20,
                "allOf": [
                  {
                    "$ref": "#/components/schemas/Object"
                  }
                ]
              }
            },
            {
              "name": "categoryId",
              "required": false,
              "in": "query",
              "schema": {
                "format": "uuid",
                "type": "string"
              }
            },
            {
              "name": "sellerId",
              "required": false,
              "in": "query",
              "schema": {
                "format": "uuid",
                "type": "string"
              }
            },
            {
              "name": "minPrice",
              "required": false,
              "in": "query",
              "schema": {
                "example": "10.00",
                "type": "string"
              }
            },
            {
              "name": "maxPrice",
              "required": false,
              "in": "query",
              "schema": {
                "example": "100.00",
                "type": "string"
              }
            },
            {
              "name": "available",
              "required": false,
              "in": "query",
              "schema": {
                "type": "boolean"
              }
            },
            {
              "name": "sort",
              "required": false,
              "in": "query",
              "schema": {
                "default": "newest",
                "type": "string",
                "enum": [
                  "newest",
                  "price_asc",
                  "price_desc"
                ]
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "summary": "List published products",
          "tags": [
            "Public Products"
          ]
        }
      },
      "/products/{id}": {
        "get": {
          "operationId": "PublicProductsController_getById",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "format": "uuid",
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "summary": "Get a published product",
          "tags": [
            "Public Products"
          ]
        }
      },
      "/products/{productId}/reviews": {
        "get": {
          "operationId": "ReviewsController_list",
          "parameters": [
            {
              "name": "productId",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "page",
              "required": false,
              "in": "query",
              "schema": {
                "minimum": 1,
                "default": 1,
                "allOf": [
                  {
                    "$ref": "#/components/schemas/Object"
                  }
                ]
              }
            },
            {
              "name": "pageSize",
              "required": false,
              "in": "query",
              "schema": {
                "minimum": 1,
                "maximum": 50,
                "default": 20,
                "allOf": [
                  {
                    "$ref": "#/components/schemas/Object"
                  }
                ]
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "summary": "List public Product reviews",
          "tags": [
            "reviews"
          ]
        },
        "post": {
          "operationId": "ReviewsController_create",
          "parameters": [
            {
              "name": "productId",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/CreateReviewDto"
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Review a Product from a completed purchase",
          "tags": [
            "reviews"
          ]
        }
      },
      "/reviews/{id}": {
        "patch": {
          "operationId": "ReviewsController_update",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UpdateReviewDto"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Update an owned review",
          "tags": [
            "reviews"
          ]
        },
        "delete": {
          "operationId": "ReviewsController_remove",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Delete an owned review",
          "tags": [
            "reviews"
          ]
        }
      },
      "/seller-applications": {
        "post": {
          "operationId": "SellerApplicationsController_submit",
          "parameters": [],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/SubmitSellerApplicationDto"
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Submit a Seller application",
          "tags": [
            "seller-applications"
          ]
        },
        "get": {
          "operationId": "SellerApplicationsController_list",
          "parameters": [],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "List Seller applications for moderation",
          "tags": [
            "seller-applications"
          ]
        }
      },
      "/seller-applications/{id}": {
        "get": {
          "operationId": "SellerApplicationsController_getById",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Read a Seller application for moderation",
          "tags": [
            "seller-applications"
          ]
        }
      },
      "/seller-applications/{id}/approve": {
        "patch": {
          "operationId": "SellerApplicationsController_approve",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Approve a Seller application",
          "tags": [
            "seller-applications"
          ]
        }
      },
      "/seller-applications/{id}/reject": {
        "patch": {
          "operationId": "SellerApplicationsController_reject",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RejectSellerApplicationDto"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Reject a Seller application",
          "tags": [
            "seller-applications"
          ]
        }
      },
      "/health": {
        "get": {
          "operationId": "HealthController_check",
          "parameters": [],
          "responses": {
            "200": {
              "description": "The Health Check is successful",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "status": {
                        "type": "string",
                        "example": "ok"
                      },
                      "info": {
                        "type": "object",
                        "example": {
                          "database": {
                            "status": "up"
                          }
                        },
                        "additionalProperties": {
                          "type": "object",
                          "required": [
                            "status"
                          ],
                          "properties": {
                            "status": {
                              "type": "string"
                            }
                          },
                          "additionalProperties": true
                        },
                        "nullable": true
                      },
                      "error": {
                        "type": "object",
                        "example": {},
                        "additionalProperties": {
                          "type": "object",
                          "required": [
                            "status"
                          ],
                          "properties": {
                            "status": {
                              "type": "string"
                            }
                          },
                          "additionalProperties": true
                        },
                        "nullable": true
                      },
                      "details": {
                        "type": "object",
                        "example": {
                          "database": {
                            "status": "up"
                          }
                        },
                        "additionalProperties": {
                          "type": "object",
                          "required": [
                            "status"
                          ],
                          "properties": {
                            "status": {
                              "type": "string"
                            }
                          },
                          "additionalProperties": true
                        }
                      }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "503": {
              "description": "The Health Check is not successful",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "status": {
                        "type": "string",
                        "example": "error"
                      },
                      "info": {
                        "type": "object",
                        "example": {
                          "database": {
                            "status": "up"
                          }
                        },
                        "additionalProperties": {
                          "type": "object",
                          "required": [
                            "status"
                          ],
                          "properties": {
                            "status": {
                              "type": "string"
                            }
                          },
                          "additionalProperties": true
                        },
                        "nullable": true
                      },
                      "error": {
                        "type": "object",
                        "example": {
                          "redis": {
                            "status": "down",
                            "message": "Could not connect"
                          }
                        },
                        "additionalProperties": {
                          "type": "object",
                          "required": [
                            "status"
                          ],
                          "properties": {
                            "status": {
                              "type": "string"
                            }
                          },
                          "additionalProperties": true
                        },
                        "nullable": true
                      },
                      "details": {
                        "type": "object",
                        "example": {
                          "database": {
                            "status": "up"
                          },
                          "redis": {
                            "status": "down",
                            "message": "Could not connect"
                          }
                        },
                        "additionalProperties": {
                          "type": "object",
                          "required": [
                            "status"
                          ],
                          "properties": {
                            "status": {
                              "type": "string"
                            }
                          },
                          "additionalProperties": true
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "tags": [
            "Health"
          ]
        }
      },
      "/checkout": {
        "post": {
          "operationId": "CheckoutController_checkout",
          "parameters": [
            {
              "name": "Idempotency-Key",
              "in": "header",
              "required": true,
              "schema": {
                "type": "string"
              }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/CheckoutDto"
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Checkout the authenticated Customer cart",
          "tags": [
            "checkout"
          ]
        }
      },
      "/orders": {
        "get": {
          "operationId": "CustomerOrdersController_list",
          "parameters": [
            {
              "name": "page",
              "required": false,
              "in": "query",
              "schema": {
                "minimum": 1,
                "default": 1,
                "allOf": [
                  {
                    "$ref": "#/components/schemas/Object"
                  }
                ]
              }
            },
            {
              "name": "pageSize",
              "required": false,
              "in": "query",
              "schema": {
                "minimum": 1,
                "maximum": 50,
                "default": 20,
                "allOf": [
                  {
                    "$ref": "#/components/schemas/Object"
                  }
                ]
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "List authenticated Customer orders",
          "tags": [
            "customer-orders"
          ]
        }
      },
      "/orders/{id}": {
        "get": {
          "operationId": "CustomerOrdersController_get",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Read an owned parent Order",
          "tags": [
            "customer-orders"
          ]
        }
      },
      "/orders/{id}/cancel": {
        "post": {
          "operationId": "CustomerOrdersController_cancelOrder",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/CancelOrderDto"
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Cancel an owned Order before shipment",
          "tags": [
            "customer-orders"
          ]
        }
      },
      "/orders/{orderId}/seller-orders/{sellerOrderId}/cancel": {
        "post": {
          "operationId": "CustomerOrdersController_cancelSellerOrder",
          "parameters": [
            {
              "name": "orderId",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "sellerOrderId",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/CancelOrderDto"
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Cancel one owned SellerOrder before shipment",
          "tags": [
            "customer-orders"
          ]
        }
      },
      "/seller/orders": {
        "get": {
          "operationId": "SellerOrdersController_list",
          "parameters": [
            {
              "name": "page",
              "required": false,
              "in": "query",
              "schema": {
                "minimum": 1,
                "default": 1,
                "allOf": [
                  {
                    "$ref": "#/components/schemas/Object"
                  }
                ]
              }
            },
            {
              "name": "pageSize",
              "required": false,
              "in": "query",
              "schema": {
                "minimum": 1,
                "maximum": 50,
                "default": 20,
                "allOf": [
                  {
                    "$ref": "#/components/schemas/Object"
                  }
                ]
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "List authenticated Seller orders",
          "tags": [
            "seller-orders"
          ]
        }
      },
      "/seller/orders/{id}": {
        "get": {
          "operationId": "SellerOrdersController_get",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Read an owned SellerOrder",
          "tags": [
            "seller-orders"
          ]
        }
      },
      "/seller/orders/{id}/status": {
        "patch": {
          "operationId": "SellerOrdersController_transition",
          "parameters": [
            {
              "name": "id",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UpdateSellerOrderStatusDto"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Transition an owned SellerOrder",
          "tags": [
            "seller-orders"
          ]
        }
      },
      "/seller/orders/{sellerOrderId}/items/{itemId}/refunds": {
        "post": {
          "operationId": "SellerOrdersController_refundItem",
          "parameters": [
            {
              "name": "sellerOrderId",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "itemId",
              "required": true,
              "in": "path",
              "schema": {
                "type": "string"
              }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/CreateItemRefundDto"
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": ""
            },
            "400": {
              "description": "Request validation failed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "401": {
              "description": "Access token is missing, expired or invalid",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "403": {
              "description": "Authenticated role is not allowed",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "404": {
              "description": "Resource was not found or is not visible to this identity",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            },
            "409": {
              "description": "Business state, ownership, stock or idempotency conflict",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/ApiError"
                  }
                }
              }
            }
          },
          "security": [
            {
              "bearer": []
            }
          ],
          "summary": "Create an item-level partial refund",
          "tags": [
            "seller-orders"
          ]
        }
      }
    },
    "info": {
      "title": "Multi-Vendor Marketplace API",
      "description": "Authoritative marketplace API for authentication, Seller onboarding, catalog, cart, transactional checkout, independent SellerOrders, auctions, reviews, disputes, analytics and real-time recovery. Use the access JWT from login/refresh with the Authorize button. Idempotency-Key is required where shown for checkout, bids and refunds.",
      "version": "1.0",
      "contact": {}
    },
    "tags": [
      {
        "name": "auth",
        "description": "Registration, login, refresh sessions, logout and Google OAuth2"
      },
      {
        "name": "seller-applications",
        "description": "Customer application and Admin Seller approval or rejection"
      },
      {
        "name": "categories",
        "description": "Public Category reads and Admin Category management"
      },
      {
        "name": "Public Products",
        "description": "Published catalog search, filtering and Product detail"
      },
      {
        "name": "seller-products",
        "description": "Approved Seller-owned Product lifecycle"
      },
      {
        "name": "cart",
        "description": "Authenticated Customer cart; cart contents do not reserve stock"
      },
      {
        "name": "checkout",
        "description": "Idempotent, transactional Customer checkout"
      },
      {
        "name": "customer-orders",
        "description": "Customer-owned parent Orders, cancellation and child status visibility"
      },
      {
        "name": "seller-orders",
        "description": "Seller-owned fulfillment lifecycle and item refunds"
      },
      {
        "name": "auctions",
        "description": "Public Auction detail and bid history"
      },
      {
        "name": "auction-bids",
        "description": "Idempotent PostgreSQL-serialized Customer bids"
      },
      {
        "name": "seller-auctions",
        "description": "Seller configuration for owned Auction Products"
      },
      {
        "name": "admin-auctions",
        "description": "Idempotent Auction finalization and winner-window expiry"
      },
      {
        "name": "reviews",
        "description": "Verified-purchase Product reviews"
      },
      {
        "name": "customer-disputes",
        "description": "Customer-owned dispute creation and reads"
      },
      {
        "name": "seller-disputes",
        "description": "Seller visibility limited to involved SellerOrders"
      },
      {
        "name": "admin-disputes",
        "description": "Admin dispute review and explicit status transitions"
      },
      {
        "name": "seller-dashboard",
        "description": "Seller-scoped snapshot and ledger analytics"
      },
      {
        "name": "admin-analytics",
        "description": "Marketplace analytics and escaped CSV export"
      }
    ],
    "servers": [],
    "components": {
      "securitySchemes": {
        "bearer": {
          "scheme": "bearer",
          "bearerFormat": "JWT",
          "type": "http",
          "description": "Short-lived application access JWT. Do not use a refresh token."
        }
      },
      "schemas": {
        "RegisterDto": {
          "type": "object",
          "properties": {}
        },
        "LoginDto": {
          "type": "object",
          "properties": {}
        },
        "RefreshTokenDto": {
          "type": "object",
          "properties": {}
        },
        "CreateDisputeDto": {
          "type": "object",
          "properties": {
            "sellerOrderId": {
              "type": "string",
              "format": "uuid"
            },
            "orderItemId": {
              "type": "string",
              "format": "uuid"
            },
            "reason": {
              "type": "string",
              "minLength": 10,
              "maxLength": 2000
            }
          },
          "required": [
            "sellerOrderId",
            "reason"
          ]
        },
        "Object": {
          "type": "object",
          "properties": {}
        },
        "UpdateDisputeStatusDto": {
          "type": "object",
          "properties": {
            "status": {
              "type": "string",
              "enum": [
                "OPEN",
                "UNDER_REVIEW",
                "RESOLVED",
                "REJECTED",
                "CLOSED"
              ]
            },
            "resolutionNote": {
              "type": "string",
              "minLength": 3,
              "maxLength": 2000
            }
          },
          "required": [
            "status"
          ]
        },
        "AddCartItemDto": {
          "type": "object",
          "properties": {
            "productId": {
              "type": "string",
              "format": "uuid"
            },
            "quantity": {
              "type": "number",
              "minimum": 1,
              "maximum": 999
            }
          },
          "required": [
            "productId",
            "quantity"
          ]
        },
        "UpdateCartItemDto": {
          "type": "object",
          "properties": {
            "quantity": {
              "type": "number",
              "minimum": 1,
              "maximum": 999
            }
          },
          "required": [
            "quantity"
          ]
        },
        "ConfigureAuctionDto": {
          "type": "object",
          "properties": {
            "startingPrice": {
              "type": "string",
              "example": "25.00"
            },
            "minimumIncrement": {
              "type": "string",
              "example": "1.00"
            },
            "startsAt": {
              "type": "string",
              "format": "date-time"
            },
            "endsAt": {
              "type": "string",
              "format": "date-time"
            }
          },
          "required": [
            "startingPrice",
            "minimumIncrement",
            "startsAt",
            "endsAt"
          ]
        },
        "PlaceBidDto": {
          "type": "object",
          "properties": {
            "amount": {
              "type": "string",
              "example": "30.00"
            }
          },
          "required": [
            "amount"
          ]
        },
        "CreateCategoryDto": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "example": "Electronics",
              "minLength": 2,
              "maxLength": 100
            }
          },
          "required": [
            "name"
          ]
        },
        "UpdateCategoryDto": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "example": "Electronics",
              "minLength": 2,
              "maxLength": 100
            }
          }
        },
        "RejectProductDto": {
          "type": "object",
          "properties": {
            "reason": {
              "type": "string",
              "minLength": 3,
              "maxLength": 500
            }
          },
          "required": [
            "reason"
          ]
        },
        "CreateProductDto": {
          "type": "object",
          "properties": {
            "categoryId": {
              "type": "string",
              "format": "uuid"
            },
            "title": {
              "type": "string",
              "example": "Mechanical Keyboard",
              "maxLength": 200
            },
            "description": {
              "type": "string",
              "example": "Hot-swappable mechanical keyboard."
            },
            "imageUrl": {
              "type": "object",
              "example": "https://example.com/product.jpg",
              "nullable": true
            },
            "type": {
              "type": "string",
              "enum": [
                "FIXED_PRICE",
                "AUCTION"
              ]
            },
            "price": {
              "type": "string",
              "example": "149.99",
              "description": "Required only for FIXED_PRICE Products"
            },
            "stock": {
              "type": "number",
              "example": 10,
              "minimum": 0
            }
          },
          "required": [
            "categoryId",
            "title",
            "description",
            "type",
            "stock"
          ]
        },
        "UpdateProductDto": {
          "type": "object",
          "properties": {
            "categoryId": {
              "type": "string",
              "format": "uuid"
            },
            "title": {
              "type": "string",
              "example": "Mechanical Keyboard",
              "maxLength": 200
            },
            "description": {
              "type": "string",
              "example": "Hot-swappable mechanical keyboard."
            },
            "imageUrl": {
              "type": "object",
              "example": "https://example.com/product.jpg",
              "nullable": true
            },
            "price": {
              "type": "string",
              "example": "149.99",
              "description": "Required only for FIXED_PRICE Products"
            },
            "stock": {
              "type": "number",
              "example": 10,
              "minimum": 0
            }
          }
        },
        "CreateReviewDto": {
          "type": "object",
          "properties": {
            "orderItemId": {
              "type": "string",
              "format": "uuid"
            },
            "rating": {
              "type": "number",
              "minimum": 1,
              "maximum": 5
            },
            "text": {
              "type": "string",
              "minLength": 1,
              "maxLength": 2000
            }
          },
          "required": [
            "orderItemId",
            "rating",
            "text"
          ]
        },
        "UpdateReviewDto": {
          "type": "object",
          "properties": {
            "rating": {
              "type": "number",
              "minimum": 1,
              "maximum": 5
            },
            "text": {
              "type": "string",
              "minLength": 1,
              "maxLength": 2000
            }
          }
        },
        "SubmitSellerApplicationDto": {
          "type": "object",
          "properties": {}
        },
        "RejectSellerApplicationDto": {
          "type": "object",
          "properties": {}
        },
        "CheckoutDto": {
          "type": "object",
          "properties": {
            "requestContext": {
              "type": "string",
              "description": "Stable client context used to detect conflicting reuse of an idempotency key",
              "maxLength": 128
            }
          }
        },
        "CancelOrderDto": {
          "type": "object",
          "properties": {}
        },
        "UpdateSellerOrderStatusDto": {
          "type": "object",
          "properties": {
            "status": {
              "type": "string",
              "enum": [
                "NEW",
                "PROCESSING",
                "SHIPPED",
                "COMPLETED",
                "PARTIALLY_CANCELLED",
                "CANCELLED"
              ]
            }
          },
          "required": [
            "status"
          ]
        },
        "CreateItemRefundDto": {
          "type": "object",
          "properties": {
            "quantity": {
              "type": "number",
              "minimum": 1,
              "maximum": 999
            },
            "reason": {
              "type": "string",
              "maxLength": 500
            }
          },
          "required": [
            "quantity"
          ]
        },
        "ApiError": {
          "type": "object",
          "required": [
            "statusCode",
            "code",
            "message",
            "path",
            "timestamp",
            "correlationId"
          ],
          "properties": {
            "statusCode": {
              "type": "integer",
              "example": 409
            },
            "code": {
              "type": "string",
              "example": "HTTP_ERROR"
            },
            "message": {
              "oneOf": [
                {
                  "type": "string",
                  "example": "Business state conflict"
                },
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                }
              ]
            },
            "details": {
              "nullable": true
            },
            "path": {
              "type": "string",
              "example": "/checkout"
            },
            "timestamp": {
              "type": "string",
              "format": "date-time"
            },
            "correlationId": {
              "type": "string",
              "format": "uuid"
            }
          }
        }
      }
    }
  },
  "customOptions": {}
};
  url = options.swaggerUrl || url
  let urls = options.swaggerUrls
  let customOptions = options.customOptions
  let spec1 = options.swaggerDoc
  let swaggerOptions = {
    spec: spec1,
    url: url,
    urls: urls,
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl
    ],
    layout: "StandaloneLayout"
  }
  for (let attrname in customOptions) {
    swaggerOptions[attrname] = customOptions[attrname];
  }
  let ui = SwaggerUIBundle(swaggerOptions)

  if (customOptions.initOAuth) {
    ui.initOAuth(customOptions.initOAuth)
  }

  if (customOptions.authAction) {
    ui.authActions.authorize(customOptions.authAction)
  }
  
  window.ui = ui
}
