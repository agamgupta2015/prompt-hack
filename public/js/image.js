/**
 * File API handler for image upload and base64 parsing
 */

export function handleFileSelect(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file selected'));
      return;
    }

    if (!file.type.match('image.*')) {
      reject(new Error('File selected must be an image.'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      // FileReader e.target.result looks like "data:image/jpeg;base64,..."
      const result = e.target.result;
      const mimeTypeMatch = result.match(/^data:(image\/[a-z]+);base64,(.*)$/);

      if (!mimeTypeMatch) {
        reject(new Error('Unable to parse file as base64 string'));
        return;
      }

      resolve({
        mimeType: mimeTypeMatch[1],
        data: mimeTypeMatch[2],
        url: result, // The full data URI used for previewing
      });
    };

    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };

    reader.readAsDataURL(file);
  });
}
