const ROBLOX_API_BASE = 'https://users.roblox.com';
const FRIENDS_API_BASE = 'https://friends.roblox.com';

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(attempt) {
  const base = Math.min(INITIAL_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  return base + Math.floor(Math.random() * 1_000);
}

export class RobloxRateLimitError extends Error {
  constructor(message, retryAfterMs) {
    super(message);
    this.name = 'RobloxRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class RobloxApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'RobloxApiError';
    this.status = status;
  }
}

export async function resolveUserId(username) {
  const res = await fetch(`${ROBLOX_API_BASE}/v1/usernames/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usernames: [username],
      excludeBannedUsers: true,
    }),
  });

  if (res.status === 429) {
    throw new RobloxRateLimitError('Roblox API rate limit reached on username resolve.');
  }

  if (!res.ok) {
    throw new RobloxApiError(`Roblox API returned status ${res.status}`, res.status);
  }

  const data = await res.json();
  if (!data.data || data.data.length === 0) {
    return null;
  }

  return { id: data.data[0].id, name: data.data[0].name };
}

export async function getFollowerCount(userId) {
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(
      `${FRIENDS_API_BASE}/v1/users/${userId}/followers/count`
    );

    if (res.ok) {
      const data = await res.json();
      return data.count;
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const delay =
        retryAfter && !Number.isNaN(retryAfter)
          ? retryAfter * 1000
          : getRetryDelay(attempt);

      lastError = new RobloxRateLimitError(
        `Roblox API rate limit reached. Retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES}).`,
        delay
      );
      console.warn(lastError.message);
      await sleep(delay);
      continue;
    }

    if (res.status >= 500 && res.status < 600) {
      lastError = new RobloxApiError(
        `Roblox API server error ${res.status}. Retrying (attempt ${attempt + 1}/${MAX_RETRIES}).`,
        res.status
      );
      console.warn(lastError.message);
      await sleep(getRetryDelay(attempt));
      continue;
    }

    throw new RobloxApiError(`Roblox API returned status ${res.status}`, res.status);
  }

  throw lastError || new RobloxRateLimitError('Roblox API rate limit exhausted all retries.');
}
