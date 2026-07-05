import express from "express";
import { getAllCategories, getCategoryTree, getRootCategories, getCategoryChildren, getCategoryPath, createCategory, updateCategory, deleteCategory } from "../controllers/categoryController.js";

const categoryRouter = express.Router();

// Static routes MUST come before the "/:id/..." routes, otherwise Express
// would try to treat "tree" / "root" as an :id value.
categoryRouter.get("/tree", getCategoryTree);
categoryRouter.get("/root", getRootCategories);
categoryRouter.get("/", getAllCategories);

categoryRouter.get("/:id/children", getCategoryChildren);
categoryRouter.get("/:id/path", getCategoryPath);

categoryRouter.post("/", createCategory);
categoryRouter.put("/:id", updateCategory);
categoryRouter.delete("/:id", deleteCategory);

export default categoryRouter;
