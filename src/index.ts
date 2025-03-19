import { config as dotenvConfig } from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { waitForAnswer } from './utils/waitForAnswer';
import { createRecord, updateRecord, cleanupOldRecords, getRecordById, updateReceiptStatus } from './utils/records';
import { OpenAIClient } from './services/OpenAIClient';
import { processAndRenameImage } from './utils/imageUtils';
import { config, findCategory, getHumanReadableCategoryList } from './config/config';
import { AiProcessReceiptResponse, GPTTokens, ReceiptProduct, ReceiptRecord, ReceiptStatus } from './types';
import { GoogleSheetsClient } from './services/GoogleService';
import { TranslationService, Language } from './services/TranslationService';

dotenvConfig();

// Initialize translation service
const translationService = TranslationService.getInstance();

translationService.setLanguage(config.language as Language);

// Initialize Google Sheets client
const credentialsPath = path.join(__dirname, '../google-credentials.json');
const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
if (!spreadsheetId) {
  throw new Error('GOOGLE_SHEETS_ID is not defined in environment variables');
}
const sheetsClient = new GoogleSheetsClient(credentialsPath, spreadsheetId, translationService);
sheetsClient.ensureHeadersForAllSheets();

// Initialize Telegram bot
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is not defined in environment variables');
}
const bot = new TelegramBot(token, { polling: true });

// Clean up old records every hour
setInterval(() => {
  cleanupOldRecords().catch(err => console.error('Error cleaning up old records:', err));
}, 60 * 60 * 1000);

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const photoArray = msg.photo;
  if (!photoArray || photoArray.length === 0) {
    bot.sendMessage(chatId, translationService.translate('bot.photoDownloadError'));
    return;
  }
  const fileId = photoArray[photoArray.length - 1].file_id;

  const filePath = await handleImageProcessing(bot, chatId, fileId);
  if (!filePath) return;

  // Create initial record with just the file path
  const initialRecord: ReceiptRecord = {
    filePath,
    purchaseType: 'solo', // Default value, will be updated
    comments: '',
    timestamp: new Date().toISOString(),
    storeName: '',
    totalAmount: 0,
    products: [],
    gptTokens: {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0
    },
    status: ReceiptStatus.RECEIVED,
    statusHistory: [{
      status: ReceiptStatus.RECEIVED,
      timestamp: new Date().toISOString(),
      details: 'Receipt photo received'
    }]
  };

  // Save initial record to DB and get its ID
  const receiptId = await createRecord(initialRecord);

  // Get purchase type and update record
  const purchaseType = await handlePurchaseTypeQuestion(bot, chatId);
  await updateReceiptStatus(receiptId, ReceiptStatus.PROCESSING, 'Processing purchase type');

  if (purchaseType === 'manual') {
    await handleManualRecipe(bot, chatId, receiptId);
    return;
  }

  initialRecord.purchaseType = purchaseType;
  await updateRecord(receiptId, initialRecord);

  // Get comments and update record
  const comments = await handleCommentsQuestion(bot, chatId);
  initialRecord.comments = comments;
  await updateRecord(receiptId, initialRecord);

  // Process with OpenAI and update final details
  await updateReceiptStatus(receiptId, ReceiptStatus.PROCESSING, 'Starting AI analysis');
  // const aiResponse = await processReceiptWithOpenAI(bot, chatId, receiptId);
  const aiResponse = {
    storeName: 'CH Posnania',
    totalAmount: 234.98,
    products: [
      { name: 'Kolekcja Podstawowa', price: 69.99, category: 'Clothing' },
      { name: 'Spodnie', price: 164.99, category: 'Clothing' }
    ],
    gptTokens: { input_tokens: 1207, output_tokens: 59, total_tokens: 1266 }
  }

  initialRecord.storeName = aiResponse?.storeName || '';
  initialRecord.products = aiResponse?.products || [];
  initialRecord.totalAmount = aiResponse?.totalAmount || 0;
  initialRecord.gptTokens = aiResponse?.gptTokens || {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0
  };
  await updateRecord(receiptId, initialRecord);
  await updateReceiptStatus(receiptId, ReceiptStatus.ANALYZED, 'AI analysis completed');

  // Append receipt data to Google Sheets
  try {
    await updateReceiptStatus(receiptId, ReceiptStatus.PROCESSING, 'Saving to Google Sheets');
    await appendReceiptToGoogleSheets(initialRecord);
    await updateReceiptStatus(receiptId, ReceiptStatus.SAVED_TO_SHEETS, 'Data saved to Google Sheets');
    bot.sendMessage(chatId, translationService.translate('bot.sheetsSuccess'));
  } catch (error: any) {
    console.error('Error saving data to Google Sheets:', error);
    await updateReceiptStatus(receiptId, ReceiptStatus.ERROR, 'Failed to save to Google Sheets: ' + (error.message || 'Unknown error'));
    bot.sendMessage(chatId, translationService.translate('bot.sheetsError'));
    return;
  }

  await updateReceiptStatus(receiptId, ReceiptStatus.COMPLETED, 'Receipt processing completed successfully');
  const finalRecord = await getRecordById(receiptId);
  console.log('Final record:', finalRecord);
});

