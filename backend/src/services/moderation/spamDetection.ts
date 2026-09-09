export interface SpamDetectionResult {
  isSpam: boolean;
  confidence: number; // 0-1 scale
  reasons: string[];
  flagType: 'spam' | 'inappropriate' | 'harassment' | 'fake' | 'other';
  severity: 'low' | 'medium' | 'high';
}

export interface ContentAnalysis {
  text: string;
  metadata?: {
    authorId?: string;
    contentType?: 'post' | 'comment' | 'blog';
    timestamp?: Date;
  };
}

export class SpamDetectionService {
  private static readonly SPAM_KEYWORDS = [
    // Common spam indicators
    'click here', 'free money', 'make money fast', 'get rich quick',
    'limited time offer', 'act now', 'urgent', 'congratulations you won',
    'claim your prize', 'no obligation', 'risk free', 'guaranteed',
    'double your income', 'work from home', 'be your own boss',
    // Inappropriate content
    'hate', 'kill', 'die', 'stupid', 'idiot', 'loser',
    // Suspicious patterns
    'www.', 'http://', 'https://', '.com', '.net', '.org'
  ];

  private static readonly SUSPICIOUS_PATTERNS = [
    /(.)\1{4,}/g, // Repeated characters (aaaaa)
    /[A-Z]{5,}/g, // Excessive caps
    /\d{10,}/g, // Long numbers (phone numbers, etc.)
    /[!@#$%^&*]{3,}/g, // Excessive special characters
    /(.{1,3})\1{3,}/g // Repeated short patterns
  ];

  static analyzeContent(analysis: ContentAnalysis): SpamDetectionResult {
    const { text } = analysis;
    const reasons: string[] = [];
    let spamScore = 0;
    let flagType: SpamDetectionResult['flagType'] = 'other';
    let severity: SpamDetectionResult['severity'] = 'low';

    // Check for spam keywords
    const lowerText = text.toLowerCase();
    const keywordMatches = this.SPAM_KEYWORDS.filter(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
    
    if (keywordMatches.length > 0) {
      spamScore += keywordMatches.length * 0.2;
      reasons.push(`Contains spam keywords: ${keywordMatches.join(', ')}`);
      flagType = 'spam';
    }

    // Check for suspicious patterns
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        spamScore += matches.length * 0.15;
        reasons.push(`Suspicious pattern detected: ${pattern.source}`);
        if (flagType === 'other') flagType = 'spam';
      }
    }

    // Check text length and quality
    const trimmedText = text.trim();
    
    // Check for whitespace-only content (before trimming check)
    if (text.length > 0 && trimmedText.length === 0) {
      spamScore += 0.5;
      reasons.push('Content is empty or whitespace only');
      if (flagType === 'other') flagType = 'spam';
    } else if (trimmedText.length === 0) {
      spamScore += 0.5;
      reasons.push('Content is empty');
      if (flagType === 'other') flagType = 'spam';
    } else if (trimmedText.length < 3) {
      spamScore += 0.3;
      reasons.push('Content too short');
      if (flagType === 'other') flagType = 'spam';
    }

    if (text.length > 5000) {
      spamScore += 0.2;
      reasons.push('Content excessively long');
      if (flagType === 'other') flagType = 'spam';
    }

    // Check for excessive repetition
    const words = text.split(/\s+/).filter(w => w.trim().length > 0);
    if (words.length > 0) {
      const uniqueWords = new Set(words.map(w => w.toLowerCase()));
      const repetitionRatio = uniqueWords.size / words.length;
      
      if (repetitionRatio < 0.3 && words.length > 10) {
        spamScore += 0.4;
        reasons.push('Excessive word repetition detected');
        if (flagType === 'other') flagType = 'spam';
      }

      // Check for very short repeated content
      if (words.length >= 3 && repetitionRatio < 0.5) {
        spamScore += 0.3;
        reasons.push('High repetition in short content');
        if (flagType === 'other') flagType = 'spam';
      }
    }

    // Check for repeated content patterns using advanced detection
    if (this.detectRepeatedContent(text, 0.8)) {
      spamScore += 0.4;
      reasons.push('Repeated content pattern detected');
      if (flagType === 'other') flagType = 'spam';
    }

    // Check for URL-like patterns (potential phishing)
    const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+|\w+\.(com|net|org|edu|gov)[^\s]*)/gi;
    const urlMatches = text.match(urlPattern);
    if (urlMatches && urlMatches.length > 2) {
      spamScore += 0.5;
      reasons.push('Multiple URLs detected');
      flagType = 'spam';
    }

    // Check for potential harassment indicators
    const harassmentKeywords = ['hate', 'kill', 'die', 'stupid', 'idiot', 'loser', 'ugly', 'fat'];
    const harassmentMatches = harassmentKeywords.filter(keyword => 
      lowerText.includes(keyword)
    );
    
