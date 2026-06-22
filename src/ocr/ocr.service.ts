// src/ocr/ocr.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImageAnnotatorClient } from '@google-cloud/vision';

export interface ParsedReceiptItem {
  name: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
}

export interface ParsedReceiptData {
  rawOcrText: string;
  vendorName?: string;
  totalAmount?: number;
  currency?: string;
  purchaseDate?: Date;
  items: ParsedReceiptItem[];
  confidence: number;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private client: ImageAnnotatorClient;

  constructor(private configService: ConfigService) {
    this.client = new ImageAnnotatorClient({
      keyFilename: this.configService.get<string>(
        'GOOGLE_APPLICATION_CREDENTIALS',
      ),
    });
  }

  async extractFromImageUrl(imageUrl: string): Promise<ParsedReceiptData> {
    const [result] = await this.client.textDetection(imageUrl);
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      throw new Error('No text detected in image');
    }

    // detections[0] contains the FULL block of text Vision found
    const rawText = detections[0].description ?? '';

    return this.parseReceiptText(rawText);
  }

  private parseReceiptText(rawText: string): ParsedReceiptData {
    const lines = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return {
      rawOcrText: rawText,
      vendorName: this.extractVendorName(lines),
      totalAmount: this.extractTotalAmount(lines),
      currency: this.extractCurrency(rawText),
      purchaseDate: this.extractDate(lines),
      items: this.extractItems(lines),
      confidence: this.estimateConfidence(lines),
    };
  }

  private extractVendorName(lines: string[]): string | undefined {
    // Heuristic: vendor name is usually the first non-empty line,
    // and it's rarely a number-heavy line (which would suggest an address or phone)
    for (const line of lines.slice(0, 3)) {
      const digitCount = (line.match(/\d/g) || []).length;
      if (digitCount < line.length * 0.3) {
        return line;
      }
    }
    return lines[0];
  }

  private extractTotalAmount(lines: string[]): number | undefined {
    // Look for lines containing "total" (case-insensitive),
    // skip "subtotal" to avoid grabbing the wrong figure
    const totalKeywords = ['total', 'amount due', 'grand total'];

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      const isTotalLine = totalKeywords.some((kw) => lowerLine.includes(kw));
      const isSubtotal = lowerLine.includes('subtotal');

      if (isTotalLine && !isSubtotal) {
        const match = line.match(/(\d+[.,]\d{2})/);
        if (match) {
          return parseFloat(match[1].replace(',', '.'));
        }
      }
    }
    return undefined;
  }

  private extractCurrency(rawText: string): string | undefined {
    const currencyMap: Record<string, string> = {
      $: 'USD',
      '€': 'EUR',
      '£': 'GBP',
      '₦': 'NGN',
      SAR: 'SAR',
      'ر.س': 'SAR',
      KWD: 'KWD',
    };

    for (const [symbol, code] of Object.entries(currencyMap)) {
      if (rawText.includes(symbol)) {
        return code;
      }
    }
    return undefined;
  }

  private extractDate(lines: string[]): Date | undefined {
    // Matches common formats: DD/MM/YYYY, MM-DD-YYYY, YYYY-MM-DD
    const datePattern = /(\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4})/;

    for (const line of lines) {
      const match = line.match(datePattern);
      if (match) {
        const parsed = new Date(match[1]);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }
    return undefined;
  }

  private extractItems(lines: string[]): ParsedReceiptItem[] {
    // Heuristic: item lines usually end with a price (X.XX format)
    // and aren't total/subtotal/tax lines
    const items: ParsedReceiptItem[] = [];
    const excludeKeywords = [
      'total',
      'subtotal',
      'tax',
      'change',
      'cash',
      'card',
    ];

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (excludeKeywords.some((kw) => lowerLine.includes(kw))) {
        continue;
      }

      const priceMatch = line.match(/(\d+[.,]\d{2})\s*$/);
      if (priceMatch) {
        const totalPrice = parseFloat(priceMatch[1].replace(',', '.'));
        const name = line.slice(0, priceMatch.index).trim();

        if (name.length > 0) {
          items.push({ name, totalPrice });
        }
      }
    }

    return items;
  }

  private estimateConfidence(lines: string[]): number {
    // Simple heuristic: more structured data found = higher confidence
    // This is NOT Vision's actual confidence score — Vision's text detection
    // doesn't return one for full-text mode. This is our own sanity signal.
    let score = 0.5;
    if (lines.length > 5) score += 0.2;
    if (lines.length > 10) score += 0.1;
    return Math.min(score, 0.9);
  }
}
