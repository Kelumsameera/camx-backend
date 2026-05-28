import express from "express";

import {
  createContact,
  getAllContacts,
  getContactById,
  markAsReplied,
  toggleHiddenContact,
  deleteContact,
  restoreContact,
} from "../controllers/contactController.js";

const contactRouter = express.Router();

// =====================================
// PUBLIC ROUTES
// =====================================

// Send contact message
contactRouter.post("/", createContact);

// =====================================
// ADMIN ROUTES
// =====================================

// Get all contact messages
contactRouter.get("/admin/all", getAllContacts);

// Get single contact message
contactRouter.get("/admin/:contactId", getContactById);

// Mark contact as replied
contactRouter.patch("/admin/replied/:contactId", markAsReplied);

// Hide / Unhide contact message
contactRouter.patch("/admin/hide/:contactId", toggleHiddenContact);

// Soft delete contact
contactRouter.delete("/admin/:contactId", deleteContact);

// Restore deleted contact
contactRouter.patch("/admin/restore/:contactId", restoreContact);

export default contactRouter;