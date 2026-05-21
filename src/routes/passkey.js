import express from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { db } from '../db/connection.js';
import { passkeyCredentials, staff } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import authenticate from '../middleware/auth.js';

const router = express.Router();

const RP_NAME = process.env.PASSKEY_RP_NAME || 'Triskell Gate';
const RP_ID = process.env.PASSKEY_RP_ID || 'localhost';
const EXPECTED_ORIGIN = process.env.PASSKEY_ORIGIN || 'http://localhost:3005';

// In-memory challenge store with TTL
const challengeStore = new Map();
const CHALLENGE_TTL = 5 * 60 * 1000;

function storeChallenge(key, challenge) {
  const timer = setTimeout(() => challengeStore.delete(key), CHALLENGE_TTL);
  challengeStore.set(key, { challenge, timer });
}

function consumeChallenge(key) {
  const entry = challengeStore.get(key);
  if (!entry) return null;
  clearTimeout(entry.timer);
  challengeStore.delete(key);
  return entry.challenge;
}

// ── Registration (requires existing Supabase or legacy session) ──────────────

router.post('/register/options', authenticate, async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) return res.status(400).json({ error: 'Not authenticated' });

    const users = await db.select().from(staff).where(eq(staff.email, email.toLowerCase())).limit(1);
    if (!users.length) return res.status(404).json({ error: 'User not found' });

    const user = users[0];
    const existingCreds = await db.select().from(passkeyCredentials)
      .where(eq(passkeyCredentials.userId, String(user.id)));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new TextEncoder().encode(String(user.id)),
      userName: user.email,
      userDisplayName: user.name || user.email,
      attestationType: 'none',
      excludeCredentials: existingCreds.map(c => ({
        id: c.credentialId,
        type: 'public-key',
        transports: c.transports ? JSON.parse(c.transports) : [],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    storeChallenge(`reg:${user.id}`, options.challenge);
    res.json(options);
  } catch (err) {
    console.error('[passkey] register/options error:', err);
    res.status(500).json({ error: 'Failed to generate registration options' });
  }
});

router.post('/register/verify', authenticate, async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) return res.status(400).json({ error: 'Not authenticated' });

    const { response } = req.body;
    if (!response) return res.status(400).json({ error: 'Missing response' });

    const users = await db.select().from(staff).where(eq(staff.email, email.toLowerCase())).limit(1);
    if (!users.length) return res.status(404).json({ error: 'User not found' });

    const user = users[0];
    const expectedChallenge = consumeChallenge(`reg:${user.id}`);
    if (!expectedChallenge) return res.status(400).json({ error: 'Challenge expired — please try again' });

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: EXPECTED_ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Passkey registration verification failed' });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    await db.insert(passkeyCredentials).values({
      credentialId: credential.id,
      userId: String(user.id),
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: JSON.stringify(response.response?.transports || []),
    });

    res.json({ verified: true, message: 'Passkey registered successfully' });
  } catch (err) {
    console.error('[passkey] register/verify error:', err);
    res.status(500).json({ error: err.message || 'Registration verification failed' });
  }
});

// ── Authentication ─────────────────────────────────────────────────────────

router.post('/login/options', async (req, res) => {
  try {
    const { email } = req.body;
    let allowCredentials = [];
    let challengeKeyPrefix = 'anon';

    if (email) {
      const users = await db.select().from(staff)
        .where(eq(staff.email, email.toLowerCase())).limit(1);
      if (users.length) {
        challengeKeyPrefix = String(users[0].id);
        const creds = await db.select().from(passkeyCredentials)
          .where(eq(passkeyCredentials.userId, String(users[0].id)));
        allowCredentials = creds.map(c => ({
          id: c.credentialId,
          type: 'public-key',
          transports: c.transports ? JSON.parse(c.transports) : [],
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials,
      userVerification: 'preferred',
    });

    const challengeKey = `auth:${challengeKeyPrefix}:${Date.now()}`;
    storeChallenge(challengeKey, options.challenge);
    res.json({ ...options, _challengeKey: challengeKey });
  } catch (err) {
    console.error('[passkey] login/options error:', err);
    res.status(500).json({ error: 'Failed to generate authentication options' });
  }
});

router.post('/login/verify', async (req, res) => {
  try {
    const { response, challengeKey } = req.body;
    if (!response || !challengeKey) return res.status(400).json({ error: 'Missing required fields' });

    const expectedChallenge = consumeChallenge(challengeKey);
    if (!expectedChallenge) return res.status(400).json({ error: 'Challenge expired — please try again' });

    const creds = await db.select().from(passkeyCredentials)
      .where(eq(passkeyCredentials.credentialId, response.id));
    if (!creds.length) {
      return res.status(401).json({ error: 'Passkey not found — please register it first' });
    }

    const cred = creds[0];
    const users = await db.select().from(staff)
      .where(eq(staff.id, Number(cred.userId))).limit(1);
    if (!users.length || !users[0].isActive) {
      return res.status(401).json({ error: 'User not found or account is inactive' });
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: EXPECTED_ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: cred.credentialId,
        publicKey: Buffer.from(cred.publicKey, 'base64url'),
        counter: cred.counter,
        transports: cred.transports ? JSON.parse(cred.transports) : [],
      },
    });

    if (!verification.verified) {
      return res.status(401).json({ error: 'Passkey verification failed' });
    }

    await db.update(passkeyCredentials)
      .set({ counter: verification.authenticationInfo.newCounter })
      .where(eq(passkeyCredentials.credentialId, response.id));

    const user = users[0];
    await db.update(staff)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(staff.id, user.id));

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, authMethod: 'passkey' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error('[passkey] login/verify error:', err);
    res.status(401).json({ error: err.message || 'Authentication failed' });
  }
});

export default router;
