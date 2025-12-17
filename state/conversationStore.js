/**
 * Conversation Store (In-Memory)
 *
 * NOTE:
 * - This is intentionally simple
 * - Safe for single-instance use
 * - Designed to be replaced by Redis later
 */

const conversations = new Map();

/**
 * Get conversation state for a user
 */
function getConversation(userId) {
  return conversations.get(userId) || null;
}

/**
 * Set / overwrite conversation state for a user
 */
function setConversation(userId, state) {
  conversations.set(userId, state);
}

/**
 * Clear conversation state for a user
 */
function clearConversation(userId) {
  conversations.delete(userId);
}

module.exports = {
  getConversation,
  setConversation,
  clearConversation
};
