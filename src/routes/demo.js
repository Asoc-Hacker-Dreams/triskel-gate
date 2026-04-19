import express from 'express';
import { db } from '../db/connection.js';
import { orders, platformFees, invoices, organizers, events } from '../db/schema.js';
import { eq, sum, count } from 'drizzle-orm';

const router = express.Router();

// Demo mode endpoint
router.get('/demo/status', async (req, res) => {
  try {
    const revenue = await db
      .select({
        totalOrders: count(),
        totalSales: sum(orders.subtotal),
        totalPlatformFees: sum(orders.platformFee),
        totalStripeFees: sum(orders.stripeFee)
      })
      .from(orders);

    const recentOrders = await db
      .select()
      .from(orders)
      .limit(5);

    res.json({
      demo: true,
      message: '🧪 Demo Mode Active',
      revenue: {
        totalOrders: revenue[0]?.totalOrders || 0,
        totalSales: revenue[0]?.totalSales || 0,
        platformFees: revenue[0]?.totalPlatformFees || 0,
        stripeFees: revenue[0]?.totalStripeFees || 0,
        netRevenue: (revenue[0]?.totalSales || 0) - (revenue[0]?.totalPlatformFees || 0) - (revenue[0]?.totalStripeFees || 0)
      },
      recentOrders,
      pricing: {
        platformFeePercent: 3.0,
        stripeFeePercent: 2.9,
        stripeFixedFee: 0.25
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simulate order with fees
router.post('/demo/simulate-order', async (req, res) => {
  const { ticketPrice, quantity } = req.body;
  
  const subtotal = ticketPrice * quantity;
  const platformFee = subtotal * 0.03; // 3%
  const stripeFee = (subtotal * 0.029) + (quantity * 0.25); // 2.9% + €0.25 per ticket
  const totalAmount = subtotal + platformFee + stripeFee;

  res.json({
    breakdown: {
      subtotal: subtotal.toFixed(2),
      platformFee: platformFee.toFixed(2),
      stripeFee: stripeFee.toFixed(2),
      totalAmount: totalAmount.toFixed(2)
    },
    fees: {
      triskellGate: '3%',
      stripe: '2.9% + €0.25/ticket'
    },
    organizerReceives: (subtotal - platformFee - stripeFee).toFixed(2)
  });
});

export default router;
