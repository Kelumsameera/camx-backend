import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Category from "../models/Category.js";
import { isAdmin } from "./userController.js";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80";

async function resolveCategory(categoryId) {
  if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
    return null;
  }
  return Category.findById(categoryId);
}

// NOTE: this is now async because the SKU prefix is derived from the
// referenced Category's name instead of a raw category string.
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

  return {
    productId: body.productId || generatedSKU,
    name: body.name,
    altName: body.altName || [],
    description: body.description || "",
    specifications: body.specifications || {},
    price: body.price || 0,
    labelPrice: body.labelPrice ?? body.price ?? 0,
    images: body.images && body.images.length > 0 ? body.images : [DEFAULT_IMAGE],
    category: categoryDoc._id,
    brand: body.brand || "CAMX",
    stock: body.stock ?? body.inventory ?? 0,
    isAvailable: body.isAvailable ?? true,
  };
}

export async function createProduct(req, res) {
  try {
    if (req.user == null) return res.status(401).json({ message: "Unauthorized" });
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden: Admins only" });

    const formattedProduct = await formatProduct(req.body);
    const product = new Product(formattedProduct);
    await product.save();

    return res.status(201).json({ message: "Product created successfully", product });
  } catch (error) {
    return res.status(500).json({ message: "Error creating product", error: error.message });
  }
}

export async function getAllProducts(req, res) {
  try {
    const filter = isAdmin(req) ? {} : { isAvailable: true };
    const products = await Product.find(filter).populate("category", "name slug");
    return res.status(200).json(products);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching products", error: error.message });
  }
}

export async function getProductById(req, res) {
  try {
    const product = await Product.findOne({ productId: req.params.productId }).populate("category", "name slug");
    if (!product) return res.status(404).json({ message: "Product not found" });
    return res.status(200).json(product);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching product", error: error.message });
  }
}

export async function updateProduct(req, res) {
  try {
    if (req.user == null) return res.status(401).json({ message: "Unauthorized" });
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden: Admins only" });

    if (req.body.inventory != null) {
      req.body.stock = req.body.inventory;
      delete req.body.inventory;
    }
    if (req.body.price != null && req.body.labelPrice == null) {
      req.body.labelPrice = req.body.price;
    }
    if (req.body.images && req.body.images.length === 0) {
      req.body.images = [DEFAULT_IMAGE];
    }
    if (req.body.category !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(req.body.category)) {
        return res.status(400).json({ message: "Invalid category id" });
      }
      const categoryExists = await Category.exists({ _id: req.body.category });
      if (!categoryExists) {
        return res.status(404).json({ message: "Category not found" });
      }
    }

    const updatedProduct = await Product.findOneAndUpdate({ productId: req.params.productId }, req.body, { new: true, runValidators: true }).populate("category", "name slug");

    if (!updatedProduct) return res.status(404).json({ message: "Product not found" });

    return res.status(200).json({ message: "Product updated successfully", product: updatedProduct });
  } catch (error) {
    return res.status(500).json({ message: "Error updating product", error: error.message });
  }
}

export async function deleteProduct(req, res) {
  try {
    if (req.user == null) return res.status(401).json({ message: "Unauthorized" });
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden: Admins only" });

    const deletedProduct = await Product.findOneAndDelete({
      productId: req.params.productId,
    });
    if (!deletedProduct) return res.status(404).json({ message: "Product not found" });

    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting product", error: error.message });
  }
}

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
    return res.status(500).json({ message: "Error fetching top products", error: error.message });
  }
}

export async function bulkAddProducts(req, res) {
  try {
    if (req.user == null) return res.status(401).json({ message: "Unauthorized" });
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden: Admins only" });

    const products = req.body.products;
    if (!Array.isArray(products)) {
      return res.status(400).json({ message: "Products must be an array" });
    }

    const formattedProducts = await Promise.all(products.map((body, index) => formatProduct(body, index)));

    const insertedProducts = await Product.insertMany(formattedProducts);
    return res.status(201).json({ message: "Products added successfully", products: insertedProducts });
  } catch (error) {
    return res.status(500).json({ message: "Error adding products", error: error.message });
  }
}

// Kept for backward compatibility with existing dashboards — now derives
// counts from the real Category collection instead of raw strings.
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
      { $unwind: "$category" },
      { $project: { _id: 0, categoryId: "$category._id", name: "$category.name", count: 1 } },
      { $sort: { count: -1 } },
    ]);
    return res.status(200).json(categories);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching categories", error: error.message });
  }
}
