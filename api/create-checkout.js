const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { amount, description, buyerEmail, buyerName, productId, buyerId } = req.body;

    try {
        const options = {
            method: 'POST',
            url: 'https://api.paymongo.com/v1/checkout_sessions',
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`
            },
            data: {
                data: {
                    attributes: {
                        billing: { name: buyerName, email: buyerEmail },
                        line_items: [
                            {
                                currency: 'PHP',
                                amount: Math.round(amount * 100), // convert to centavos
                                description: description,
                                name: description,
                                quantity: 1
                            }
                        ],
                        payment_method_types: ['gcash', 'card', 'paymaya'],
                        success_url: `${req.headers.origin || 'https://' + req.headers.host}?status=success`,
                        cancel_url: `${req.headers.origin || 'https://' + req.headers.host}?status=cancelled`,
                        metadata: {
                            product_id: productId,
                            buyer_id: buyerId
                        }
                    }
                }
            }
        };

        const response = await axios.request(options);
        return res.status(200).json({ 
            checkoutUrl: response.data.data.attributes.checkout_url,
            sessionId: response.data.data.id 
        });
    } catch (error) {
        console.error('PayMongo API Error:', error.response?.data || error.message);
        return res.status(500).json({ error: 'Failed to create payment session' });
    }
};
