import { google, sheets_v4 } from "googleapis";
import { TranslationService } from "./TranslationService";
import { config } from "../config/config";

interface ProductRecord {
  storeName: string;
  productName: string;
  price: number;
  category: string;
  isShared: boolean;
}

export class GoogleSheetsClient {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;
  // Private variable with month names
  private monthNames: string[] = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  /**
   * @param credentialsPath - Path to the JSON file containing service account credentials
   * @param spreadsheetId - Google Sheets spreadsheet ID
   */
  constructor(private credentialsPath: string, spreadsheetId: string, translationService: TranslationService) {
    this.spreadsheetId = spreadsheetId;

    const auth = new google.auth.GoogleAuth({
      keyFile: this.credentialsPath,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    this.sheets = google.sheets({ version: "v4", auth });

    this.monthNames = translationService.translate('months').split(', ');
  }

  /**
   * Adds a new row with data to the sheet named after the current month
   * @param rowData - Array of data (can be numbers and text)
   */
  async appendRow(rowData: (string | number)[]): Promise<void> {
    const monthIndex = new Date().getMonth();
    const currentMonth = this.monthNames[monthIndex];
    const range = `${currentMonth}!A:A`;

    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueInputOption: "RAW",
        requestBody: {
          values: [rowData],
        },
      });
      console.log(`Row has been added to sheet: ${currentMonth}`);
    } catch (error) {
      console.error("Error while adding row:", error);
    }
  }

  private async getSheetIdByTitle(sheetTitle: string): Promise<number | null> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      const sheetsInfo = response.data.sheets || [];
      for (const sheet of sheetsInfo) {
        if (sheet.properties?.title === sheetTitle) {
          return sheet.properties.sheetId || null;
        }
      }
      return null;
    } catch (error) {
      console.error('Error while getting sheet information:', error);
      return null;
    }
  }

  async appendRecord(record: ProductRecord): Promise<void> {
    const monthIndex = new Date().getMonth();
    const sheetName = this.monthNames[monthIndex];

    // Apply common expense percentage if the purchase type is 'shared'
    const finalPrice = record.isShared 
      ? record.price * config.commonExpensePercentage 
      : record.price;

    
    const rowData = [
      new Date().toISOString().split('T')[0],
      record.storeName || '',
      record.productName || '',
      finalPrice || 0,
      record.category || '',
      record.isShared.toString(),
    ];

    try {
      const sheetId = await this.getSheetIdByTitle(sheetName);
      if (sheetId === null) {
        console.error(`Sheet not found: "${sheetName}"`);
        return;
      }

      const requests: sheets_v4.Schema$Request[] = [
        {
          appendCells: {
            sheetId: sheetId,
            rows: [
              {
                values: rowData.map((value, index) => ({
                  userEnteredValue: typeof value === 'number' ? { numberValue: value } : { stringValue: value },
                  userEnteredFormat: index === 3 ? {
                    numberFormat: {
                      type: 'CURRENCY',
                      pattern: '#,##0.00 zł'
                    }
                  } : undefined
                }))
              }
            ],
            fields: '*',
          },
        },
      ];

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { requests },
      });

      console.log('Record has been successfully added and formatted.');
    } catch (error) {
      console.error('Error while adding record:', error);
    }
  }

  /**
   * Checks if all sheets corresponding to months exist in the spreadsheet.
   * If any sheet is missing, the method creates it.
   */
  async ensureMonthlySheetsExist(): Promise<void> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      const existingSheets = response.data.sheets || [];
      const existingSheetTitles = existingSheets.map(sheet => sheet.properties?.title);

      const missingSheets = this.monthNames.filter(month => !existingSheetTitles.includes(month));

      if (missingSheets.length === 0) {
        console.log("All monthly sheets already exist.");
        return;
      }

      const requests = missingSheets.map(month => ({
        addSheet: {
          properties: {
            title: month,
          },
        },
      }));

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: requests,
        },
      });
      console.log("Created missing sheets:", missingSheets);
    } catch (error) {
      console.error("Error while checking/creating monthly sheets:", error);
    }
  }

  /**
   * Sets headers for each sheet corresponding to months in range A1:F1:
   * Date, Store, Name, Price, Category, Purchase Type.
   * If the sheet doesn't exist, it will be created by ensureMonthlySheetsExist first.
   */
  async ensureHeadersForAllSheets(): Promise<void> {
    await this.ensureMonthlySheetsExist();

    const headerRow = ["Date", "Store", "Name", "Price", "Category", "Purchase Type"];

    for (const month of this.monthNames) {
      try {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${month}!A1:F1`,
          valueInputOption: "RAW",
          requestBody: {
            values: [headerRow],
          },
        });
        console.log(`Headers set for sheet: ${month}`);
      } catch (error) {
        console.error(`Error while setting headers for sheet ${month}:`, error);
      }
    }
  }
}
