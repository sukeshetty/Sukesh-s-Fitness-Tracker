export class StorageError extends Error {
  constructor(message: string, public isQuotaExceeded: boolean = false) {
    super(message);
    this.name = 'StorageError';
  }
}

export const safeLocalStorage = {
  setItem: (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error: any) {
      if (error.name === 'QuotaExceededError') {
        console.error('❌ localStorage quota exceeded');
        throw new StorageError('Storage quota exceeded. Please clear some data.', true);
      }
      throw new StorageError('Failed to save data');
    }
  },

  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('❌ Failed to read from localStorage', error);
      return null;
    }
  },

  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('❌ Failed to remove from localStorage', error);
    }
  },

  clear: (): void => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('❌ Failed to clear localStorage', error);
    }
  },

  getSize: (): number => {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length;
      }
    }
    return total;
  },

  getSizeInMB: (): string => {
    const bytes = safeLocalStorage.getSize();
    return (bytes / 1024 / 1024).toFixed(2);
  }
};
