/**
 * Word Validation Service
 * 
 * Validates English words using:
 * 1. Local in-memory cache (fastest)
 * 2. Free Dictionary API (https://dictionaryapi.dev/)
 * 3. Caches validated words for future use
 * 
 * This service is modular and can be replaced with other validation sources.
 */

import https from 'https';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export class WordValidationService {
  // In-memory cache for validated words
  private validatedWords: Set<string> = new Set();
  private invalidWords: Set<string> = new Set();
  
  // Free Dictionary API endpoint
  private readonly DICTIONARY_API_URL = 'api.dictionaryapi.dev';
  
  // Common English words pre-loaded for faster validation
  private readonly commonWords: Set<string> = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
    'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
    'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
    'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
    'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
    'dog', 'cat', 'house', 'car', 'tree', 'book', 'water', 'food', 'love', 'friend',
    'family', 'happy', 'sad', 'big', 'small', 'fast', 'slow', 'hot', 'cold', 'new',
    'old', 'young', 'man', 'woman', 'boy', 'girl', 'child', 'baby', 'world', 'life',
    'hand', 'eye', 'head', 'foot', 'heart', 'mind', 'soul', 'body', 'place', 'home',
    'school', 'city', 'country', 'earth', 'sky', 'sun', 'moon', 'star', 'light', 'dark',
    'color', 'red', 'blue', 'green', 'yellow', 'black', 'white', 'music', 'song', 'art',
    'game', 'play', 'run', 'walk', 'jump', 'swim', 'fly', 'eat', 'drink', 'sleep',
    'talk', 'speak', 'listen', 'hear', 'see', 'watch', 'look', 'read', 'write', 'think',
    'feel', 'smell', 'touch', 'taste', 'move', 'stop', 'start', 'begin', 'end', 'finish',
    'win', 'lose', 'try', 'fail', 'success', 'goal', 'dream', 'hope', 'wish', 'plan',
    'idea', 'story', 'word', 'letter', 'number', 'name', 'question', 'answer', 'problem',
    'solution', 'help', 'need', 'want', 'like', 'love', 'hate', 'enjoy', 'fun', 'nice',
    'good', 'great', 'awesome', 'amazing', 'beautiful', 'wonderful', 'fantastic', 'excellent',
    'perfect', 'best', 'better', 'worse', 'bad', 'terrible', 'horrible', 'ugly', 'wrong',
    'right', 'true', 'false', 'real', 'fake', 'sure', 'maybe', 'perhaps', 'probably',
    'definitely', 'always', 'never', 'sometimes', 'often', 'rarely', 'usually', 'again',
    'once', 'twice', 'first', 'last', 'next', 'previous', 'before', 'after', 'during',
    'while', 'until', 'since', 'for', 'ago', 'soon', 'later', 'early', 'late', 'today',
    'tomorrow', 'yesterday', 'morning', 'afternoon', 'evening', 'night', 'week', 'month',
    'year', 'time', 'hour', 'minute', 'second', 'moment', 'period', 'season', 'spring',
    'summer', 'fall', 'autumn', 'winter', 'january', 'february', 'march', 'april', 'may',
    'june', 'july', 'august', 'september', 'october', 'november', 'december', 'monday',
    'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ]);

  constructor() {
    // Pre-load common words into validated cache
    this.commonWords.forEach(word => this.validatedWords.add(word.toLowerCase()));
    console.log(`[WordValidation] Pre-loaded ${this.commonWords.size} common words`);
  }

  /**
   * Validate a word
   * Checks local cache first, then calls dictionary API if needed
   */
  async validateWord(
    word: string, 
    requiredLetter: string | null = null,
    usedWords: string[] = []
  ): Promise<ValidationResult> {
    const normalizedWord = word.toLowerCase().trim();

    // Check if empty
    if (!normalizedWord) {
      return { valid: false, reason: 'Word cannot be empty' };
    }

    // Check if alphabetic only
    if (!/^[a-z]+$/.test(normalizedWord)) {
      return { valid: false, reason: 'Word must contain only letters' };
    }

    // Check minimum length (at least 2 letters)
    if (normalizedWord.length < 2) {
      return { valid: false, reason: 'Word must be at least 2 letters long' };
    }

    // Check required starting letter
    if (requiredLetter) {
      const required = requiredLetter.toLowerCase();
      if (!normalizedWord.startsWith(required)) {
        return { 
          valid: false, 
          reason: `Word must start with letter "${required.toUpperCase()}"` 
        };
      }
    }

    // Check if word was already used in this match
    const normalizedUsedWords = usedWords.map(w => w.toLowerCase());
    if (normalizedUsedWords.includes(normalizedWord)) {
      return { valid: false, reason: 'This word was already used in this match' };
    }

    // Check local cache first
    if (this.validatedWords.has(normalizedWord)) {
      return { valid: true };
    }

    // Check if already known to be invalid
    if (this.invalidWords.has(normalizedWord)) {
      return { valid: false, reason: 'Not a valid English word' };
    }

    // Call dictionary API
    try {
      const isValid = await this.checkDictionaryAPI(normalizedWord);
      
      if (isValid) {
        // Cache the valid word
        this.validatedWords.add(normalizedWord);
        return { valid: true };
      } else {
        // Cache the invalid word
        this.invalidWords.add(normalizedWord);
        return { valid: false, reason: 'Not a valid English word' };
      }
    } catch (error) {
      console.error('[WordValidation] API error:', error);
      
      // Graceful fallback: if word looks reasonable (common patterns), accept it
      // This prevents game from breaking when API is down
      if (this.isReasonableWord(normalizedWord)) {
        console.log(`[WordValidation] API failed, accepting reasonable word: ${normalizedWord}`);
        this.validatedWords.add(normalizedWord);
        return { valid: true };
      }
      
      return { 
        valid: false, 
        reason: 'Unable to validate word. Please try another word.' 
      };
    }
  }

  /**
   * Check word against Free Dictionary API
   * Returns true if word exists in dictionary
   */
  private checkDictionaryAPI(word: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.DICTIONARY_API_URL,
        path: `/api/v2/entries/en/${encodeURIComponent(word)}`,
        method: 'GET',
        timeout: 5000, // 5 second timeout
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            // API returns 200 with data if word exists
            // API returns 404 if word doesn't exist
            if (res.statusCode === 200) {
              const parsed = JSON.parse(data);
              resolve(Array.isArray(parsed) && parsed.length > 0);
            } else if (res.statusCode === 404) {
              resolve(false);
            } else {
              reject(new Error(`API returned status ${res.statusCode}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Fallback heuristic to check if a word looks reasonable
   * Used when API is unavailable
   */
  private isReasonableWord(word: string): boolean {
    // Check for common unreasonable patterns
    
    // Too many consecutive consonants (unlikely in English)
    const consecutiveConsonants = word.match(/[bcdfghjklmnpqrstvwxyz]{4,}/);
    if (consecutiveConsonants) return false;
    
    // Too many consecutive vowels (unlikely in English)
    const consecutiveVowels = word.match(/[aeiou]{4,}/);
    if (consecutiveVowels) return false;
    
    // Same letter repeated too many times
    const repeatedLetters = word.match(/(.)\1{2,}/);
    if (repeatedLetters) return false;
    
    // Check for reasonable length
    if (word.length > 20) return false;
    
    // Common English word patterns
    const commonPatterns = [
      /^(un|re|in|dis|over|under|out|up|down|pre|post|sub|super)/,
      /(ing|ed|er|est|ly|tion|sion|ness|ment|able|ible|ful|less|ous|ive|ize|ise)$/,
      /[aeiou]/, // Must have at least one vowel
    ];
    
    const hasVowel = commonPatterns[2].test(word);
    const hasCommonPrefix = commonPatterns[0].test(word);
    const hasCommonSuffix = commonPatterns[1].test(word);
    
    // Word is reasonable if it has a vowel and either a common prefix or suffix
    // or is at least 4 characters long with a vowel
    return hasVowel && (hasCommonPrefix || hasCommonSuffix || word.length >= 4);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { validated: number; invalid: number } {
    return {
      validated: this.validatedWords.size,
      invalid: this.invalidWords.size
    };
  }

  /**
   * Clear the cache (useful for testing)
   */
  clearCache(): void {
    this.validatedWords.clear();
    this.invalidWords.clear();
    // Re-add common words
    this.commonWords.forEach(word => this.validatedWords.add(word.toLowerCase()));
  }

  /**
   * Add a word to the validated cache manually
   * Useful for testing or custom word lists
   */
  addToCache(word: string): void {
    this.validatedWords.add(word.toLowerCase().trim());
  }
}

// Export singleton instance
export const wordValidationService = new WordValidationService();
