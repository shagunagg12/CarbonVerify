import { createWorker } from 'tesseract.js';
import fs from 'fs';

interface ExtractedFieldResult<T> {
  value: T | null;
  confidence: number;
  box: { x0: number; y0: number; x1: number; y1: number } | null;
}

export interface OCRResult {
  weight: ExtractedFieldResult<number>;
  vehicleNum: ExtractedFieldResult<string>;
  date: ExtractedFieldResult<string>;
  driverName: ExtractedFieldResult<string>;
  fullText: string;
}

export async function processOCR(filePath: string): Promise<OCRResult> {
  // Use Tesseract to extract text and bounding boxes
  const worker = await createWorker('eng');
  
  try {
    const { data } = await worker.recognize(filePath);
    const fullText = data.text;
    const words = data.words;
    
    // Fallback: If image width/height are zero, default them
    const width = (data as any).width || 1000;
    const height = (data as any).height || 1000;

    // Helper: convert absolute bbox to percentage bbox
    const getPercentageBox = (wBox: any) => {
      if (!wBox) return null;
      return {
        x0: Math.max(0, Math.min(100, (wBox.x0 / width) * 100)),
        y0: Math.max(0, Math.min(100, (wBox.y0 / height) * 100)),
        x1: Math.max(0, Math.min(100, (wBox.x1 / width) * 100)),
        y1: Math.max(0, Math.min(100, (wBox.y1 / height) * 100)),
      };
    };

    // Helper: find words matching a substring/pattern in fullText and calculate confidence + bbox
    const extractField = (
      regex: RegExp, 
      converter: (val: string) => any = (val) => val
    ): ExtractedFieldResult<any> => {
      const match = fullText.match(regex);
      if (!match) {
        return { value: null, confidence: 0, box: null };
      }

      // Extract the target value from capture group if available, otherwise full match
      const matchedString = match[1] ? match[1].trim() : match[0].trim();
      const value = converter(matchedString);

      // Find words in Tesseract words array that overlap with the match
      // We do a simple character position search
      const matchIndex = fullText.indexOf(match[0]);
      if (matchIndex === -1) {
        return { value, confidence: 50, box: null }; // Default medium confidence
      }

      // Map back to data.words based on character indices
      let charCounter = 0;
      const matchedWords: typeof data.words = [];

      for (const word of words) {
        // Tesseract doesn't give exact char index for words, but we can reconstruct index
        // by tracking positions. Let's find words whose text is a substring of the match or close.
        const wordTextClean = word.text.replace(/[^a-zA-Z0-9\.\:\-]/g, '').toLowerCase();
        const matchClean = match[0].replace(/[^a-zA-Z0-9\.\:\-]/g, '').toLowerCase();

        if (wordTextClean && matchClean.includes(wordTextClean)) {
          matchedWords.push(word);
        }
      }

      if (matchedWords.length === 0) {
        return { value, confidence: 70, box: null };
      }

      // Compute average confidence
      const avgConfidence = matchedWords.reduce((acc, curr) => acc + curr.confidence, 0) / matchedWords.length;

      // Compute bounding box containing all matched words
      const x0 = Math.min(...matchedWords.map(w => w.bbox.x0));
      const y0 = Math.min(...matchedWords.map(w => w.bbox.y0));
      const x1 = Math.max(...matchedWords.map(w => w.bbox.x1));
      const y1 = Math.max(...matchedWords.map(w => w.bbox.y1));

      return {
        value,
        confidence: Math.round(avgConfidence),
        box: getPercentageBox({ x0, y0, x1, y1 }),
      };
    };

    // 1. Weight regex: looks for numbers like "12.5 tonnes", "15t", "gross: 24.5"
    // E.g. "Weight: 14.5 t", "Net: 12.3", "12.5 T"
    const weightResult = extractField(
      /(?:weight|net|gross|tare|wt|qty)[\s\:\-]+(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:tonnes|tonne|tons|ton|t|kg|kgs)/i,
      (v) => parseFloat(v)
    );

    // 2. Vehicle Number: e.g. GJ01AB1234, GJ-01-AB-1234, MH 12 PQ 9999
    // Standard plates: 2 letters, 2 digits, 1 or 2 letters, 4 digits
    const vehicleResult = extractField(
      /([A-Z]{2}[-\s]?\d{2}[-\s]?[A-Z]{1,2}[-\s]?\d{4})/i,
      (v) => v.toUpperCase().replace(/[\s-]/g, '')
    );

    // 3. Date: DD/MM/YYYY or YYYY-MM-DD or DD-MM-YYYY
    const dateResult = extractField(
      /(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})|(\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2})/
    );

    // 4. Driver Name: e.g. Driver: John Doe, Operator: Bob Smith
    const driverResult = extractField(
      /(?:driver|operator|driver\s*name)[\s\:\-]+([A-Za-z\s]{3,20})/i,
      (v) => v.trim()
    );

    // Return structured OCR result
    return {
      weight: weightResult.value ? weightResult : { value: null, confidence: 0, box: null },
      vehicleNum: vehicleResult.value ? vehicleResult : { value: null, confidence: 0, box: null },
      date: dateResult.value ? dateResult : { value: null, confidence: 0, box: null },
      driverName: driverResult.value ? driverResult : { value: null, confidence: 0, box: null },
      fullText,
    };

  } finally {
    await worker.terminate();
  }
}