/**
 * Handles the image processing workflow for a receipt photo
 * @param bot - Telegram bot instance
 * @param chatId - ID of the chat where the photo was sent
 * @param fileId - ID of the file to process
 * @returns Promise resolving to the processed file path or null if processing failed
 */
async function handleImageProcessing(bot: TelegramBot, chatId: number, fileId: string): Promise<string | null> {
  const downloadDir = path.join(__dirname, "downloads");
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
  }

  try {
    const downloadedFilePath = await bot.downloadFile(fileId, downloadDir);
    const filePath = await processAndRenameImage(downloadedFilePath, true);
    bot.sendMessage(chatId, translationService.translate('bot.photoSaved'));
    console.log('Image saved and processed:', filePath);
    return filePath;
  } catch (err) {
    console.error('Error processing image:', err);
    bot.sendMessage(chatId, translationService.translate('bot.photoError'));
    return null;
  }
}

/**
 * Handles the purchase type question workflow
 * @param bot - Telegram bot instance
 * @param chatId - ID of the chat where the question should be sent
 * @returns Promise resolving to the selected purchase type
 */
async function handlePurchaseTypeQuestion(bot: TelegramBot, chatId: number): Promise<'solo' | 'shared' | 'manual'> {
  bot.sendMessage(chatId, translationService.translate('bot.purchaseTypeQuestion'));
  const answer = await waitForAnswer(bot, chatId, (m) => !!m.text, 120000);

  if (answer && answer.text) {
    const text = answer.text.toLowerCase();
    if (config.manualCommands.some((keyword: string) => text.includes(keyword))) {
      return 'manual';
    }
    
    if (config.commonKeywords.some((keyword: string) => text.includes(keyword))) {
      await bot.sendMessage(chatId, translationService.translate('bot.purchaseTypeSelected', { type: 'shared' }));
      return 'shared';
    } else if (config.soloKeywords.some((keyword: string) => text.includes(keyword))) {
      await bot.sendMessage(chatId, translationService.translate('bot.purchaseTypeSelected', { type: 'solo' }));
      return 'solo';
    }
  }
  
  await bot.sendMessage(chatId, translationService.translate('bot.purchaseTypeSelected', { type: 'solo' }));
  return 'solo';
}

/**
 * Handles the comments question workflow
 * @param bot - Telegram bot instance
 * @param chatId - ID of the chat where the question should be sent
 * @returns Promise resolving to the user's comments
 */
async function handleCommentsQuestion(bot: TelegramBot, chatId: number): Promise<string> {
  await bot.sendMessage(chatId, translationService.translate('bot.commentsQuestion'));
  const answer = await waitForAnswer(bot, chatId, (m) => !!m.text, 120000);
  const comments = answer?.text || '';
  bot.sendMessage(chatId, translationService.translate('bot.commentsAdded', { 
    comments: comments ? comments : translationService.translate('bot.noComments') 
  }));
  return comments;
}

/**
 * Processes a receipt using OpenAI's API
 * @param bot - Telegram bot instance
 * @param chatId - ID of the chat where updates should be sent
 * @param receiptId - ID of the receipt record to process
 * @returns Promise resolving to the AI processing response or null if processing failed
 */
