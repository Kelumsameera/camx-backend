import mongoose from "mongoose";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { isAdmin } from "../middleware/auth.js";
import { sanitizeText, sanitizeHtml } from "../utils/xssSanitizer.js";
import logger from "../utils/logger.js";

// ==========================================
// HELPERS
// ==========================================

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function generateUniqueSlug(name, excludeId = null) {
  const baseSlug = slugify(name);
  let slug = baseSlug || "category";
  let counter = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await Category.findOne(query).select("_id").lean();
    if (!existing) return slug;
    slug = `${baseSlug || "category"}-${counter}`;
    counter += 1;
  }
}

// Build a nested tree from a flat list in O(n)
function buildTree(categories, productCountMap = {}) {
  const map = new Map();
  const roots = [];

  categories.forEach((cat) => {
    map.set(String(cat._id), {
      _id: cat._id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      image: cat.image,
      parent: cat.parent,
      level: cat.level,
      order: cat.order,
      isActive: cat.isActive,
      productCount: productCountMap[String(cat._id)] || 0,
      children: [],
    });
  });

  map.forEach((node) => {
    if (node.parent) {
      const parentNode = map.get(String(node.parent));
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  const byOrder = (a, b) => a.order - b.order || a.name.localeCompare(b.name);
  const sortRecursive = (nodes) => {
    nodes.sort(byOrder);
    nodes.forEach((n) => sortRecursive(n.children));
  };
  sortRecursive(roots);

  return roots;
}

// Recompute levels for every descendant of `rootId`
async function cascadeLevelUpdate(rootId, rootLevel, allCategories) {
  const childrenByParent = new Map();
  allCategories.forEach((cat) => {
    const key = cat.parent ? String(cat.parent) : null;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(cat);
  });

  const bulkOps = [];
  const queue = [{ id: String(rootId), level: rootLevel }];

  while (queue.length) {
    const { id, level } = queue.shift();
    const children = childrenByParent.get(id) || [];
    for (const child of children) {
      const childLevel = level + 1;
      bulkOps.push({
        updateOne: {
          filter: { _id: child._id },
          update: { $set: { level: childLevel } },
        },
      });
      queue.push({ id: String(child._id), level: childLevel });
    }
  }

  if (bulkOps.length) {
    await Category.bulkWrite(bulkOps);
  }
}

// ==========================================
// GET FULL CATEGORY TREE
// ==========================================
export async function getCategoryTree(req, res) {
  try {
    const categories = await Category.find().sort({ order: 1, name: 1 }).lean();

    const counts = await Product.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]);
    const productCountMap = {};
    counts.forEach((c) => {
      productCountMap[String(c._id)] = c.count;
    });

    const tree = buildTree(categories, productCountMap);
    return res.status(200).json(tree);
  } catch (error) {
    logger.error("Error fetching category tree", error);
    return res.status(500).json({ success: false, message: "Error fetching category tree" });
  }
}

// ==========================================
// GET ALL CATEGORIES
// ==========================================
export async function getAllCategories(req, res) {
  try {
    const categories = await Category.find().sort({ level: 1, order: 1, name: 1 });
    return res.status(200).json(categories);
  } catch (error) {
    logger.error("Error fetching categories", error);
    return res.status(500).json({ success: false, message: "Error fetching categories" });
  }
}

// ==========================================
// GET ROOT CATEGORIES
// ==========================================
export async function getRootCategories(req, res) {
  try {
    const roots = await Category.find({ parent: null }).sort({ order: 1, name: 1 });
    return res.status(200).json(roots);
  } catch (error) {
    logger.error("Error fetching root categories", error);
    return res.status(500).json({ success: false, message: "Error fetching root categories" });
  }
}

// ==========================================
// GET CHILDREN OF A CATEGORY
// ==========================================
export async function getCategoryChildren(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid category id" });
    }
    const children = await Category.find({ parent: id }).sort({ order: 1, name: 1 });
    return res.status(200).json(children);
  } catch (error) {
    logger.error("Error fetching children categories", error);
    return res.status(500).json({ success: false, message: "Error fetching children" });
  }
}

// ==========================================
// GET BREADCRUMB PATH
// ==========================================
export async function getCategoryPath(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid category id" });
    }

    const allCategories = await Category.find().select("name slug parent").lean();
    const map = new Map(allCategories.map((c) => [String(c._id), c]));

    let current = map.get(String(id));
    if (!current) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const path = [];
    const visited = new Set();
    while (current) {
      if (visited.has(String(current._id))) break;
      visited.add(String(current._id));
      path.unshift({ _id: current._id, name: current.name, slug: current.slug });
      current = current.parent ? map.get(String(current.parent)) : null;
    }

    return res.status(200).json(path);
  } catch (error) {
    logger.error("Error fetching category path", error);
    return res.status(500).json({ success: false, message: "Error fetching category path" });
  }
}

