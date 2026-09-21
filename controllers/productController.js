import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Category from "../models/Category.js";
import { isAdmin } from "../middleware/auth.js";
import { sanitizeHtml, sanitizeText } from "../utils/xssSanitizer.js";
import { parsePagination } from "../middleware/validate.js";
import logger from "../utils/logger.js";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80";

async function resolveCategory(categoryId) {
  if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
    return null;
  }
  return Category.findById(categoryId);
}

// Format and validate product DTO
async function formatProduct(body, index = 0) {
  const categoryDoc = await resolveCategory(body.category);
  if (!categoryDoc) {
    throw new Error("A valid category is required");
  }

  const categoryCode =
    categoryDoc.name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 5) || "GEN";

  const randomNumber = Math.floor(1000 + Math.random() * 9000);
  const generatedSKU = `CAM-${categoryCode}-${Date.now()}-${randomNumber}-${index}`;

  const price = Math.max(0, Number(body.price) || 0);
  const labelPrice = Math.max(0, Number(body.labelPrice ?? body.price ?? 0));
  const stockValue = Math.max(0, parseInt(body.stock ?? body.inventory ?? 0, 10) || 0);

  // Specifications sanitization (CAMX-019)
  const specifications = {};
  if (body.specifications && typeof body.specifications === "object") {
    for (const [key, val] of Object.entries(body.specifications)) {
      if (typeof key === "string" && typeof val === "string") {
        specifications[sanitizeText(key)] = sanitizeText(val);
      }
    }
  }

  return {
    productId: body.productId || generatedSKU,
    name: sanitizeText(body.name || "Untitled Product"),
    altName: Array.isArray(body.altName) ? body.altName.map(sanitizeText) : [],
    description: sanitizeHtml(body.description || ""),
    specifications,
    price,
    labelPrice,
    images: Array.isArray(body.images) && body.images.length > 0 ? body.images : [DEFAULT_IMAGE],
    category: categoryDoc._id,
    brand: sanitizeText(body.brand || "CAMX"),
    stock: stockValue,
    isAvailable: body.isAvailable !== undefined ? Boolean(body.isAvailable) : stockValue > 0,
    ...(body.shippingOptions && { shippingOptions: body.shippingOptions }),
  };
}

// ==========================================
// CREATE PRODUCT (CAMX-014, CAMX-015)
// ==========================================
export async function createProduct(req, res) {
  try {
    if (req.user == null) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: "Forbidden: Admins only" });

    if (!req.body.name || req.body.price === undefined || !req.body.category) {
      return res.status(400).json({ success: false, message: "Product name, price, and category are required." });
    }

    const formattedProduct = await formatProduct(req.body);
    const product = new Product(formattedProduct);
    await product.save();

    logger.info("Product created", { productId: product.productId });
    return res.status(201).json({ success: true, message: "Product created successfully", product });
  } catch (error) {
    logger.error("Error creating product", error);
    return res.status(500).json({ success: false, message: "Error creating product", error: error.message });
  }
}

// ==========================================
// GET ALL PRODUCTS (PAGINATED) (CAMX-025)
// ==========================================
export async function getAllProducts(req, res) {
  try {
    const { page, limit, skip } = parsePagination(req, 24, 100);

    const filter = isAdmin(req) ? {} : { isAvailable: { $ne: false } };

    // Support optional category filtering
    if (req.query.category && mongoose.Types.ObjectId.isValid(req.query.category)) {
      filter.category = req.query.category;
    }

    const products = await Product.find(filter).populate("category", "name slug").sort({ createdAt: -1 }).skip(skip).limit(limit);

    return res.status(200).json(products);
  } catch (error) {
    logger.error("Error fetching products", error);
    return res.status(500).json({ success: false, message: "Error fetching products" });
  }
}

// ==========================================
// GET PRODUCT BY ID
// ==========================================
export async function getProductById(req, res) {
  try {
    const product = await Product.findOne({ productId: req.params.productId }).populate("category", "name slug");
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    return res.status(200).json(product);
  } catch (error) {
    logger.error("Error fetching product", error);
    return res.status(500).json({ success: false, message: "Error fetching product" });
  }
}

