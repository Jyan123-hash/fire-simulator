import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Stripe Webhook は raw body 必須 ──
export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-09-30.clover',
});

// ── Firebase Admin 初期化（コールドスタート時のみ） ──
function initAdmin() {
  if (getApps().length > 0) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set');
  // 改行を含む private_key の扱いを安全にするため、JSON 文字列を一旦パース
  const sa = JSON.parse(raw);
  if (typeof sa.private_key === 'string') {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }
  initializeApp({ credential: cert(sa) });
}

// raw body を取得する helper（bodyParser: false の場合）
async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method not allowed');
  }

  const sig = req.headers['stripe-signature'];
  if (!sig || typeof sig !== 'string') {
    return res.status(400).send('Missing Stripe-Signature header');
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).send('Server not configured');
  }

  let event: Stripe.Event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[webhook] signature verification failed:', msg);
    return res.status(400).send(`Webhook Error: ${msg}`);
  }

  try {
    initAdmin();
    const db = getFirestore();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const uid =
          (session.metadata && session.metadata.uid) || session.client_reference_id;
        if (uid) {
          await db.collection('users').doc(uid).set(
            {
              plan: 'pro',
              stripeCustomerId: session.customer ?? null,
              stripeSubscriptionId: session.subscription ?? null,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
          console.log('[webhook] upgraded uid=', uid);
        } else {
          console.warn('[webhook] checkout.session.completed without uid');
        }
        break;
      }
      case 'customer.subscription.deleted':
      case 'customer.subscription.updated': {
        // サブスク解約時に free に戻す（任意の拡張）
        const sub = event.data.object as Stripe.Subscription;
        const uid = sub.metadata?.uid;
        if (!uid) break;
        const isActive = sub.status === 'active' || sub.status === 'trialing';
        await db.collection('users').doc(uid).set(
          {
            plan: isActive ? 'pro' : 'free',
            subscriptionStatus: sub.status,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
        break;
      }
      default:
        // 他のイベントは無視
        break;
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[webhook] handler error:', msg);
    return res.status(500).send(`Handler Error: ${msg}`);
  }
}
