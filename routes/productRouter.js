import express from "express";
import {
  createProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  updateProduct,
} from "../controllers/productController.js";

const productRouter = express.Router();

productRouter.get("/", getAllProducts);

productRouter.post("/", createProduct);

productRouter.get("/:productId", getProductById);

productRouter.delete("/:productId", deleteProduct);

productRouter.put("/:productId", updateProduct);

export default productRouter;