// ==========================================
// UPDATE PRODUCT (DTO ALLOWLIST) (CAMX-014, CAMX-015)
// ==========================================
export async function updateProduct(req, res) {
  try {
    if (req.user == null) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: "Forbidden: Admins only" });

    const existingProduct = await Product.findOne({ productId: req.params.productId });
    if (!existingProduct) return res.status(404).json({ success: false, message: "Product not found" });

    // Explicit DTO Allowlist (CAMX-014)
    const updateDTO = {};

    if (req.body.name !== undefined) updateDTO.name = sanitizeText(req.body.name);
    if (Array.isArray(req.body.altName)) updateDTO.altName = req.body.altName.map(sanitizeText);
    if (req.body.description !== undefined) updateDTO.description = sanitizeHtml(req.body.description);
    if (req.body.brand !== undefined) updateDTO.brand = sanitizeText(req.body.brand);

    if (req.body.price !== undefined) {
      updateDTO.price = Math.max(0, Number(req.body.price) || 0);
    }
    if (req.body.labelPrice !== undefined) {
      updateDTO.labelPrice = Math.max(0, Number(req.body.labelPrice) || 0);
    }

    if (Array.isArray(req.body.images) && req.body.images.length > 0) {
      updateDTO.images = req.body.images;
    }

    if (req.body.inventory !== undefined && req.body.stock === undefined) {
      req.body.stock = req.body.inventory;
    }

    if (req.body.stock !== undefined) {
      const stockNum = Math.max(0, parseInt(req.body.stock, 10) || 0);
      updateDTO.stock = stockNum;
      // Auto sync isAvailable based on stock if not explicitly provided
      if (req.body.isAvailable === undefined) {
        updateDTO.isAvailable = stockNum > 0;
      }
    }

    if (req.body.isAvailable !== undefined) {
      updateDTO.isAvailable = Boolean(req.body.isAvailable);
    }

    if (req.body.specifications && typeof req.body.specifications === "object") {
      const specs = {};
      for (const [k, v] of Object.entries(req.body.specifications)) {
        if (typeof k === "string" && typeof v === "string") {
          specs[sanitizeText(k)] = sanitizeText(v);
        }
      }
      updateDTO.specifications = specs;
    }

    if (req.body.shippingOptions && typeof req.body.shippingOptions === "object") {
      updateDTO.shippingOptions = req.body.shippingOptions;
    }

    if (req.body.category !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(req.body.category)) {
        return res.status(400).json({ success: false, message: "Invalid category id" });
      }
      const categoryExists = await Category.exists({ _id: req.body.category });
      if (!categoryExists) {
        return res.status(404).json({ success: false, message: "Category not found" });
      }
      updateDTO.category = req.body.category;
    }

    const updatedProduct = await Product.findOneAndUpdate({ productId: req.params.productId }, { $set: updateDTO }, { returnDocument: "after", runValidators: true }).populate("category", "name slug");

    logger.info("Product updated", { productId: req.params.productId });
    return res.status(200).json({ success: true, message: "Product updated successfully", product: updatedProduct });
  } catch (error) {
    logger.error("Error updating product", error);
    return res.status(500).json({ success: false, message: "Error updating product" });
  }
}

// ==========================================
// DELETE PRODUCT
// ==========================================
export async function deleteProduct(req, res) {
  try {
    if (req.user == null) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: "Forbidden: Admins only" });

    const deletedProduct = await Product.findOneAndDelete({
      productId: req.params.productId,
    });
    if (!deletedProduct) return res.status(404).json({ success: false, message: "Product not found" });

    logger.info("Product deleted", { productId: req.params.productId });
    return res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    logger.error("Error deleting product", error);
    return res.status(500).json({ success: false, message: "Error deleting product" });
  }
}

// ==========================================
// BULK ADD PRODUCTS (CAMX-024)
// ==========================================
export async function bulkAddProducts(req, res) {
  try {
    if (req.user == null) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: "Forbidden: Admins only" });

    const { products } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, message: "Products must be a non-empty array" });
    }

    // Resource constraint: max 50 products per bulk request (CAMX-024)
    if (products.length > 50) {
      return res.status(400).json({ success: false, message: "Maximum 50 products allowed per bulk upload" });
    }

    const formattedProducts = await Promise.all(products.map((body, index) => formatProduct(body, index)));
    const insertedProducts = await Product.insertMany(formattedProducts);

    logger.info("Bulk products added", { count: insertedProducts.length });
    return res.status(201).json({ success: true, message: "Products added successfully", products: insertedProducts });
  } catch (error) {
    logger.error("Error adding bulk products", error);
    return res.status(500).json({ success: false, message: "Error adding products" });
  }
}

// ==========================================
// TOP SELLING PRODUCTS
// ==========================================
export async function getTopSellingProducts(req, res) {
  try {
    const topProducts = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          totalSold: { $sum: "$items.quantity" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "productId",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $lookup: {
          from: "categories",
          localField: "productDetails.category",
          foreignField: "_id",
          as: "productDetails.category",
        },
      },
      { $unwind: { path: "$productDetails.category", preserveNullAndEmptyArrays: true } },
    ]);
    return res.status(200).json(topProducts);
  } catch (error) {
    logger.error("Error fetching top products", error);
    return res.status(500).json({ success: false, message: "Error fetching top products" });
  }
}

// ==========================================
// GET CATEGORIES (Aggregated counts)
// ==========================================
export async function getCategories(req, res) {
  try {
    const categories = await Product.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          categoryId: "$category._id",
          name: { $ifNull: ["$category.name", "Uncategorized"] },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);
    return res.status(200).json(categories);
  } catch (error) {
    logger.error("Error fetching categories", error);
    return res.status(500).json({ success: false, message: "Error fetching categories" });
  }
}
