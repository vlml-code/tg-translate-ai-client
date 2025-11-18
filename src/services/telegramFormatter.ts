/**
 * Telegram formatting utilities
 * Converts Markdown to Telegram-style formatting and handles message splitting
 */

const TELEGRAM_MAX_LENGTH = 4096;

/**
 * Convert Markdown formatting to Telegram formatting
 * Telegram uses: **bold**, __italic__, `code`, ```code blocks```, [text](url)
 */
export function markdownToTelegram(markdown: string): string {
  let text = markdown;

  // Convert bold: **text** or __text__ (markdown) to **text** (telegram)
  // Telegram supports **bold** natively

  // Convert italic: *text* (markdown) to _text_ (telegram single underscore)
  // Need to be careful not to convert ** or __
  text = text.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '_$1_');

  // Convert headers to bold text with newlines
  // # Header -> **Header**
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '**$1**');

  // Convert bullet lists: - item or * item
  text = text.replace(/^[\*\-]\s+/gm, '• ');

  // Convert numbered lists remain as is (1. item)

  // Code blocks remain as ``` for telegram
  // Inline code remains as ` for telegram

  // Links remain as [text](url) for telegram

  return text;
}

/**
 * Split a long message into chunks by paragraphs, respecting Telegram's 4096 character limit
 */
export function splitMessageByParagraphs(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_LENGTH) {
    return [text];
  }

  const messages: string[] = [];
  const paragraphs = text.split(/\n\n+/); // Split by double newlines (paragraphs)

  let currentMessage = '';

  for (const paragraph of paragraphs) {
    // If a single paragraph is longer than the limit, we need to split it further
    if (paragraph.length > TELEGRAM_MAX_LENGTH) {
      // Save current message if it has content
      if (currentMessage.trim()) {
        messages.push(currentMessage.trim());
        currentMessage = '';
      }

      // Split long paragraph by sentences
      const sentences = paragraph.split(/([.!?]+\s+)/);
      let tempParagraph = '';

      for (const sentence of sentences) {
        if ((tempParagraph + sentence).length > TELEGRAM_MAX_LENGTH) {
          if (tempParagraph.trim()) {
            messages.push(tempParagraph.trim());
          }
          tempParagraph = sentence;
        } else {
          tempParagraph += sentence;
        }
      }

      if (tempParagraph.trim()) {
        messages.push(tempParagraph.trim());
      }
      continue;
    }

    // Check if adding this paragraph would exceed the limit
    const testMessage = currentMessage + (currentMessage ? '\n\n' : '') + paragraph;

    if (testMessage.length > TELEGRAM_MAX_LENGTH) {
      // Save current message and start a new one
      if (currentMessage.trim()) {
        messages.push(currentMessage.trim());
      }
      currentMessage = paragraph;
    } else {
      currentMessage = testMessage;
    }
  }

  // Add remaining message
  if (currentMessage.trim()) {
    messages.push(currentMessage.trim());
  }

  // If we ended up with no messages (shouldn't happen), return the original text
  if (messages.length === 0) {
    return [text.substring(0, TELEGRAM_MAX_LENGTH)];
  }

  return messages;
}

/**
 * Prepare a digest for sending to Telegram
 * Converts formatting and splits if necessary
 */
export function prepareDigestForTelegram(digest: string, tag?: string): string[] {
  // Add tag header if provided
  let formattedDigest = digest;
  if (tag) {
    formattedDigest = `**📊 Digest: ${tag.toUpperCase()}**\n\n${digest}`;
  }

  // Convert markdown to telegram formatting
  const telegramFormatted = markdownToTelegram(formattedDigest);

  // Split by paragraphs if too long
  return splitMessageByParagraphs(telegramFormatted);
}
