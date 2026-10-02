const ROBLOX_API_BASE = 'https://users.roblox.com';

export async function resolveUserId(username) {
  const res = await fetch(`${ROBLOX_API_BASE}/v1/usernames/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usernames: [username],
      excludeBannedUsers: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`Roblox API returned status ${res.status}`);
  }

  const data = await res.json();
  if (!data.data || data.data.length === 0) {
    return null;
  }

  return { id: data.data[0].id, name: data.data[0].name };
}

export async function getFollowerCount(userId) {
  const res = await fetch(
    `https://friends.roblox.com/v1/users/${userId}/followers/count`
  );

  if (res.status === 429) {
    throw new Error('Roblox API rate limit reached. Will retry later.');
  }

  if (!res.ok) {
    throw new Error(`Roblox API returned status ${res.status}`);
  }

  const data = await res.json();
  return data.count;
}
