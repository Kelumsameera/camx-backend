import express from "express";
import { getAllCategories, getCategoryTree, getRootCategories, getCategoryChildren, getCategoryPath, createCategory, updateCategory, deleteCategory } from "../controllers/categoryController.js";
import { requireAdmin } from "../middleware/auth.js";

const categoryRouter = express.Router();

// Public Read Routes
categoryRouter.get("/tree", getCategoryTree);
categoryRouter.get("/root", getRootCategories);
categoryRouter.get("/", getAllCategories);
categoryRouter.get("/:id/children", getCategoryChildren);
categoryRouter.get("/:id/path", getCategoryPath);

// Admin Mutation Routes
categoryRouter.post("/", requireAdmin, createCategory);
categoryRouter.put("/:id", requireAdmin, updateCategory);
categoryRouter.delete("/:id", requireAdmin, deleteCategory);

export default categoryRouter;
