import mongoose from "mongoose";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { isAdmin } from "./userController.js";

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

  // Loop until a free slug is found. Bounded by DB state, not user input,
  // so this cannot run away.
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

// Build a nested tree from a flat list in O(n) — no recursive DB calls.
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
        // Orphaned reference (parent was deleted out-of-band) — surface it
        // as a root instead of silently dropping the category.
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

// Recompute levels for every descendant of `rootId` using an in-memory map
// (single fetch already done by the caller) and persist with one bulk write.
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

    // Single aggregation for product counts per category (avoids N+1).
    const counts = await Product.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]);
    const productCountMap = {};
    counts.forEach((c) => {
      productCountMap[String(c._id)] = c.count;
    });

    const tree = buildTree(categories, productCountMap);
    return res.status(200).json(tree);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching category tree", error: error.message });
  }
}

// ==========================================
// GET ALL CATEGORIES (flat list — kept for simple selects / backward compat)
// ==========================================
export async function getAllCategories(req, res) {
  try {
    const categories = await Category.find().sort({ level: 1, order: 1, name: 1 });
    return res.status(200).json(categories);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching categories", error: error.message });
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
    return res.status(500).json({ message: "Error fetching root categories", error: error.message });
  }
}

// ==========================================
// GET CHILDREN OF A CATEGORY
// ==========================================
export async function getCategoryChildren(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid category id" });
    }
    const children = await Category.find({ parent: id }).sort({ order: 1, name: 1 });
    return res.status(200).json(children);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching children", error: error.message });
  }
}

// ==========================================
// GET BREADCRUMB PATH (root -> leaf)
// ==========================================
export async function getCategoryPath(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid category id" });
    }

    // Fetch all categories once, walk the chain in memory (no N+1 queries).
    const allCategories = await Category.find().select("name slug parent").lean();
    const map = new Map(allCategories.map((c) => [String(c._id), c]));

    let current = map.get(String(id));
    if (!current) {
      return res.status(404).json({ message: "Category not found" });
    }

    const path = [];
    const visited = new Set();
    while (current) {
      if (visited.has(String(current._id))) break; // guard against bad data cycles
      visited.add(String(current._id));
      path.unshift({ _id: current._id, name: current.name, slug: current.slug });
      current = current.parent ? map.get(String(current.parent)) : null;
    }

    return res.status(200).json(path);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching category path", error: error.message });
  }
}

// ==========================================
// CREATE A NEW CATEGORY
// ==========================================
export async function createCategory(req, res) {
  try {
    if (req.user == null) return res.status(401).json({ message: "Unauthorized" });
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden: Admins only" });

    const { name, description, image, parent, order, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }

    let parentDoc = null;
    let level = 0;

    if (parent) {
      if (!mongoose.Types.ObjectId.isValid(parent)) {
        return res.status(400).json({ message: "Invalid parent category id" });
      }
      parentDoc = await Category.findById(parent);
      if (!parentDoc) {
        return res.status(404).json({ message: "Parent category not found" });
      }
      level = parentDoc.level + 1;
    }

    // Duplicate name check under the same parent.
    const existing = await Category.findOne({
      name: name.trim(),
      parent: parentDoc ? parentDoc._id : null,
    });
    if (existing) {
      return res.status(400).json({ message: "A category with this name already exists under the selected parent" });
    }

    const slug = await generateUniqueSlug(name.trim());

    const newCategory = new Category({
      name: name.trim(),
      slug,
      description: description || "",
      image: image || "",
      parent: parentDoc ? parentDoc._id : null,
      level,
      order: order ?? 0,
      isActive: isActive ?? true,
    });

    await newCategory.save();

    return res.status(201).json({ message: "Category created successfully", category: newCategory });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Category already exists (duplicate slug or name)" });
    }
    return res.status(500).json({ message: "Error creating category", error: error.message });
  }
}

// ==========================================
// UPDATE A CATEGORY
// ==========================================
export async function updateCategory(req, res) {
  try {
    if (req.user == null) return res.status(401).json({ message: "Unauthorized" });
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden: Admins only" });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid category id" });
    }

    const category = await Category.findById(id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    const { name, description, image, parent, order, isActive } = req.body;

    // Fetch all categories once — used for cycle-checking AND cascading level updates.
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
          return res.status(400).json({ message: "Invalid parent category id" });
        }
        if (String(parent) === String(id)) {
          return res.status(400).json({ message: "A category cannot be its own parent" });
        }

        const proposedParent = map.get(String(parent));
        if (!proposedParent) {
          return res.status(404).json({ message: "Parent category not found" });
        }

        // Circular reference check: walk up from the proposed parent and make
        // sure the category being edited never appears as one of its own ancestors.
        let walker = proposedParent;
        const visited = new Set();
        while (walker) {
          if (String(walker._id) === String(id)) {
            return res.status(400).json({ message: "Circular category reference is not allowed" });
          }
          if (visited.has(String(walker._id))) break;
          visited.add(String(walker._id));
          walker = walker.parent ? map.get(String(walker.parent)) : null;
        }

        newParentId = String(parent);
        newLevel = proposedParent.level + 1;
      }
    }

    const newName = name !== undefined ? name.trim() : category.name;

    if (name !== undefined || parent !== undefined) {
      const duplicate = await Category.findOne({
        _id: { $ne: category._id },
        name: newName,
        parent: newParentId,
      });
      if (duplicate) {
        return res.status(400).json({ message: "A category with this name already exists under the selected parent" });
      }
    }

    let newSlug = category.slug;
    if (name !== undefined && newName !== category.name) {
      newSlug = await generateUniqueSlug(newName, category._id);
    }

    category.name = newName;
    category.slug = newSlug;
    if (description !== undefined) category.description = description;
    if (image !== undefined) category.image = image;
    if (order !== undefined) category.order = order;
    if (isActive !== undefined) category.isActive = isActive;
    category.parent = newParentId;
    category.level = newLevel;

    await category.save();

    // If the parent changed, every descendant's `level` is now stale — fix it in one pass.
    await cascadeLevelUpdate(category._id, newLevel, allCategories);

    return res.status(200).json({ message: "Category updated successfully", category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Duplicate slug or name" });
    }
    return res.status(500).json({ message: "Error updating category", error: error.message });
  }
}

// ==========================================
// DELETE A CATEGORY
// ==========================================
export async function deleteCategory(req, res) {
  try {
    if (req.user == null) return res.status(401).json({ message: "Unauthorized" });
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden: Admins only" });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid category id" });
    }

    const childCount = await Category.countDocuments({ parent: id });
    if (childCount > 0) {
      return res.status(400).json({
        message: `Cannot delete category: it has ${childCount} child ${childCount === 1 ? "category" : "categories"}. Delete or move them first.`,
      });
    }

    const productCount = await Product.countDocuments({ category: id });
    if (productCount > 0) {
      return res.status(400).json({
        message: `Cannot delete category: ${productCount} product(s) are assigned to it. Reassign them first.`,
      });
    }

    const deletedCategory = await Category.findByIdAndDelete(id);
    if (!deletedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting category", error: error.message });
  }
}
