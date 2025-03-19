import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { ReceiptRecord, ReceiptStatus } from '../types';

export class DatabaseService {
  private static instance: DatabaseService;
  private db: Database | null = null;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.db) return;

    const dbPath = path.join(__dirname, '../../data.db');
    this.db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    await this.createTables();
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        purchase_type TEXT NOT NULL,
        comments TEXT,
        timestamp TEXT NOT NULL,
        store_name TEXT,
        total_amount REAL,
        input_tokens INTEGER,
        output_tokens INTEGER,
        total_tokens INTEGER,
        status TEXT NOT NULL DEFAULT 'RECEIVED',
        status_history TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_id INTEGER,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        FOREIGN KEY (receipt_id) REFERENCES receipts(id)
      );
    `);
  }

  public async updateReceiptStatus(receiptId: number, status: ReceiptStatus, details?: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const receipt = await this.db.get('SELECT status_history FROM receipts WHERE id = ?', receiptId);
    if (!receipt) throw new Error('Receipt not found');

    const statusHistory = JSON.parse(receipt.status_history);
    statusHistory.push({
      status,
      timestamp: new Date().toISOString(),
      details
    });

    await this.db.run(
      `UPDATE receipts SET 
        status = ?,
        status_history = ?
      WHERE id = ?`,
      [status, JSON.stringify(statusHistory), receiptId]
    );
  }

  public async createRecord(record: ReceiptRecord): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.run(
      `INSERT INTO receipts (
        file_path, purchase_type, comments, timestamp, store_name,
        total_amount, input_tokens, output_tokens, total_tokens,
        status, status_history
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.filePath,
        record.purchaseType,
        record.comments,
        record.timestamp,
        record.storeName,
        record.totalAmount,
        record.gptTokens.input_tokens,
        record.gptTokens.output_tokens,
        record.gptTokens.total_tokens,
        record.status || ReceiptStatus.RECEIVED,
        JSON.stringify(record.statusHistory || [])
      ]
    );

    const receiptId = result.lastID;
    if (!receiptId) throw new Error('Failed to insert receipt');

    return receiptId;
  }

  public async updateRecord(receiptId: number, record: ReceiptRecord): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Update receipt details
    await this.db.run(
      `UPDATE receipts SET
        store_name = ?,
        total_amount = ?,
        input_tokens = ?,
        output_tokens = ?,
        total_tokens = ?,
        status = ?,
        status_history = ?
      WHERE id = ?`,
      [
        record.storeName,
        record.totalAmount,
        record.gptTokens.input_tokens,
        record.gptTokens.output_tokens,
        record.gptTokens.total_tokens,
        record.status,
        JSON.stringify(record.statusHistory),
        receiptId
      ]
    );

    // Delete existing products
    await this.db.run('DELETE FROM products WHERE receipt_id = ?', receiptId);

    // Insert new products
    for (const product of record.products) {
      await this.db.run(
        `INSERT INTO products (receipt_id, name, price, category)
         VALUES (?, ?, ?, ?)`,
        [receiptId, product.name, product.price, product.category]
      );
    }
  }

  public async loadRecords(): Promise<ReceiptRecord[]> {
    if (!this.db) throw new Error('Database not initialized');

    const receipts = await this.db.all('SELECT * FROM receipts ORDER BY timestamp DESC');
    const records: ReceiptRecord[] = [];

    for (const receipt of receipts) {
      const products = await this.db.all(
        'SELECT * FROM products WHERE receipt_id = ?',
        receipt.id
      );

      records.push({
        filePath: receipt.file_path,
        purchaseType: receipt.purchase_type,
        comments: receipt.comments,
        timestamp: receipt.timestamp,
        storeName: receipt.store_name,
        totalAmount: receipt.total_amount,
        products: products.map(p => ({
          name: p.name,
          price: p.price,
          category: p.category
        })),
        gptTokens: {
          input_tokens: receipt.input_tokens,
          output_tokens: receipt.output_tokens,
          total_tokens: receipt.total_tokens
        },
        status: receipt.status as ReceiptStatus,
        statusHistory: JSON.parse(receipt.status_history)
      });
    }

    return records;
  }

  public async cleanupOldRecords(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24);
    const cutoffTimestamp = cutoffDate.toISOString();

    // Get IDs of old receipts
    const oldReceipts = await this.db.all(
      'SELECT id FROM receipts WHERE timestamp < ?',
      cutoffTimestamp
    );

    // Delete products first (due to foreign key constraint)
    for (const receipt of oldReceipts) {
      await this.db.run('DELETE FROM products WHERE receipt_id = ?', receipt.id);
    }

    // Delete old receipts
    await this.db.run('DELETE FROM receipts WHERE timestamp < ?', cutoffTimestamp);
  }
  
  public async getRecordById(receiptId: number): Promise<ReceiptRecord | null> {
    if (!this.db) throw new Error('Database not initialized');

    const receipt = await this.db.get(
      'SELECT * FROM receipts WHERE id = ?',
      receiptId
    );

    if (!receipt) return null;

    const products = await this.db.all(
      'SELECT * FROM products WHERE receipt_id = ?', 
      receiptId
    );

    return {
      filePath: receipt.file_path,
      purchaseType: receipt.purchase_type,
      comments: receipt.comments,
      timestamp: receipt.timestamp,
      storeName: receipt.store_name,
      totalAmount: receipt.total_amount,
      products: products.map(p => ({
        name: p.name,
        price: p.price,
        category: p.category
      })),
      gptTokens: {
        input_tokens: receipt.input_tokens,
        output_tokens: receipt.output_tokens,
        total_tokens: receipt.total_tokens
      },
      status: receipt.status as ReceiptStatus,
      statusHistory: JSON.parse(receipt.status_history)
    };
  }
} 