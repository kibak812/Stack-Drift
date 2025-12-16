// Score sharing utility using URL-safe base64 encoding
// Format: score|timestamp|checksum

export interface SharedScore {
  score: number;
  timestamp: number;
  playerName?: string;
}

// Simple checksum to prevent casual tampering
const generateChecksum = (score: number, timestamp: number): string => {
  const data = `${score}-${timestamp}-stackdrift`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 6);
};

// Encode score data to URL-safe string
export const encodeScore = (score: number): string => {
  const timestamp = Date.now();
  const checksum = generateChecksum(score, timestamp);
  const data = `${score}|${timestamp}|${checksum}`;
  // Base64 encode and make URL-safe
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

// Decode score data from URL-safe string
export const decodeScore = (encoded: string): SharedScore | null => {
  try {
    // Restore base64 padding and characters
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const decoded = atob(base64);
    const [scoreStr, timestampStr, checksum] = decoded.split('|');

    const score = parseInt(scoreStr, 10);
    const timestamp = parseInt(timestampStr, 10);

    // Verify checksum
    const expectedChecksum = generateChecksum(score, timestamp);
    if (checksum !== expectedChecksum) {
      return null;
    }

    // Validate data
    if (isNaN(score) || isNaN(timestamp) || score < 0) {
      return null;
    }

    return { score, timestamp };
  } catch {
    return null;
  }
};

// Generate shareable URL
export const generateShareUrl = (score: number): string => {
  const encoded = encodeScore(score);
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?s=${encoded}`;
};

// Get shared score from current URL
export const getSharedScoreFromUrl = (): SharedScore | null => {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('s');
  if (!encoded) return null;
  return decodeScore(encoded);
};

// Clear shared score from URL without reload
export const clearSharedScoreFromUrl = (): void => {
  const url = new URL(window.location.href);
  url.searchParams.delete('s');
  window.history.replaceState({}, '', url.toString());
};

// Format timestamp to relative time
export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}일 전`;
  if (hours > 0) return `${hours}시간 전`;
  if (minutes > 0) return `${minutes}분 전`;
  return '방금 전';
};

// Share using Web Share API or fallback to clipboard
export const shareScore = async (score: number): Promise<boolean> => {
  const url = generateShareUrl(score);
  const text = `🏎️ Stack Drift에서 ${Math.floor(score)}점을 달성했어요! 도전해보세요!`;

  // Try Web Share API first (mobile-friendly)
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Stack Drift - My High Score',
        text: text,
        url: url
      });
      return true;
    } catch (err) {
      // User cancelled or share failed
      if ((err as Error).name !== 'AbortError') {
        console.warn('Share failed:', err);
      }
    }
  }

  // Fallback to clipboard
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return true;
  } catch {
    // Last resort: prompt user to copy
    prompt('링크를 복사하세요:', url);
    return true;
  }
};
