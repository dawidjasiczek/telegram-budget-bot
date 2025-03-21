import sharp, { SharpenOptions } from 'sharp';
import fs from 'fs';
import path from 'path';
import { config } from '../config/config';

export class ImageProcessor {
  private image: sharp.Sharp;
  private originalPath: string;
  private outputPath: string;

  private sharpenSettings: Map<string, SharpenOptions> = new Map([
    ['mild', { sigma: 0.8, m1: 1.0, m2: 1.5, x1: 2.0, y2: 10, y3: 20 }],
    ['medium', { sigma: 1.5, m1: 2.0, m2: 4.0, x1: 1.5, y2: 15, y3: 30 }],
    ['strong', { sigma: 2.5, m1: 3.0, m2: 6.0, x1: 1.0, y2: 20, y3: 40 }],
    ['aldente', { sigma: 1.5, m1: 1.5, m2: 4.0, x1: 1.2, y2: 15, y3: 30 }]
  ]);
  /**
   * Inicjalizuje przetwarzanie obrazu na podstawie ścieżki wejściowej.
   * @param originalFilePath - Ścieżka do oryginalnego pliku.
   */
  constructor(originalFilePath: string) {
    this.originalPath = originalFilePath;
    this.image = sharp(originalFilePath);
    // Domyślnie ustawiamy outputPath na plik o nazwie utworzonej na podstawie bieżącej daty
    this.outputPath = path.join(path.dirname(originalFilePath), getCurrentDateFileName());
  }

  /**
   * Poprawia kontrast i jasność obrazu.
   * @param contrast - Współczynnik kontrastu (np. 1.2)
   * @param brightness - Dodatek do jasności (np. 10)
   */
  improveContrast(contrast: number, brightness: number): this {
    this.image = this.image.linear(contrast, brightness);
    return this;
  }

  /**
   * Wyostrza obraz.
   */
  sharpen(options?: SharpenOptions): this {
    this.image = this.image.sharpen(options);
    return this;
  }

  sharpenDefaultSettings(setting: 'mild' | 'medium' | 'strong' | 'aldente'): this {
    const options = this.sharpenSettings.get(setting);
    if (options) {
      this.image = this.image.sharpen(options);
    }
    return this;
  }
  /**
   * Zmniejsza rozmiar obrazu do określonego maksimum (szerokość lub wysokość),
   * przy zachowaniu proporcji (fit: "inside").
   * @param maxDimension - Maksymalna szerokość/wysokość obrazu.
   */
  resize(maxDimension: number = config.maxDimension): this {
    this.image = this.image.resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
    });
    return this;
  }

  
  /**
   * Redukuje szumy obrazu przy użyciu filtra medianowego.
   * @param medianSize - Rozmiar filtra medianowego (np. 3).
   */
  reduceNoise(medianSize: number): this {
    this.image = this.image.median(medianSize);
    return this;
  }

  /**
   * Binarizuje obraz według zadanego progu.
   * @param threshold - Wartość progu (np. 128).
   */
  binarize(threshold: number): this {
    this.image = this.image.threshold(threshold);
    return this;
  }
  
  /**
   * Umożliwia ręczną zmianę nazwy pliku wyjściowego.
   * @param newName - Nowa nazwa pliku (np. "nowy_plik.jpg").
   */
  rename(newName: string): this {
    const outputDir = path.dirname(this.originalPath);
    this.outputPath = path.join(outputDir, newName);
    return this;
  }

  renameToCurrentDate(): this {
    this.outputPath = path.join(path.dirname(this.originalPath), getCurrentDateFileName());
    return this;
  }
  /**
   * Zapisuje przetworzony obraz do pliku.
   * @param removeOriginal - Jeśli true, usuwa oryginalny plik.
   * @returns Ścieżka do zapisanego pliku.
   */
  async save(removeOriginal: boolean = false): Promise<string> {
    try {
      await this.image.toFile(this.outputPath);
      if (removeOriginal) {
        fs.unlinkSync(this.originalPath);
      }
      console.log(`Przetworzony obraz zapisany w: ${this.outputPath}`);
      return this.outputPath;
    } catch (error) {
      console.error("Błąd podczas przetwarzania obrazu:", error);
      throw error;
    }
  }
}

/**
 * Generuje nazwę pliku na podstawie bieżącej daty i czasu.
 * Format: YYYY-MM-DD_HH-mm-ss.jpg
 * @returns Wygenerowana nazwa pliku.
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
