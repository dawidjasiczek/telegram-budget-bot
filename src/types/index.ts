import { Message } from 'node-telegram-bot-api';

export interface ReceiptProduct {
  name: string;
  price: number;
  category: string;
}

export interface ReceiptAnalysis {
  store_name: string;
  products: ReceiptProduct[];
  total_amount: number;
}

export interface GPTTokens {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export enum ReceiptStatus {
  RECEIVED = 'RECEIVED',
  PROCESSING = 'PROCESSING',
  ANALYZED = 'ANALYZED_AI',
  CATEGORIZED = 'CATEGORIZED',
  SAVED_TO_SHEETS = 'SAVED_TO_SHEETS',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface ReceiptRecord {
  filePath: string;
  purchaseType: 'solo' | 'shared';
  comments: string;
  timestamp: string;
  storeName: string | null;
  products: ReceiptProduct[];
  totalAmount: number;
  gptTokens: GPTTokens;
  status: ReceiptStatus;
  statusHistory: {
    status: ReceiptStatus;
    timestamp: string;
    details?: string;
  }[];
}

export interface OpenAIResponse {
  data: ReceiptAnalysis;
  usage: GPTTokens;
}

export interface AnalyzeReceiptParams {
  imageBase64: string;
  userComment: string;
  categories?: string;
} 

export interface AiProcessReceiptResponse {
  storeName: string;
  products: ReceiptProduct[];
  totalAmount: number;
  gptTokens: GPTTokens;
}
