import translations from '../config/translations.json';

export type Language = 'en' | 'pl';

type TranslationValue = string | number | boolean | null | undefined;
type TranslationArray = TranslationValue[];
type TranslationObject = { [key: string]: TranslationValue | TranslationArray | TranslationObject };

export class TranslationService {
  private static instance: TranslationService;
  private currentLanguage: Language = 'pl';

  private constructor() {}

  public static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService();
    }
    return TranslationService.instance;
  }

  public setLanguage(language: Language): void {
    this.currentLanguage = language;
  }

  public getLanguage(): Language {
    return this.currentLanguage;
  }

  public translate(key: string, params: Record<string, string | number> = {}): string {
    const keys = key.split('.');
    let value: TranslationValue | TranslationArray | TranslationObject = translations[this.currentLanguage];

    for (const k of keys) {
      value = (value as TranslationObject)[k];
      if (value === undefined) {
        return key;
      }
    }

    return this.replaceParams(String(value), params);
  }

  private replaceParams(text: string, params: Record<string, string | number>): string {
    return text.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }
} 