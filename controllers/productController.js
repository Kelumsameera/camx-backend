import Product from "../models/Product.js";
import { isAdmin } from "./userController.js";
export function createProduct(req, res) {

    if(!isAdmin(req)) {
        return res.status(403).json({
            message: "Forbidden: Admins only",
        });
    }

    if (req.user == null) {
        return res.status(401).json({
            message: "Unauthorized",
        });
    }
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Forbidden: Admins only",
        });
    }
    const product = new Product(req.body)
    product.save().then(
        () => {
            res.status(201).json({
                message: "Product created successfully",
            });
        }
        
    ).catch((error) => {
        res.status(500).json({
            message: "Error creating product",
            error: error.message,
        });
    });
}

export function getAllProducts(req, res) {
    if(isAdmin(req)) {
        Product.find().then(
            (products) => {
                res.status(200).json(products);
            }
        ).catch((error) => {
            res.status(500).json({
                message: "Error fetching products",
                error: error.message,
            });
        });
    }
    else {
        Product.find({ isAvailable: true }).then(
            (products) => {
                res.status(200).json(products);
            }
        ).catch((error) => {
            res.status(500).json({
                message: "Error fetching products",
                error: error.message,
            });
        });
    }
}

export function deleteProduct(req, res) {
    if(!isAdmin(req)) {
        return res.status(403).json({
            message: "Forbidden: Admins only",
        });
    } 
    const productId = req.params.id;
    Product.findOneAndDelete({ productId: productId }).then(
        (deletedProduct) => {
            if (deletedProduct) {
                res.status(200).json({
                    message: "Product deleted successfully",
                });
            } else {
                res.status(404).json({
                    message: "Product not found",
                });
            }
        }
    ).catch((error) => {
        res.status(500).json({
            message: "Error deleting product",
            error: error.message,
        });
    });
}

