const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

class PDFProcessorService {
  constructor() {
    console.log('📄 PDF Processor Service initialized');
  }

  async processPDF(fileBuffer, fileName) {
    try {
      console.log('📄 Processing PDF:', fileName);

      // Parse PDF
      const data = await pdfParse(fileBuffer);

      console.log('✅ PDF parsed successfully');
      console.log('Pages:', data.numpages);
      console.log('Text length:', data.text.length);

      // Extract text
      let text = data.text.trim();

      // Clean up the text
      text = text
        .replace(/\s+/g, ' ')           // Multiple spaces to single space
        .replace(/\n\s*\n/g, '\n\n')    // Multiple newlines to double newline
        .trim();

      if (!text || text.length < 50) {
        throw new Error('PDF appears to be empty or contains no extractable text');
      }

      // Generate title from filename or first line
      const title = fileName.replace(/\.pdf$/i, '') || 'PDF Document';

      return {
        title,
        content: text,
        fileName,
        pageCount: data.numpages,
        wordCount: text.split(/\s+/).length
      };
    } catch (error) {
      console.error('❌ PDF Processing Error:', error.message);
      
      if (error.message.includes('password')) {
        throw new Error('PDF is password protected');
      } else if (error.message.includes('Invalid PDF')) {
        throw new Error('Invalid or corrupted PDF file');
      }
      
      throw new Error(`Failed to process PDF: ${error.message}`);
    }
  }

  async processPDFFromPath(filePath) {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      return await this.processPDF(fileBuffer, fileName);
    } catch (error) {
      console.error('❌ PDF File Read Error:', error.message);
      throw new Error(`Failed to read PDF file: ${error.message}`);
    }
  }
}

module.exports = new PDFProcessorService();