import fs from 'node:fs';
import path from 'node:path';
import PdfToImg, { OptionsType } from "pdftoimg-js";
import crypto from 'crypto';

export const convertPDFToImages = async (pdfPath: string, folderName: string) => {
  try {
    // Ensure the directory structure exists
    const outputDir = path.join(
      __dirname,
      '../../public/uploads',
      folderName
    );

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate a random filename base to avoid collisions
    const randomFilenameBase = crypto.randomBytes(16).toString('hex');
    
    const pdfToImgOptions: OptionsType = {
      scale: 3,
      returnType: 'buffer',
      imgType: 'png',
      pages: 'all',
    };
    
    const document = await PdfToImg(pdfPath, pdfToImgOptions);
    const outputFilenames: string[] = [];

    // Process each page of the PDF
    document.forEach((pageBuffer, index) => {
      const pageNumber = index + 1;
      const filename = `${randomFilenameBase}-page-${pageNumber}.png`;
      const fullOutputPath = path.join(outputDir, filename);
  
      fs.writeFileSync(fullOutputPath, pageBuffer);
      outputFilenames.push(folderName + '/' + filename);
    });

    return outputFilenames;
  } catch (error) {
    console.error('Error converting PDF to images:', error);
    throw error;
  }
};