    if (harassmentMatches.length > 0) {
      spamScore += harassmentMatches.length * 0.3;
      reasons.push(`Potential harassment language: ${harassmentMatches.join(', ')}`);
      flagType = 'harassment';
    }

    // Check for fake/misleading content indicators
    const fakeIndicators = ['breaking news', 'doctors hate this', 'secret revealed', 'they don\'t want you to know'];
    const fakeMatches = fakeIndicators.filter(indicator => 
      lowerText.includes(indicator.toLowerCase())
    );
    
    if (fakeMatches.length > 0) {
      spamScore += fakeMatches.length * 0.25;
      reasons.push(`Potential fake content indicators: ${fakeMatches.join(', ')}`);
      flagType = 'fake';
    }

    // Determine severity based on score
    if (spamScore >= 0.7) {
      severity = 'high';
    } else if (spamScore >= 0.4) {
      severity = 'medium';
    } else {
      severity = 'low';
    }

    // Cap the confidence score
    const confidence = Math.min(spamScore, 1.0);
    const isSpam = confidence >= 0.5;

    return {
      isSpam,
      confidence,
      reasons,
      flagType,
      severity
    };
  }

  static async processContentForModeration(
    contentId: string,
    contentType: 'post' | 'comment' | 'blog',
    text: string,
    authorId: string
  ): Promise<SpamDetectionResult> {
    const analysis: ContentAnalysis = {
      text,
      metadata: {
        authorId,
        contentType,
        timestamp: new Date()
      }
    };

    return this.analyzeContent(analysis);
  }

  // Advanced detection methods
  static detectRepeatedContent(text: string, threshold: number = 0.8): boolean {
    // Handle empty or very short text
    const trimmedText = text.trim();
    if (trimmedText.length === 0) return false;
    
    // Check for very short repeated patterns (like "!!+ !!+ !!+")
    const shortPatternRegex = /(.{1,5})\s*\1\s*\1/g;
    if (shortPatternRegex.test(text)) {
      return true;
    }
    
    // First try sentence-based detection
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length >= 2) {
      for (let i = 0; i < sentences.length; i++) {
        for (let j = i + 1; j < sentences.length; j++) {
          const sentence1 = sentences[i];
          const sentence2 = sentences[j];
          if (sentence1 && sentence2) {
            const similarity = this.calculateSimilarity(sentence1.trim(), sentence2.trim());
            if (similarity >= threshold) {
              return true;
            }
          }
        }
      }
    }
    
    // Also try word-based detection for cases where sentence splitting doesn't work well
    const words = text.split(/\s+/).filter(w => w.trim().length > 0);
    if (words.length >= 4) {
      // Look for repeated patterns in words
      const wordCounts = new Map<string, number>();
      for (const word of words) {
        const normalizedWord = word.toLowerCase().replace(/[^\w]/g, '');
        if (normalizedWord.length > 0) {
          wordCounts.set(normalizedWord, (wordCounts.get(normalizedWord) || 0) + 1);
        }
      }
      
      // Check if any word appears more than 50% of the time
      const totalWords = words.length;
      for (const [word, count] of wordCounts) {
        if (count >= 3 && count / totalWords >= 0.5) {
          return true;
        }
      }
    }
    
    // Additional check for very short repeated content with special characters
    if (words.length >= 3) {
      // Check if we have the same short pattern repeated
      const firstWord = words[0];
      if (firstWord && firstWord.length <= 5) {
        let consecutiveMatches = 1;
        for (let i = 1; i < words.length; i++) {
          if (words[i] === firstWord) {
            consecutiveMatches++;
          } else {
            break;
          }
        }
        if (consecutiveMatches >= 3) {
          return true;
        }
      }
    }
    
    return false;
  }

  private static calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0]![i] = i;
    }
    for (let j = 0; j <= str2.length; j++) {
      matrix[j]![0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j]![i] = Math.min(
          matrix[j]![i - 1]! + 1, // deletion
          matrix[j - 1]![i]! + 1, // insertion
          matrix[j - 1]![i - 1]! + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length]![str1.length]!;
  }

  static isLikelyBot(authorId: string, recentContent: string[]): boolean {
    if (recentContent.length < 3) return false;

    // Check for identical or very similar content
    const similarities = [];
    for (let i = 0; i < recentContent.length; i++) {
      for (let j = i + 1; j < recentContent.length; j++) {
        const content1 = recentContent[i];
        const content2 = recentContent[j];
        if (content1 && content2) {
          similarities.push(this.calculateSimilarity(content1, content2));
        }
      }
    }

    if (similarities.length === 0) return false;

    const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    return avgSimilarity > 0.7; // High similarity suggests bot behavior
  }
}