import express from "express";
import { createContact, getAllContacts, getContactById, markAsReplied, toggleHiddenContact, deleteContact, restoreContact } from "../controllers/contactController.js";
import { requireAdmin } from "../middleware/auth.js";
import { contactLimiter } from "../middleware/rateLimiter.js";

const contactRouter = express.Router();

// Public
contactRouter.post("/", contactLimiter, createContact);

// Admin only
contactRouter.get("/admin/all", requireAdmin, getAllContacts);
contactRouter.get("/admin/:contactId", requireAdmin, getContactById);
contactRouter.patch("/admin/replied/:contactId", requireAdmin, markAsReplied);
contactRouter.patch("/admin/hide/:contactId", requireAdmin, toggleHiddenContact);
contactRouter.delete("/admin/:contactId", requireAdmin, deleteContact);
contactRouter.patch("/admin/restore/:contactId", requireAdmin, restoreContact);

export default contactRouter;
