import { browser } from '$app/environment';
import { langs } from '$lib/constants';
import { eventManager } from '$lib/managers/event-manager.svelte';
import { lang } from '$lib/stores/preferences.store';
import { get } from 'svelte/store';

class LanguageManager {
  constructor() {
    if (browser) {
      // Set language immediately on initialization
      const currentLang = get(lang);
      this.setLanguage(currentLang);
      
      // Subscribe to language changes immediately
      lang.subscribe((lang) => this.setLanguage(lang));
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
