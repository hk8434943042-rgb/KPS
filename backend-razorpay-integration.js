/**
 * BACKEND INTEGRATION EXAMPLE - Razorpay Payment Verification
 * 
 * This is a sample backend implementation using Node.js/Express
 * for Razorpay payment verification and fee updates
 * 
 * Setup:
 * 1. npm install razorpay crypto
 * 2. Set environment variables: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
 * 3. Configure payment webhook in Razorpay dashboard
 */

const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ==================== CREATE ORDER ====================
/**
 * POST /api/fee-payment/create-order
 * 
 * Create a Razorpay order for fee payment
 * 
 * Request Body:
 * {
 *   "amount": 5000,              // Amount in INR
 *   "roll": "1001",              // Student roll number
 *   "studentName": "Priya Kumari",
 *   "studentClass": "IX",
 *   "email": "parent@email.com",
 *   "phone": "+91-9876543210"
 * }
 */
app.post('/api/fee-payment/create-order', async (req, res) => {
  try {
    const { amount, roll, studentName, studentClass, email, phone } = req.body;

    // Validate inputs
    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        error: 'Invalid amount', 
        message: 'Amount must be greater than 0' 
      });
    }

    if (!roll || !studentName) {
      return res.status(400).json({ 
        error: 'Missing student details' 
      });
    }

    // Create order on Razorpay
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}_${roll}`,
      description: `School Fees for ${studentName}`,
      notes: {
        studentRoll: roll,
        studentName: studentName,
        studentClass: studentClass,
        email: email,
        phone: phone
      }
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create order',
      message: error.message 
    });
  }
});

// ==================== VERIFY PAYMENT ====================
/**
 * POST /api/fee-payment/verify
 * 
 * Verify Razorpay payment signature and update fee records
 * 
 * Request Body:
 * {
 *   "razorpay_order_id": "order_1A2B3C4D5E6F7G8H",
 *   "razorpay_payment_id": "pay_1A2B3C4D5E6F7G8H",
 *   "razorpay_signature": "signature_hash",
 *   "roll": "1001",
 *   "amount": 5000
 * }
 */
app.post('/api/fee-payment/verify', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, roll, amount } = req.body;

    // Verify signature
    const signature = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!signature) {
      return res.status(400).json({ 
        success: false,
        verified: false,
        message: 'Invalid payment signature' 
      });
    }

    // Signature verified - update fee records in database
    // Example: Update student fee record
    const paymentRecord = {
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      roll: roll,
      amount: amount,
      status: 'completed',
      verifiedAt: new Date().toISOString(),
      method: 'razorpay'
    };

    // TODO: Save paymentRecord to your database
    // await FeePayment.create(paymentRecord);

    res.json({ 
      success: true,
      verified: true,
      message: 'Payment verified and recorded',
      paymentId: razorpay_payment_id
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Payment verification failed',
      message: error.message 
    });
  }
});

// ==================== WEBHOOK HANDLER ====================
/**
 * POST /webhook/razorpay
 * 
 * Handle Razorpay webhooks for real-time payment updates
 * Configure in Razorpay Dashboard:
 * - Settings → Webhooks
 * - Events: payment.authorized, payment.captured, payment.failed
 */
app.post('/webhook/razorpay', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookBody = req.body;

    // Verify webhook signature
    const isValid = verifyWebhookSignature(webhookBody, webhookSignature);

    if (!isValid) {
      console.error('Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(webhookBody);

    switch (event.event) {
      case 'payment.captured':
        handlePaymentCaptured(event.payload.payment.entity);
        break;

      case 'payment.failed':
        handlePaymentFailed(event.payload.payment.entity);
        break;

      case 'payment.authorized':
        handlePaymentAuthorized(event.payload.payment.entity);
        break;

      default:
        console.log('Unknown webhook event:', event.event);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Verify Razorpay payment signature
 */
function verifyRazorpaySignature(orderId, paymentId, signature) {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return expectedSignature === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(body, signature) {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    return expectedSignature === signature;
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return false;
  }
}

/**
 * Handle successful payment
 */
function handlePaymentCaptured(payment) {
  console.log('Payment captured:', payment.id);
  console.log('Amount:', payment.amount);
  console.log('Customer:', payment.email);

  // TODO: Update fee records in database
  // const { roll } = payment.notes;
  // await FeePayment.updateOne(
  //   { orderId: payment.order_id },
  //   { status: 'captured', capturedAt: new Date() }
  // );
  
  // TODO: Send payment confirmation email
}

/**
 * Handle failed payment
 */
function handlePaymentFailed(payment) {
  console.log('Payment failed:', payment.id);
  console.log('Reason:', payment.vpa);

  // TODO: Log failed payment
  // TODO: Send failure notification to parent
}

/**
 * Handle authorized payment
 */
function handlePaymentAuthorized(payment) {
  console.log('Payment authorized:', payment.id);

  // TODO: Process authorized payment
}

// ==================== GET PAYMENT STATUS ====================
/**
 * GET /api/fee-payment/status/:paymentId
 * 
 * Get payment status from Razorpay
 */
app.get('/api/fee-payment/status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await razorpay.payments.fetch(paymentId);

    res.json({
      success: true,
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount / 100, // Convert from paise
      currency: payment.currency,
      method: payment.method,
      email: payment.email,
      contact: payment.contact,
      createdAt: new Date(payment.created_at * 1000).toISOString()
    });

  } catch (error) {
    console.error('Payment fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch payment status',
      message: error.message 
    });
  }
});

// ==================== REFUND PAYMENT ====================
/**
 * POST /api/fee-payment/refund
 * 
 * Initiate refund for a payment
 * 
 * Request Body:
 * {
 *   "paymentId": "pay_1A2B3C4D5E6F7G8H",
 *   "amount": 5000,              // Optional - for partial refund
 *   "reason": "Student withdrew"
 * }
 */
app.post('/api/fee-payment/refund', async (req, res) => {
  try {
    const { paymentId, amount, reason } = req.body;

    const options = {
      notes: {
        reason: reason || 'Fee refund'
      }
    };

    if (amount) {
      options.amount = Math.round(amount * 100); // Convert to paise
    }

    const refund = await razorpay.payments.refund(paymentId, options);

    res.json({
      success: true,
      refundId: refund.id,
      status: refund.status,
      amount: refund.amount / 100,
      createdAt: new Date(refund.created_at * 1000).toISOString()
    });

  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({ 
      error: 'Refund failed',
      message: error.message 
    });
  }
});

// ==================== ENVIRONMENT VARIABLES ====================
/**
 * Required .env file entries:
 * 
 * RAZORPAY_KEY_ID=rzp_live_XXXXXXXXX
 * RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxx
 * RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxx
 * PORT=5000
 * DATABASE_URL=mongodb://...
 */

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Razorpay Integration Ready`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /api/fee-payment/create-order`);
  console.log(`  POST /api/fee-payment/verify`);
  console.log(`  POST /webhook/razorpay`);
  console.log(`  GET  /api/fee-payment/status/:paymentId`);
  console.log(`  POST /api/fee-payment/refund\n`);
});

module.exports = app;
