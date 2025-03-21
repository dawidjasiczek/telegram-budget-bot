interface Category {
  id: string;
  name: string;
  description: string;
}

interface TokenCosts {
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  usdToPlnRate: number;
}

export interface Config {
  maxDimension: number;
  commonKeywords: string[];
  soloKeywords: string[];
  yesKeywords: string[];
  noKeywords: string[];
  manualCommands: string[];
  categories: Category[];
  tokenCosts: TokenCosts;
  language: string;
  commonExpensePercentage: number;
  multiKeywords: string[];
}

export const config: Config = {
  maxDimension: 1280,
  commonKeywords: ['w', 'r'],
  soloKeywords: ['p', 'pv'],
  multiKeywords: ['multi', 'm'],
  yesKeywords: ['tak', 't', 'y'],
  noKeywords: ['nie', "n"],
  manualCommands: ['rachunek', "manualnie", "bill", "manual", "m"],
  commonExpensePercentage: 0.5, 
  categories: [
    { id: "FOH", name: "Jedzenie – Dom", description: "Zakupy spożywcze, gotowanie w domu" },
    { id: "FOD", name: "Jedzenie – Na mieście", description: "Restauracje, kawiarnie, fast food, napoje na mieście" },
    { id: "CAR", name: "Transport – Samochód", description: "Paliwo, naprawy, ubezpieczenie, przeglądy" },
    { id: "TRN", name: "Transport – Komunikacja", description: "Bilety komunikacji miejskiej, Uber, taksówki, rowery, hulajnogi" },
    { id: "HOM", name: "Mieszkanie & Rachunki", description: "Czynsz, media, internet, telefon" },
    { id: "HLT", name: "Zdrowie & Higiena", description: "Leki, lekarze, kosmetyki, fryzjer" },
    { id: "CLT", name: "Odzież & Obuwie", description: "Ubrania, buty, dodatki" },
    { id: "ENT", name: "Rozrywka & Hobby", description: "Kino, gry, koncerty, książki, siłownia, sporty" },
    { id: "SUB", name: "Subskrypcje & Usługi cyfrowe", description: "Netflix, Spotify, inne abonamenty" },
    { id: "EDU", name: "Edukacja & Rozwój", description: "Kursy, szkolenia, książki, materiały edukacyjne" },
    { id: "TRV", name: "Podróże & Wyjazdy", description: "Bilety, noclegi, atrakcje turystyczne" },
    { id: "GFT", name: "Prezenty & Okazje specjalne", description: "Urodziny, święta, rocznice" },
    { id: "INV", name: "Inwestycje & Oszczędności", description: "Fundusze, giełda, oszczędności" },
    { id: "INS", name: "Ubezpieczenia & Finanse", description: "Polisy, prowizje, opłaty bankowe" },
    { id: "ELE", name: "Sprzęt & Elektronika", description: "AGD, komputery, telefony, akcesoria" },
    { id: "PET", name: "Zwierzęta & Opieka nad nimi", description: "Karma, weterynarz, akcesoria" },
    { id: "CHA", name: "Charytatywność & Darowizny", description: "Wsparcie organizacji, datki" },
    { id: "OTH", name: "Inne wydatki", description: "Wszystko, co nie pasuje do powyższych kategorii" }
  ],
  tokenCosts: {
    inputCostPerMillion: 2.50,
    outputCostPerMillion: 10.00,
    usdToPlnRate: 3.85
  },
  language: 'pl'
}; 

/**
 * Returns an array of all category names
 * @returns string[] Array of category names
 */
export function getAllCategoryNames(): string[] {
  return config.categories.map(category => category.name);
}

/**
 * Finds a category by its ID or name
 * @param idOrName Category ID or name to search for
 * @returns Category | undefined The matching category or undefined if not found
 */
export function findCategory(idOrName: string): Category | undefined {
  return config.categories.find(category => 
    category.id.toLowerCase() === idOrName.toLowerCase() || 
    category.name.toLowerCase() === idOrName.toLowerCase()
  );
}

/**
 * Returns a human-readable string of all categories in "ID: Name" format
 * @returns string Categories formatted as "ID: Name, ID: Name, ..."
 */
export function getHumanReadableCategoryList(): string {
  return config.categories.map(cat => `${cat.id}: ${cat.name}`).join('\n');
}