async function processReceiptWithOpenAI(bot: TelegramBot, chatId: number, receiptId: number): Promise<AiProcessReceiptResponse | null> {
  const openaiClient = new OpenAIClient();
  const record = await getRecordById(receiptId);
  if (!record) {
    bot.sendMessage(chatId, translationService.translate('bot.recordError'));
    return null;
  }
  
  try {
    const imageBase64 = fs.readFileSync(record.filePath, { encoding: "base64" });
    const userComment = (!record.comments || config.noKeywords.some((keyword: string) => record.comments.toLowerCase().includes(keyword))) ? '' : record.comments;
    const categories = config.categories.map(cat => `${cat.name} (${cat.description})`).join(', ');

    const openaiResponse = await openaiClient.analyzeReceipt({
      imageBase64,
      userComment,
      categories,
    });

    bot.sendMessage(chatId, translationService.translate('bot.analysisComplete'));
    record.gptTokens = openaiResponse.usage;
    record.storeName = openaiResponse.data.store_name;
    record.products = openaiResponse.data.products;
    record.totalAmount = openaiResponse.data.total_amount;

    // Update record with analysis results
    await updateRecord(receiptId, record);

  } catch (error) {
    console.error('Error analyzing receipt:', error);
    bot.sendMessage(chatId, translationService.translate('bot.analysisError'));
    return null;
  }
  
  const productsList = record.products.map(product => 
    `- ${product.name}: ${product.price.toFixed(2)} PLN (${product.category})`
  ).join('\n');

  const inputCost = (record.gptTokens.input_tokens / 1000000) * config.tokenCosts.inputCostPerMillion * config.tokenCosts.usdToPlnRate;
  const outputCost = (record.gptTokens.output_tokens / 1000000) * config.tokenCosts.outputCostPerMillion * config.tokenCosts.usdToPlnRate;
  const totalCost = inputCost + outputCost;

  const message = translationService.translate('bot.receiptSummary', {
    store: record.storeName,
    total: record.totalAmount.toFixed(2),
    products: productsList,
    inputTokens: record.gptTokens.input_tokens,
    outputTokens: record.gptTokens.output_tokens,
    totalTokens: record.gptTokens.total_tokens,
    inputCost: inputCost.toFixed(4),
    outputCost: outputCost.toFixed(4),
    totalCost: totalCost.toFixed(4)
  });

  bot.sendMessage(chatId, message);
  return {
    storeName: record.storeName,
    products: record.products,
    totalAmount: record.totalAmount,
    gptTokens: record.gptTokens
  };
}

/**
 * Appends receipt data to Google Sheets
 * @param record - The receipt record to append
 * @returns Promise resolving when the data is appended
 */
async function appendReceiptToGoogleSheets(record: ReceiptRecord): Promise<void> {
  try {
    for (const product of record.products) {
      await sheetsClient.appendRecord({
        storeName: record.storeName || '',
        productName: product.name,
        price: product.price,
        category: product.category,
        purchaseType: record.purchaseType
      });
    }
    console.log('Successfully appended receipt data to Google Sheets');
  } catch (error) {
    console.error('Error appending receipt to Google Sheets:', error);
    throw error;
  }
}

/**
 * Handles manual recipe entry through a conversation flow
 * @param bot - Telegram bot instance
 * @param chatId - ID of the chat where the recipe was sent
 */
