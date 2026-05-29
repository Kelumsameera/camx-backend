import express from "express";
import {
  bulkAddProducts,
  createProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  getTopSellingProducts,
  getCategories, // අලුතින් එකතු කළා
} from "../controllers/productController.js";

const productRouter = express.Router();

productRouter.get("/", getAllProducts);
productRouter.post("/", createProduct);
productRouter.post("/bulk", bulkAddProducts); // Bulk add
productRouter.get("/top-selling", getTopSellingProducts);
productRouter.get("/categories", getCategories); // අනිවාර්යයෙන්ම /:productId ට උඩින් තිබිය යුතුය

productRouter.get("/:productId", getProductById);
productRouter.put("/:productId", updateProduct);
productRouter.delete("/:productId", deleteProduct);

export default productRouter;
