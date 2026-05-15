import webPush from 'web-push';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@xopsalliance.com';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

// In-memory store (MVP — replace with DB table in production)
const subscriptions = new Map();

export function subscribe(userId, subscription) {
  subscriptions.set(String(userId), subscription);
}

export function unsubscribe(userId) {
  subscriptions.delete(String(userId));
}

export async function sendNotification(userId, payload) {
  const sub = subscriptions.get(String(userId));
  if (!sub) return false;
  try {
    await webPush.sendNotification(sub, JSON.stringify(payload));
    return true;
  } catch (err) {
    if (err.statusCode === 410) subscriptions.delete(String(userId));
    console.error('Push failed:', err.message);
    return false;
  }
}

export async function broadcastNotification(payload) {
  const results = [];
  for (const [userId, sub] of subscriptions) {
    try {
      await webPush.sendNotification(sub, JSON.stringify(payload));
      results.push({ userId, success: true });
    } catch (err) {
      if (err.statusCode === 410) subscriptions.delete(userId);
      results.push({ userId, success: false });
    }
  }
  return results;
}

export { VAPID_PUBLIC };
