# Receipt Tracker Bot

A Telegram bot that helps you track and categorize your expenses by processing receipt photos. The bot can handle both private and shared expenses at a product level, allowing you to specify which items are shared and which are private.

## Roadmap
- Cleaning the database of outstanding receipts
- Deletion of photo files
- Saving "important" receipts in google drive (for example, for warranty purposes)
- Monthly message with a summary of costs
- Excell for the second person, so budget for couples
- ...

## Changelog

### Version 1.1.0 (21.03.2024)
- ✨ Added product-level sharing control for both AI and manual entry
- 🖼️ Improved image preprocessing for better AI receipt analysis
- 🔄 Added ability to modify sharing status after initial processing
- 📝 Updated manual entry to support per-product sharing settings

### Version 1.0.0 (Initial Release)
- 📸 Basic receipt photo processing
- 🤖 AI-powered receipt analysis
- 📊 Automatic categorization
- 💰 Basic shared/private expense tracking
- 📈 Google Sheets integration
- 🌐 Multi-language support (PL/EN)

## Features

- 📸 Process receipt photos through Telegram
- 🤖 AI-powered receipt analysis using OpenAI
  - Smart image preprocessing for better recognition
  - Automatic text extraction and parsing
  - Intelligent categorization of items
- 📊 Automatic categorization of expenses
- 💰 Flexible expense sharing at product level:
  - Set entire receipt as private or shared
  - Choose products individually for sharing
  - Modify sharing status after AI analysis
  - Control sharing in manual entry mode
- 📈 Automatic export to Google Sheets
- 📝 Monthly organization of expenses
- 🔍 Manual entry option for receipts
- 🌐 Multi-language support (Polish and English today, feel free to commit your proposition of translation)

## Expense Categories

The bot uses a predefined set of expense categories to help organize spending. Each category has three components:

- `id`: A short 3-letter code used as a quick reference (e.g., "FOH")
- `name`: A descriptive name of the category (e.g., "Food - Home")
- `description`: Detailed explanation of what belongs in this category

Default categories include:

| ID  | Name | Description |
|-----|------|-------------|
| FOH | Food - Home | Groceries and ingredients for home cooking |
| FOD | Food - Out | Restaurants, cafes, takeout, drinks |
| CAR | Car & Transport | Fuel, repairs, insurance, maintenance |
| TRN | Public Transit | Bus/train tickets, Uber, taxis, bikes |
| HOM | Housing & Bills | Rent, utilities, internet, phone |
| HLT | Health & Hygiene | Medicine, doctors, cosmetics, personal care |
| CLT | Clothing | Clothes, shoes, accessories |
| ENT | Entertainment | Movies, games, concerts, hobbies, gym |
| SUB | Subscriptions | Digital services like Netflix, Spotify |
| EDU | Education | Courses, training, books, learning materials |
| TRV | Travel | Tickets, accommodation, tourist attractions |
| GFT | Gifts | Birthday presents, holiday gifts, special occasions |
| ELE | Electronics | Gadgets, computers, phones, accessories |
| OTH | Other | Miscellaneous expenses that don't fit elsewhere |

These categories can be customized by modifying the `categories` array in `config.ts`. Each category should follow the same structure of having an ID, name, and description.


## Pre-Setup

### 1. Creating a Telegram Bot

1. Open Telegram and search for the user "BotFather"
2. Send the command `/newbot` to BotFather
3. BotFather will ask for:
   - A display name for your bot (can be any name)
   - A username for your bot (must end with 'bot', e.g., "MyReceiptBot" or "my_receipt_bot")
4. After successful creation, BotFather will send you an API token
5. Save this token - you'll need it for the `.env` file in the setup process

### 2. Setting up Google Sheets

1. Create a project in Google Cloud Console:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select an existing one

2. Enable Google Sheets API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

3. Create a service account:
   - Go to "APIs & Services" > "Authentication" > "Service Accounts"
   - Click "Create Service Account"
   - Provide a name and description
   - Assign the "Editor" role (or customize permissions as needed)
   - Go to the "Keys" section
   - Create a new JSON key
   - The credentials file will be downloaded to your computer

4. Share your Google Spreadsheet:
   - Open the spreadsheet you want to use
   - Click "Share"
   - Add the service account email (found in the downloaded JSON file under `client_email`)
   - Grant appropriate permissions (Editor role recommended)
   - Copy the spreadsheet ID from the URL (it's the long string between /d/ and /edit)

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   OPENAI_API_KEY=your_openai_api_key
   GOOGLE_SHEETS_CREDENTIALS_PATH=path_to_your_credentials.json
   GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
   ```
4. Make your own configuration
5. Run it with `npm run dev` or build and run with `npm run build  && npm run start`

### Configuration

The application can be customized by editing `src/config/config.ts`. Here's a detailed guide for each configuration option:

#### Purchase Type Keywords
```typescript
commonKeywords: string[] // Keywords for shared expenses (e.g., ['shared', 'together', 'common'])
soloKeywords: string[]   // Keywords for private expenses (e.g., ['solo', 'private', 'personal'])
noKeywords: string[]     // Keywords for negative responses (e.g., ['no', 'none', 'nothing'])
manualCommands: string[] // Keywords for manual entry (e.g., ['manual', 'manually'])
```

#### Common Expense Percentage
```typescript
commonExpensePercentage: number // Your share of common expenses (0.0 to 1.0)
// Example: 0.5 means you pay 50% of common expenses
```

#### Language Settings
```typescript
language: string // 'en' for English, 'pl' for Polish
```

#### AI Processing Costs
```typescript
tokenCosts: {
  inputCostPerMillion: number;  // Cost per million input tokens
  outputCostPerMillion: number; // Cost per million output tokens
  usdToPlnRate: number;         // USD to PLN conversion rate
}
```

#### Expense Categories
```typescript
categories: Array<{
  id: string;      // Unique category identifier
  name: string;    // Display name
  description: string; // Category description
}>
```

## Usage

1. Start the bot (locally or on your node server):
   ```bash
   npm start
   ```

2. In Telegram:
   - Send `/start` to begin
   - Send a photo of your receipt
   - Choose processing method:
     - AI analysis
     - Manual entry
   - Add any additional comments if needed
   - For AI-processed receipts:
     - Review the analyzed items
     - Choose sharing mode:
       - All items shared
       - All items private
       - Individual selection (select specific items to be shared/private)
   - For manual entry:
     - Enter store name
     - Add products one by one with sharing status
     - Or set default sharing status and modify individual items

3. The bot will:
   - Process the receipt (AI or manual)
   - Allow you to set sharing preferences for each item
   - Save the data to your Google Sheets spreadsheet
   - Organize entries by month

## Google Sheets Structure

The bot creates monthly sheets with the following columns:
- Date
- Store
- Name (Product)
- Price (Adjusted for shared expenses)
- Category
- Is Shared (indicates if the product is shared with others)

## Development

The project is written in TypeScript and uses:
- Node.js
- Telegram Bot API
- OpenAI API
- Google Sheets API
- SQLite for local storage

## License
GNU General Public License v3.0

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
