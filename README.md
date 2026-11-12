# CAMX Backend

Express 5 + MongoDB API for CAMX e-commerce, including customers, products, orders, reviews, analytics, categories, contact enquiries and payment integration.

## Tech stack

Node.js, Express, Mongoose, JWT authentication, Helmet, rate limiting, Nodemailer and MongoDB.

## Setup

```bash
npm install
cp .env.example .env
# Configure the required values in .env
npm start
```

The server uses `PORT` from the environment, defaulting to **5000**. The `start` script now runs `node index.js`; use `npm run dev` for the `nodemon` development watcher. Confirm the host's existing start command before deploying.

The API base URL for local development is typically `http://localhost:5000/api`.

## Main route groups

| Route prefix | Description |
| --- | --- |
| `/api/users` | Register, login, profile, password reset and admin accounts |
| `/api/products` | Product catalogue and administration |
| `/api/orders` | Cart/checkout and order management |
| `/api/reviews` | Product reviews |
| `/api/analytics` | Analytics |
| `/api/contacts` | Contact enquiries |
| `/api/categories` | Categories |
| `/api/payments` | Payment integration |

See the route files under `routes/` for exact methods, permission guards and request shapes.

## Environment configuration

Use `.env.example` as a guide for `PORT`, `MONGO_URI`, `SECRET_KEY`, `CORS_ALLOWED_ORIGINS`, email configuration and payment integration values. Never commit real credentials. Only enable payment providers and gateways after verifying current business requirements and provider credentials.

## Verification

```bash
npm test
```

The repository includes Node test files under `tests/`. Test results have not been verified as part of this README change. Check the app's root health response (`GET /`) once started.

## Related repositories

- [CAMX frontend](https://github.com/Kelumsameera/camxfrontend)
- [CAMX earlier frontend](https://github.com/Kelumsameera/camx_frontend)
- [CAMX web experience](https://github.com/Kelumsameera/camx-lk)

The frontend repositories overlap in purpose but are not identical. Verify which deployment uses which repository before archiving or consolidating them.
