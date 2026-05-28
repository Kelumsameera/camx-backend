import express from "express";

import {
  createProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  updateProduct,
} from "../controllers/productController.js";

const productRouter = express.Router();

// =====================================
// GET ALL PRODUCTS
// =====================================

productRouter.get(
  "/",
  getAllProducts
);

// =====================================
// CREATE PRODUCT
// =====================================

productRouter.post(
  "/",
  createProduct
);

// =====================================
// GET SINGLE PRODUCT
// =====================================

productRouter.get(
  "/:productId",
  getProductById
);

// =====================================
// UPDATE PRODUCT
// =====================================

productRouter.put(
  "/:productId",
  updateProduct
);

// =====================================
// DELETE PRODUCT
// =====================================

productRouter.delete(
  "/:productId",
  deleteProduct
);

// =====================================
// EXPORT
// =====================================

export default productRouter;