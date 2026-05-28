import Product from "../models/Product.js";

import { isAdmin } from "./userController.js";

// =========================
// CREATE PRODUCT
// =========================

export async function createProduct(req, res) {
  try {
    // =========================
    // ADMIN CHECK
    // =========================

    if (!isAdmin(req)) {
      return res.status(403).json({
        message: "Forbidden: Admins only",
      });
    }

    // =========================
    // USER CHECK
    // =========================

    if (req.user == null) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const body = req.body;

    // =========================
    // CATEGORY CODE
    // =========================

    const categoryCode =
      body.category
        ?.toUpperCase()

        .replace(/[^A-Z0-9]/g, "")

        .slice(0, 5) || "GEN";

    // =========================
    // RANDOM NUMBER
    // =========================

    const randomNumber = Math.floor(1000 + Math.random() * 9000);

    // =========================
    // GENERATED SKU
    // =========================

    const generatedSKU = `CAM-${categoryCode}-${randomNumber}`;

    // =========================
    // PRODUCT
    // =========================

    const product = new Product({
      // AUTO SKU
      productId: body.productId || generatedSKU,

      name: body.name,

      altName: body.altName || [],

      description: body.description,

      // DYNAMIC SPECIFICATIONS
      specifications: body.specifications || {},

      price: body.price,

      labelPrice: body.labelPrice ?? body.price,

      images: body.images || [
        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80",
      ],

      category: body.category || "Uncategorized",

      brand: body.brand || "CAMX",

      stock: body.stock ?? body.inventory ?? 0,

      isAvailable: body.isAvailable ?? true,
    });

    // =========================
    // SAVE
    // =========================

    await product.save();

    return res.status(201).json({
      message: "Product created successfully",

      product,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error creating product",

      error: error.message,
    });
  }
}

// =========================
// GET ALL PRODUCTS
// =========================

export function getAllProducts(req, res) {
  if (isAdmin(req)) {
    Product.find()

      .then((products) => {
        res.status(200).json(products);
      })

      .catch((error) => {
        res.status(500).json({
          message: "Error fetching products",

          error: error.message,
        });
      });
  } else {
    Product.find({
      isAvailable: true,
    })

      .then((products) => {
        res.status(200).json(products);
      })

      .catch((error) => {
        res.status(500).json({
          message: "Error fetching products",

          error: error.message,
        });
      });
  }
}

// =========================
// GET PRODUCT BY ID
// =========================

export function getProductById(req, res) {
  const productId = req.params.productId;

  Product.findOne({
    productId: productId,
  })

    .then((product) => {
      if (product == null) {
        return res.status(404).json({
          message: "Product not found",
        });
      }

      return res.status(200).json(product);
    })

    .catch((error) => {
      return res.status(500).json({
        message: "Error fetching product",

        error: error.message,
      });
    });
}

// =========================
// UPDATE PRODUCT
// =========================

export async function updateProduct(req, res) {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        message: "Forbidden: Admins only",
      });
    }

    const productId = req.params.productId;

    // INVENTORY -> STOCK
    if (req.body.inventory != null) {
      req.body.stock = req.body.inventory;

      delete req.body.inventory;
    }

    // LABEL PRICE
    if (req.body.price != null && req.body.labelPrice == null) {
      req.body.labelPrice = req.body.price;
    }

    // UPDATE
    const updatedProduct = await Product.findOneAndUpdate(
      {
        productId: productId,
      },

      req.body,

      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedProduct) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    return res.status(200).json({
      message: "Product updated successfully",

      product: updatedProduct,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating product",

      error: error.message,
    });
  }
}

// =========================
// DELETE PRODUCT
// =========================

export function deleteProduct(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      message: "Forbidden: Admins only",
    });
  }

  const productId = req.params.productId;

  Product.findOneAndDelete({
    productId: productId,
  })

    .then((deletedProduct) => {
      if (deletedProduct) {
        res.status(200).json({
          message: "Product deleted successfully",
        });
      } else {
        res.status(404).json({
          message: "Product not found",
        });
      }
    })

    .catch((error) => {
      res.status(500).json({
        message: "Error deleting product",

        error: error.message,
      });
    });
}

// =========================
// GET TOP SELLING PRODUCTS
// =========================
export async function getTopSellingProducts(req, res) {
  try {
    // Orders වල items දත්ත විශ්ලේෂණය කර වැඩිම විකුණුම් ඇති නිෂ්පාදන ලබා ගන්න
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
    ]);
    res.json(topProducts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
