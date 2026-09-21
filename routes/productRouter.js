import express from "express";
import { bulkAddProducts, createProduct, deleteProduct, getAllProducts, getProductById, updateProduct, getTopSellingProducts, getCategories } from "../controllers/productController.js";
import { requireAdmin } from "../middleware/auth.js";

const productRouter = express.Router();

productRouter.get("/", getAllProducts);
productRouter.post("/", requireAdmin, createProduct);
productRouter.post("/bulk", requireAdmin, bulkAddProducts);
productRouter.get("/top-selling", getTopSellingProducts);
productRouter.get("/categories", getCategories);

productRouter.get("/:productId", getProductById);
productRouter.put("/:productId", requireAdmin, updateProduct);
productRouter.delete("/:productId", requireAdmin, deleteProduct);

export default productRouter;