async function handleManualRecipe(bot: TelegramBot, chatId: number, receiptId?: number) {
  try {
    await bot.sendMessage(chatId, translationService.translate('bot.handleManualRecipe.info'));
    let receipt: ReceiptRecord;
    
    if (receiptId) {
      const existingReceipt = await getRecordById(receiptId);
      if (!existingReceipt) {
        bot.sendMessage(chatId, translationService.translate('bot.recordError'));
        return;
      }
      receipt = existingReceipt;
      await updateReceiptStatus(receiptId, ReceiptStatus.PROCESSING, 'Starting manual recipe entry');
    } else {
      // Create new receipt record if no ID provided
      receipt = {
        filePath: '',
        purchaseType: 'solo',
        comments: '',
        timestamp: new Date().toISOString(),
        storeName: '',
        totalAmount: 0,
        products: [],
        gptTokens: {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0
        },
        status: ReceiptStatus.RECEIVED,
        statusHistory: [{
          status: ReceiptStatus.RECEIVED,
          timestamp: new Date().toISOString(),
          details: 'Manual recipe entry started'
        }]
      };
      receiptId = await createRecord(receipt);
    }

    // Ask for store name
    bot.sendMessage(chatId, translationService.translate('bot.handleManualRecipe.askStore'));
    
    const storeMsg = await new Promise<TelegramBot.Message>((resolve) => {
      bot.once('message', resolve);
    });
    const storeName = storeMsg.text?.trim();
    if (!storeName) {
      throw new Error('Store name is required');
    }

    receipt.storeName = storeName;

    // Ask for purchase type
    bot.sendMessage(chatId, translationService.translate('bot.handleManualRecipe.askType', {
      commonWords: config.commonKeywords.join(', '),
      soloWords: config.soloKeywords.join(', ')
    }));

    const typeMsg = await new Promise<TelegramBot.Message>((resolve) => {
      bot.once('message', resolve);
    });
    const typeText = typeMsg.text?.toLowerCase().trim();
    if (!typeText) {
      throw new Error('Purchase type is required');
    }

    const purchaseType = config.commonKeywords.some(keyword => typeText.includes(keyword))
      ? 'shared'
      : config.soloKeywords.some(keyword => typeText.includes(keyword))
        ? 'solo'
        : 'solo';

    receipt.purchaseType = purchaseType;

    const products: Array<{name: string, price: number, category: string}> = [];
    let totalAmount = 0;

    // Ask for products until user says "stop"
    bot.sendMessage(chatId, translationService.translate('bot.handleManualRecipe.askItems', {
      categories: getHumanReadableCategoryList()
    }));

    while (true) {
      const productMsg = await new Promise<TelegramBot.Message>((resolve) => {
        bot.once('message', resolve);
      });
      
      const productText = productMsg.text?.trim();
      if (!productText || productText.toLowerCase() === 'stop') {
        break;
      }

      const [name, category, priceStr] = productText.split(',').map(part => part.trim());
      
      if (!name || !category || !priceStr) {
        bot.sendMessage(chatId, translationService.translate('bot.handleManualRecipe.invalidFormat'));
        continue;
      }

      const matchingCategory = findCategory(category);
      if (!matchingCategory) {
        bot.sendMessage(chatId, translationService.translate('bot.handleManualRecipe.invalidCategory', {
          categories: getHumanReadableCategoryList()
        }));
        continue;
      }
      const categoryToUse = matchingCategory;

      const price = parseFloat(priceStr.replace(',', '.'));
      if (isNaN(price)) {
        bot.sendMessage(chatId, translationService.translate('bot.handleManualRecipe.invalidPrice'));
        continue;
      }

      products.push({ name, price, category: categoryToUse.name });
      totalAmount += price;
    }

    if (products.length === 0) {
      bot.sendMessage(chatId, translationService.translate('bot.handleManualRecipe.itemsRequired'));
      throw new Error('At least one product is required');
    }

    receipt.products = products;
    receipt.totalAmount = totalAmount;
    await updateRecord(receiptId, receipt);
    await updateReceiptStatus(receiptId, ReceiptStatus.PROCESSING, 'Saving manual recipe to Google Sheets');
    await appendReceiptToGoogleSheets(receipt);
    await updateReceiptStatus(receiptId, ReceiptStatus.SAVED_TO_SHEETS, 'Manual recipe saved to Google Sheets');

    bot.sendMessage(chatId, translationService.translate('bot.handleManualRecipe.success', {
      count: products.length
    }));
    await updateReceiptStatus(receiptId, ReceiptStatus.COMPLETED, 'Manual recipe entry completed successfully');
  } catch (error: any) {
    console.error('Error processing manual recipe:', error);
    if (receiptId) {
      await updateReceiptStatus(receiptId, ReceiptStatus.ERROR, 'Manual recipe entry failed: ' + (error.message || 'Unknown error'));
    }
    bot.sendMessage(chatId, translationService.translate('bot.handleManualRecipe.error', {
      categories: getHumanReadableCategoryList()
    }));
  }
}

// Add handler for commands from config
const commandPattern = new RegExp(`^(${config.manualCommands.join('|')})$`, 'i');
bot.onText(commandPattern, async (msg) => {
  await handleManualRecipe(bot, msg.chat.id);
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, translationService.translate('bot.start'));
}); 

