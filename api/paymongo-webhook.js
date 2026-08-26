const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const event = req.body;

    if (event && event.data && event.data.attributes.type === 'checkout_session.payment.paid') {
        const sessionData = event.data.attributes.data;
        const sessionId = sessionData.id;
        const metadata = sessionData.attributes.metadata;
        const amount = sessionData.attributes.line_items[0].amount / 100;

        try {
            const { error } = await supabase.from('orders').insert([
                {
                    buyer_id: metadata.buyer_id,
                    product_id: metadata.product_id,
                    amount: amount,
                    paymongo_session_id: sessionId,
                    status: 'paid'
                }
            ]);

            if (error) throw error;

            return res.status(200).json({ received: true });
        } catch (err) {
            console.error('Database Update Error:', err.message);
            return res.status(500).send('Database Error');
        }
    }

    res.status(200).json({ received: true });
};
