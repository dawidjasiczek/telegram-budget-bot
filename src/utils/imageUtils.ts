import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { config } from '../config/config';

/**
 * Resizes the image to a maximum specified dimension (maxDimension)
 * and saves it with a filename based on the current date.
 * @param {string} originalFilePath - Path to the original image file.
 * @returns {Promise<string>} - New path to the processed image.
 */
export async function processAndRenameImage(originalFilePath: string, remove: boolean = false): Promise<string> {
  const outputDir = path.dirname(originalFilePath);
  const newFileName = getCurrentDateFileName();
  const newFilePath = path.join(outputDir, newFileName);

  try {
    await sharp(originalFilePath)
      .resize({
        width: config.maxDimension,
        height: config.maxDimension,
        fit: "inside",
      })
      .toFile(newFilePath);

    if (remove) {
      fs.unlinkSync(originalFilePath);
    }

    return newFilePath;
  } catch (error) {
    console.error("Error while processing image:", error);
    throw error;
  }
}

/**
 * Generates a filename based on the current date and time.
 * Format: YYYY-MM-DD_HH-mm-ss.jpg
 * @returns {string} - Generated filename.
 */
function getCurrentDateFileName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}.jpg`;
} 