// ==========================================
// CREATE A NEW CATEGORY
// ==========================================
export async function createCategory(req, res) {
  try {
    if (req.user == null) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: "Forbidden: Admins only" });

    const { name, description, image, parent, order, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    let parentDoc = null;
    let level = 0;

    if (parent) {
      if (!mongoose.Types.ObjectId.isValid(parent)) {
        return res.status(400).json({ success: false, message: "Invalid parent category id" });
      }
      parentDoc = await Category.findById(parent);
      if (!parentDoc) {
        return res.status(404).json({ success: false, message: "Parent category not found" });
      }
      level = parentDoc.level + 1;
    }

    const sanitizedName = sanitizeText(name.trim());
    const existing = await Category.findOne({
      name: sanitizedName,
      parent: parentDoc ? parentDoc._id : null,
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "A category with this name already exists under the selected parent" });
    }

    const slug = await generateUniqueSlug(sanitizedName);

    const newCategory = new Category({
      name: sanitizedName,
      slug,
      description: sanitizeHtml(description || ""),
      image: image || "",
      parent: parentDoc ? parentDoc._id : null,
      level,
      order: Number(order) || 0,
      isActive: isActive ?? true,
    });

    await newCategory.save();
    logger.info("Category created", { categoryId: newCategory._id, name: sanitizedName });

    return res.status(201).json({ success: true, message: "Category created successfully", category: newCategory });
  } catch (error) {
    logger.error("Error creating category", error);
    return res.status(500).json({ success: false, message: "Error creating category" });
  }
}

// ==========================================
// UPDATE A CATEGORY
// ==========================================
export async function updateCategory(req, res) {
  try {
    if (req.user == null) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: "Forbidden: Admins only" });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid category id" });
    }

    const category = await Category.findById(id);
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    const { name, description, image, parent, order, isActive } = req.body;
    const allCategories = await Category.find().lean();
    const map = new Map(allCategories.map((c) => [String(c._id), c]));

    let newParentId = category.parent ? String(category.parent) : null;
    let newLevel = category.level;

    if (parent !== undefined) {
      if (parent === null || parent === "") {
        newParentId = null;
        newLevel = 0;
      } else {
        if (!mongoose.Types.ObjectId.isValid(parent)) {
          return res.status(400).json({ success: false, message: "Invalid parent category id" });
        }
        if (String(parent) === String(id)) {
          return res.status(400).json({ success: false, message: "A category cannot be its own parent" });
        }

        const proposedParent = map.get(String(parent));
        if (!proposedParent) {
          return res.status(404).json({ success: false, message: "Parent category not found" });
        }

        let walker = proposedParent;
        const visited = new Set();
        while (walker) {
          if (String(walker._id) === String(id)) {
            return res.status(400).json({ success: false, message: "Circular category reference is not allowed" });
          }
          if (visited.has(String(walker._id))) break;
          visited.add(String(walker._id));
          walker = walker.parent ? map.get(String(walker.parent)) : null;
        }

        newParentId = String(parent);
        newLevel = proposedParent.level + 1;
      }
    }

    const newName = name !== undefined ? sanitizeText(name.trim()) : category.name;

    if (name !== undefined || parent !== undefined) {
      const duplicate = await Category.findOne({
        _id: { $ne: category._id },
        name: newName,
        parent: newParentId,
      });
      if (duplicate) {
        return res.status(400).json({ success: false, message: "A category with this name already exists under the selected parent" });
      }
    }

    let newSlug = category.slug;
    if (name !== undefined && newName !== category.name) {
      newSlug = await generateUniqueSlug(newName, category._id);
    }

    category.name = newName;
    category.slug = newSlug;
    if (description !== undefined) category.description = sanitizeHtml(description);
    if (image !== undefined) category.image = image;
    if (order !== undefined) category.order = Number(order) || 0;
    if (isActive !== undefined) category.isActive = Boolean(isActive);
    category.parent = newParentId;
    category.level = newLevel;

    await category.save();
    await cascadeLevelUpdate(category._id, newLevel, allCategories);

    return res.status(200).json({ success: true, message: "Category updated successfully", category });
  } catch (error) {
    logger.error("Error updating category", error);
    return res.status(500).json({ success: false, message: "Error updating category" });
  }
}

// ==========================================
// DELETE A CATEGORY
// ==========================================
export async function deleteCategory(req, res) {
  try {
    if (req.user == null) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: "Forbidden: Admins only" });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid category id" });
    }

    const childCount = await Category.countDocuments({ parent: id });
    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category: it has ${childCount} child ${childCount === 1 ? "category" : "categories"}. Delete or move them first.`,
      });
    }

    const productCount = await Product.countDocuments({ category: id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category: ${productCount} product(s) are assigned to it. Reassign them first.`,
      });
    }

    const deletedCategory = await Category.findByIdAndDelete(id);
    if (!deletedCategory) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    logger.info("Category deleted", { categoryId: id });
    return res.status(200).json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    logger.error("Error deleting category", error);
    return res.status(500).json({ success: false, message: "Error deleting category" });
  }
}
