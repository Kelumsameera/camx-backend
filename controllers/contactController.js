import Contact from "../models/Contact.js";
import { isAdmin } from "./userController.js";

// =====================================
// CREATE CONTACT MESSAGE
// =====================================
export async function createContact(req, res) {
  try {
    const { name, email, subject, message } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Create contact
    const newContact = new Contact({
      name,
      email,
      subject,
      message,
    });

    const savedContact = await newContact.save();

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      contact: savedContact,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error sending message",
      error: error.message,
    });
  }
}

// =====================================
// GET ALL CONTACT MESSAGES (ADMIN)
// =====================================
export async function getAllContacts(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const contacts = await Contact.find({
      deleted: false,
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const totalContacts = await Contact.countDocuments({
      deleted: false,
    });

    res.json({
      success: true,
      totalContacts,
      currentPage: page,
      totalPages: Math.ceil(totalContacts / limit),
      contacts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching contacts",
      error: error.message,
    });
  }
}

// =====================================
// GET CONTACT BY ID
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

    res.json({
      success: true,
      contact,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching contact",
      error: error.message,
    });
  }
}

// =====================================
// MARK AS REPLIED
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

    res.json({
      success: true,
      message: "Marked as replied",
      contact,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating contact",
      error: error.message,
    });
  }
}

// =====================================
// HIDE CONTACT MESSAGE
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

    res.json({
      success: true,
      message: hidden
        ? "Contact hidden successfully"
        : "Contact unhidden successfully",
      contact,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating hidden status",
      error: error.message,
    });
  }
}

// =====================================
// DELETE CONTACT MESSAGE
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

    res.json({
      success: true,
      message: "Contact deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting contact",
      error: error.message,
    });
  }
}

// =====================================
// RESTORE CONTACT MESSAGE
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

    res.json({
      success: true,
      message: "Contact restored successfully",
      contact,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error restoring contact",
      error: error.message,
    });
  }
}
