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

  // async extractFromImageUrl(imageUrl: string): Promise<ParsedReceiptData> {
  //   const [result] = await this.client.textDetection(imageUrl);
  //   const detections = result.textAnnotations;

  //   if (!detections || detections.length === 0) {
  //     throw new Error('No text detected in image');
  //   }

  //   const rawText = detections[0].description ?? '';
  //   return this.parseReceiptText(rawText);
  // }

  // src/ocr/ocr.service.ts — add this helper and update extractFromImageUrl

  async extractFromImageUrl(imageUrl: string): Promise<ParsedReceiptData> {
    // 30 second timeout, if Vision doesn't respond, fail cleanly
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('OCR request timed out after 30 seconds')),
        30000,
      ),
    );

    const ocrPromise = this.client.textDetection(imageUrl);

    const [result] = await Promise.race([
      ocrPromise,
      timeoutPromise.then(() => {
        throw new Error('OCR timed out');
      }),
    ]);

    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      throw new Error('No text detected in image');
    }

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
    // Skip lines that are purely numbers, single chars, or common header words
    const skipPatterns =
      /^[\d\s.,:]+$|^(receipt|invoice|date|tel|address|adress)$/i;

    for (const line of lines.slice(0, 4)) {
      if (!skipPatterns.test(line) && line.length > 2) {
        return line;
      }
    }
    return lines[0];
  }

  private extractTotalAmount(lines: string[]): number | undefined {
    const totalKeywords = [
      'total',
      'amount',
      'balance',
      'grand total',
      'amount due',
    ];
    const skipKeywords = [
      'subtotal',
      'sub-total',
      'sales tax',
      'tax',
      'cash',
      'change',
    ];

    // Strategy 1: find a line with a total keyword AND a price on the same line
    for (const line of lines) {
      const lower = line.toLowerCase();
      const isTotal = totalKeywords.some((kw) => lower.includes(kw));
      const isSkip = skipKeywords.some((kw) => lower.includes(kw));

      if (isTotal && !isSkip) {
        const match = line.match(/(\d+[.,]\d{2})/);
        if (match) {
          return parseFloat(match[1].replace(',', '.'));
        }
      }
    }

    // Strategy 2: total keyword is on its OWN line, price is on the NEXT line
    // e.g. "TOTAL\n27.35" — handles multi-line format
    for (let i = 0; i < lines.length - 1; i++) {
      const lower = lines[i].toLowerCase().trim();
      const isTotal = totalKeywords.some(
        (kw) => lower === kw || lower.includes(kw),
      );
      const isSkip = skipKeywords.some((kw) => lower.includes(kw));

      if (isTotal && !isSkip) {
        // look at the next 1-2 lines for a price
        for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j++) {
          const match = lines[j].match(/^(\d+[.,]\d{2})$/);
          if (match) {
            return parseFloat(match[1].replace(',', '.'));
          }
        }
      }
    }

    // Strategy 3: largest standalone price on the receipt
    // as a last resort — usually the total is the biggest number
    const prices: number[] = [];
    for (const line of lines) {
      const match = line.match(/^(\d+[.,]\d{2})$/);
      if (match) {
        prices.push(parseFloat(match[1].replace(',', '.')));
      }
    }

    if (prices.length > 0) {
      // filter out obviously large "cash" amounts by taking second largest if gap is small
      prices.sort((a, b) => b - a);
      return prices[0];
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
    // Matches: DD/MM/YYYY, MM-DD-YYYY, YYYY-MM-DD, DD-MM-YYYY, MM/DD/YYYY
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
    const items: ParsedReceiptItem[] = [];

    const exclude = [
      'receipt',
      'address',
      'tel',
      'cash',
      'change',
      'total',
      'subtotal',
      'tax',
      'thank',
      'approval',
      'card',
      'price',
      'description',
    ];

    for (let i = 0; i < lines.length - 1; i++) {
      const current = lines[i].trim();
      const next = lines[i + 1].trim();

      const lower = current.toLowerCase();

      if (exclude.some((word) => lower.includes(word))) {
        continue;
      }

      // current line is text, next line is a number
      if (/^[a-zA-Z\s]+$/.test(current) && /^\d+(?:[.,]\d+)?$/.test(next)) {
        items.push({
          name: current,
          quantity: 1,
          unitPrice: parseFloat(next.replace(',', '.')),
          totalPrice: parseFloat(next.replace(',', '.')),
        });
      }
    }

    return items;
  }

  private estimateConfidence(lines: string[]): number {
    let score = 0.5;
    if (lines.length > 5) score += 0.2;
    if (lines.length > 10) score += 0.1;
    return Math.min(score, 0.9);
  }
}
