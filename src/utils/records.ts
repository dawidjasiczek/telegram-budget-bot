import { ReceiptRecord, ReceiptStatus } from '../types';
import { DatabaseService } from '../services/DatabaseService';

const db = DatabaseService.getInstance();

/**
 * Loads records from the database.
 * @returns {ReceiptRecord[]} - Array of records.
 */
export async function loadRecords(): Promise<ReceiptRecord[]> {
  try {
    await db.initialize();
    return await db.loadRecords();
  } catch (err) {
    console.error('Error while reading data:', err);
    return [];
  }
}

/**
 * Creates a new record in the database.
 * @param {ReceiptRecord} record - Record to create.
 * @returns {Promise<number>} - ID of the created record.
 */
export async function createRecord(record: ReceiptRecord): Promise<number> {
  try {
    await db.initialize();
    return await db.createRecord(record);
  } catch (err) {
    console.error('Error while creating record:', err);
    throw err;
  }
}

/**
 * Updates an existing record in the database.
 * @param {number} receiptId - ID of the record to update.
 * @param {ReceiptRecord} record - Updated record data.
 */
export async function updateRecord(receiptId: number, record: ReceiptRecord): Promise<void> {
  try {
    await db.initialize();
    await db.updateRecord(receiptId, record);
  } catch (err) {
    console.error('Error while updating record:', err);
    throw err;
  }
}

/**
 * Deletes records older than 24 hours.
 */
export async function cleanupOldRecords(): Promise<void> {
  try {
    await db.initialize();
    await db.cleanupOldRecords();
  } catch (err) {
    console.error('Error while cleaning up old records:', err);
  }
} 

/**
 * Retrieves a record from the database based on ID.
 * @param {number} receiptId - ID of the record to retrieve.
 * @returns {Promise<ReceiptRecord | null>} - Retrieved record or null if not found.
 */
export async function getRecordById(receiptId: number): Promise<ReceiptRecord | null> {
  try {
    await db.initialize();
    return await db.getRecordById(receiptId);
  } catch (err) {
    console.error('Error while retrieving record:', err);
    return null;
  }
}

/**
 * Updates the status of a receipt and adds it to the status history.
 * @param {number} receiptId - ID of the receipt to update.
 * @param {ReceiptStatus} status - New status to set.
 * @param {string} [details] - Optional details about the status change.
 */
export async function updateReceiptStatus(
  receiptId: number,
  status: ReceiptStatus,
  details?: string
): Promise<void> {
  try {
    await db.initialize();
    await db.updateReceiptStatus(receiptId, status, details);
  } catch (err) {
    console.error('Error while updating receipt status:', err);
    throw err;
  }
}

