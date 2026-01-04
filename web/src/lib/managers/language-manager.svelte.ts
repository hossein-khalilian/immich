import { browser } from '$app/environment';
import { defaultLang, langs } from '$lib/constants';
import { eventManager } from '$lib/managers/event-manager.svelte';
import { lang, locale } from '$lib/stores/preferences.store';
import { get } from 'svelte/store';

class LanguageManager {
  constructor() {
    if (browser) {
      // Set language immediately on initialization
      const currentLang = get(lang);
      this.setLanguage(currentLang);
      this.syncLocaleWithLanguage(currentLang);
      
      // Subscribe to language changes immediately
      lang.subscribe((lang) => {
        this.setLanguage(lang);
        this.syncLocaleWithLanguage(lang);
      });
    }
  }

  private syncLocaleWithLanguage(langCode: string) {
    if (!browser) {
      return;
    }

    const currentLocale = get(locale);
    
    // Sync locale with language, but only if locale is still at default (Persian)
    // This allows users to have custom locale settings that won't be overridden
    if (langCode === 'fa' || langCode === defaultLang.code) {
      // For Persian, ensure locale is Persian
      if (currentLocale !== 'fa-IR-u-ca-persian') {
        locale.set('fa-IR-u-ca-persian');
      }
    } else if (langCode === 'en') {
      // For English, set locale to English if it's still Persian (default)
      if (currentLocale === 'fa-IR-u-ca-persian') {
        locale.set('en');
      }
    } else {
      // For other languages, try to use the language code as locale
      // Only update if locale is still at default Persian
      if (currentLocale === 'fa-IR-u-ca-persian') {
        locale.set(langCode);
      }
    }
  }

  rtl = $state(false);

  setLanguage(code: string) {
    if (!browser) {
      return;
    }

    const item = langs.find((item) => item.code === code);
    if (!item) {
      return;
    }

    this.rtl = item.rtl ?? false;

    const dir = item.rtl ? 'rtl' : 'ltr';
    // Set dir on both documentElement and body for better compatibility
    if (document.documentElement) {
      document.documentElement.setAttribute('dir', dir);
    }
    if (document.body) {
      document.body.setAttribute('dir', dir);
    }

    eventManager.emit('LanguageChange', item);
  }
}

export const languageManager = new LanguageManager();
