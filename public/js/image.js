/* ── IMAGE ── */

/**
 * Validates and parses an image file into a Base64 URI asynchronously.
 * @param {File} file - Expected image file
 * @returns {Promise<Object>} Dictionary containing MIME type and raw b64
 * @throws {Error} if file is not an image or >5MB
 */
export async function handleFileSelect(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Validation failed: No file selected.'));
    if (!file.type.match('image.*')) {
      return reject(new Error('Validation failed: File must be an image.'));
    }
    if (file.size > 5 * 1024 * 1024) {
      return reject(new Error('Validation failed: Image exceeds 5MB limit.'));
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const result = e.target.result;
      const match = result.match(/^data:(image\/[a-z]+);base64,(.*)$/);
      if (!match) return reject(new Error('Parsing failed: Invalid base64 sequence.'));
      resolve({ mimeType: match[1], data: match[2], url: result });
    };

    reader.onerror = () => reject(new Error('FS Error: Cannot read file blob.'));
    reader.readAsDataURL(file);
  });
}
