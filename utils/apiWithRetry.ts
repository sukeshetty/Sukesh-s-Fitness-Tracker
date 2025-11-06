interface RetryOptions {
  maxRetries?: number;
  timeoutMs?: number;
  backoffMultiplier?: number;
}

export class NetworkError extends Error {
  constructor(message: string, public isTimeout: boolean = false) {
    super(message);
    this.name = 'NetworkError';
  }
}

export async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    timeoutMs = 30000,
    backoffMultiplier = 2
  } = options;

  let lastError: Error | null = null;
  let delay = 1000; // Start with 1 second

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new NetworkError('Request timed out', true));
        }, timeoutMs);
      });

      // Race between fetch and timeout
      const result = await Promise.race([
        fetchFn(),
        timeoutPromise
      ]);

      return result;

    } catch (error: any) {
      lastError = error;

      // Don't retry on certain errors
      if (error.message?.includes('API key not valid') ||
          error.message?.includes('Invalid argument') ||
          error.message?.includes('API_KEY environment variable not set')) {
        throw error;
      }

      // Last attempt - throw error
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying (exponential backoff)
      console.log(`⚠️ Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= backoffMultiplier;
    }
  }

  throw new NetworkError(
    lastError?.message || 'Network request failed after multiple retries',
    lastError instanceof NetworkError && lastError.isTimeout
  );
}
