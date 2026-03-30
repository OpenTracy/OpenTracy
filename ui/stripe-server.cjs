const express = require('express');
const cors = require('cors');

// Usando a chave secreta LIVE fornecida pelo usuário
const stripe = require('stripe')(
  process.env.STRIPE_SECRET_KEY
);

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Create Payment Intent endpoint
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency, metadata } = req.body;

    console.log('Creating payment intent:', { amount, currency, metadata });

    // Validate amount (minimum $1.00)
    if (amount < 100) {
      return res.status(400).json({ error: 'Minimum amount is $1.00' });
    }

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd', // Explicitly set to USD
      metadata: metadata || {},
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log('Payment intent created:', paymentIntent.id);

    res.json({
      client_secret: paymentIntent.client_secret,
      id: paymentIntent.id,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create Checkout Session endpoint for Brazilian users
app.post('/api/create-checkout-session-brazil', async (req, res) => {
  try {
    const { amount, currency, metadata } = req.body;

    console.log('Creating checkout session for Brazil:', { amount, currency, metadata });

    // Validate amount (minimum $1.00)
    if (amount < 100) {
      return res.status(400).json({ error: 'Minimum amount is $1.00' });
    }

    const credits = Math.round(amount / 100); // $1 = 1 credit

    // Create checkout session with minimal configuration
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${credits} Credits`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin || 'http://localhost:5173'}/billing?success=true&credits=${credits}`,
      cancel_url: `${req.headers.origin || 'http://localhost:5173'}/billing?canceled=true`,
    });

    console.log('Brazil checkout session created:', session.id);

    res.json({
      url: session.url,
      session_id: session.id,
    });
  } catch (error) {
    console.error('Error creating Brazil checkout session:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create Checkout Session endpoint for international users
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { amount, currency, metadata } = req.body;

    console.log('Creating checkout session:', { amount, currency, metadata });

    // Validate amount (minimum $1.00)
    if (amount < 100) {
      return res.status(400).json({ error: 'Minimum amount is $1.00' });
    }

    const credits = Math.round(amount / 100); // $1 = 1 credit

    // Create checkout session with minimal configuration
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${credits} Credits`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin || 'http://localhost:5173'}/billing?success=true&credits=${credits}`,
      cancel_url: `${req.headers.origin || 'http://localhost:5173'}/billing?canceled=true`,
    });

    console.log('Checkout session created:', session.id);

    res.json({
      url: session.url,
      session_id: session.id,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(400).json({ error: error.message });
  }
});

// Confirm Payment endpoint (optional)
app.post('/api/confirm-payment', async (req, res) => {
  try {
    const { paymentIntentId, amount } = req.body;

    console.log('Confirming payment:', { paymentIntentId, amount });

    // Here you would:
    // 1. Verify the payment was successful with Stripe
    // 2. Add credits to the user's account in your database
    // 3. Log the transaction

    const credits = Math.round(amount / 100); // $1 = 1 credit

    console.log('Payment confirmed, credits to add:', credits);

    res.json({
      success: true,
      credits_added: credits,
    });
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(400).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Stripe API server is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Stripe API server running on http://localhost:${PORT}`);
  console.log(`📋 Endpoints available:`);
  console.log(`   POST http://localhost:${PORT}/api/create-payment-intent`);
  console.log(`   POST http://localhost:${PORT}/api/create-checkout-session`);
  console.log(`   POST http://localhost:${PORT}/api/create-checkout-session-brazil`);
  console.log(`   POST http://localhost:${PORT}/api/confirm-payment`);
  console.log(`   GET  http://localhost:${PORT}/api/health`);
});
