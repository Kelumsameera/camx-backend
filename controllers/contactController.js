import Contact from "../models/contact.js";
import { isAdmin } from "../middleware/auth.js";
import { sanitizeText, sanitizeHtml } from "../utils/xssSanitizer.js";
import { isValidEmail, parsePagination } from "../middleware/validate.js";
import logger from "../utils/logger.js";

// =====================================
// CREATE CONTACT MESSAGE (CAMX-019)
// =====================================
export async function createContact(req, res) {
  try {
    const { name, email, subject, message } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "All fields (name, email, subject, message) are required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // XSS Sanitization (CAMX-019)
    const sanitizedName = sanitizeText(name);
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedSubject = sanitizeText(subject);
    const sanitizedMessage = sanitizeHtml(message);

    const newContact = new Contact({
      name: sanitizedName,
      email: sanitizedEmail,
      subject: sanitizedSubject,
      message: sanitizedMessage,
    });

    const savedContact = await newContact.save();
    logger.info("Contact message received", { contactId: savedContact._id, email: sanitizedEmail });

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      contact: savedContact,
    });
  } catch (error) {
    logger.error("Error creating contact message", error);
    return res.status(500).json({
      success: false,
      message: "Error sending message",
    });
  }
}

// =====================================
// GET ALL CONTACT MESSAGES (ADMIN) (CAMX-025)
// =====================================
export async function getAllContacts(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  try {
    const { page, limit, skip } = parsePagination(req, 10, 50);

    const contacts = await Contact.find({ deleted: false }).sort({ createdAt: -1 }).skip(skip).limit(limit);

    const totalContacts = await Contact.countDocuments({ deleted: false });

    return res.status(200).json({
      success: true,
      totalContacts,
      currentPage: page,
      totalPages: Math.ceil(totalContacts / limit),
      contacts,
    });
  } catch (error) {
    logger.error("Error fetching contacts", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching contacts",
    });
  }
}

// =====================================
// GET CONTACT BY ID (ADMIN)
// =====================================
export async function getContactById(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  try {
    const { contactId } = req.params;
    const contact = await Contact.findById(contactId);

    if (!contact || contact.deleted) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    return res.status(200).json({
      success: true,
      contact,
    });
  } catch (error) {
    logger.error("Error fetching contact", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching contact",
    });
  }
}

// =====================================
// MARK AS REPLIED (ADMIN)
// =====================================
export async function markAsReplied(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  try {
    const { contactId } = req.params;
    const contact = await Contact.findById(contactId);

    if (!contact || contact.deleted) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    contact.replied = true;
    await contact.save();

    return res.status(200).json({
      success: true,
      message: "Marked as replied",
      contact,
    });
  } catch (error) {
    logger.error("Error marking contact as replied", error);
    return res.status(500).json({
      success: false,
      message: "Error updating contact",
    });
  }
}

// =====================================
// HIDE CONTACT MESSAGE (ADMIN)
// =====================================
export async function toggleHiddenContact(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  try {
    const { contactId } = req.params;
    const { hidden } = req.body;

    const contact = await Contact.findById(contactId);

    if (!contact || contact.deleted) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    contact.hidden = Boolean(hidden);
    await contact.save();

    return res.status(200).json({
      success: true,
      message: hidden ? "Contact hidden successfully" : "Contact unhidden successfully",
      contact,
    });
  } catch (error) {
    logger.error("Error toggling hidden status", error);
    return res.status(500).json({
      success: false,
      message: "Error updating hidden status",
    });
  }
}

// =====================================
// DELETE CONTACT MESSAGE (ADMIN)
// =====================================
export async function deleteContact(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  try {
    const { contactId } = req.params;
    const contact = await Contact.findById(contactId);

    if (!contact || contact.deleted) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    contact.deleted = true;
    await contact.save();

    return res.status(200).json({
      success: true,
      message: "Contact deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting contact", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting contact",
    });
  }
}

// =====================================
// RESTORE CONTACT MESSAGE (ADMIN)
// =====================================
export async function restoreContact(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  try {
    const { contactId } = req.params;
    const contact = await Contact.findById(contactId);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    contact.deleted = false;
    await contact.save();

    return res.status(200).json({
      success: true,
      message: "Contact restored successfully",
      contact,
    });
  } catch (error) {
    logger.error("Error restoring contact", error);
    return res.status(500).json({
      success: false,
      message: "Error restoring contact",
    });
  }
}
