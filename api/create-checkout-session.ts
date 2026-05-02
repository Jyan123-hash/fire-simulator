import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-09-30.clover',
});

const SUCCESS_URL = 'https://fire-simulator-chi.vercel.app/?success=true';
const CANCEL_URL  = 'https://fire-simulator-chi.vercel.app/?canceled=true';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uid, email } = req.body ?? {};
    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ error: 'uid is required' });
    }
    if (!process.env.STRIPE_PRICE_ID) {
      return res.status(500).json({ error: 'STRIPE_PRICE_ID not configured' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: SUCCESS_URL,
      cancel_url:  CANCEL_URL,
      // uid を Stripe 側にも紐付け（Webhook と顧客検索の両方で使う）
      metadata: { uid },
      client_reference_id: uid,
      customer_email: typeof email === 'string' ? email : undefined,
      subscription_data: {
        metadata: { uid },
      },
      allow_promotion_codes: true,
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    console.error('[create-checkout-session]', msg);
    return res.status(500).json({ error: msg });
  }
}
