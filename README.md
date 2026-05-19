# camx-backend

This backend runs on port `4000` by default and serves the CAMX product, order, and authentication APIs.

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file with:
   ```env
   MONGO_URI=<your-mongodb-connection-string>
   SECRET_KEY=<your-jwt-secret>
   PORT=4000
   ```
3. Start the server:
   ```bash
   npm start
   ```

## API base URL

`http://localhost:4000`


A Node.js/MongoDB backend for the CAMX e-commerce application. It provides product management, user auth, order checkout, admin analytics, and order exports.

## Run

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file with:
   ```env
   MONGO_URI=<your-mongodb-connection-string>
   SECRET_KEY=<your-jwt-secret>
   ```
3. Start the server:
   ```bash
   npm start
   ```

## Core routes

- `POST /users` — create user
- `POST /users/login` — login and receive JWT
- `GET /products` — list available products
- `POST /products` — create product (admin only)
- `GET /products/:productId` — get product details
- `PUT /products/:productId` — update product (admin only)
- `DELETE /products/:productId` — delete product (admin only)
- `POST /orders/checkout` — place an order
- `GET /orders` — list orders (admin sees all, customers see own orders)
- `GET /orders/:orderId` — get order details
- `GET /orders/analytics/sales` — sales analytics (admin only)
- `GET /orders/download` — download orders CSV (admin only)

