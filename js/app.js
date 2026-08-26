import { supabase } from './supabase-client.js';

let currentUser = null;

// Global Initialization
document.addEventListener('DOMContentLoaded', async () => {
    checkAuthState();
    loadProducts();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('auth-form')?.addEventListener('submit', handleAuth);
    document.getElementById('sell-form')?.addEventListener('submit', handleCreateProduct);
    document.getElementById('review-form')?.addEventListener('submit', handleCreateReview);
}

async function checkAuthState() {
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    
    const authLink = document.getElementById('nav-auth-link');
    const dashboardLink = document.getElementById('nav-dashboard-link');
    
    if (user) {
        if(authLink) {
            authLink.textContent = 'Logout';
            authLink.href = '#';
            authLink.onclick = () => supabase.auth.signOut().then(() => window.location.reload());
        }
        if(dashboardLink) dashboardLink.style.display = 'inline-block';
    } else {
        if(authLink) {
            authLink.textContent = 'Login / Register';
            authLink.onclick = () => openModal('auth-modal');
        }
        if(dashboardLink) dashboardLink.style.display = 'none';
    }
}

// Authentication Flow
async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const fullName = document.getElementById('auth-name').value;
    const gcash = document.getElementById('auth-gcash').value;
    const isRegister = document.getElementById('auth-is-register').checked;

    if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName, gcash_number: gcash }
            }
        });
        if (error) alert('Registration Error: ' + error.message);
        else alert('Registration successful!');
    } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert('Login Error: ' + error.message);
        else window.location.reload();
    }
}

// Fetch and Display Products
async function loadProducts() {
    const { data: products, error } = await supabase
        .from('products')
        .select(`*, reviews(rating)`);

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    const grid = document.getElementById('product-catalog');
    if (!grid) return;
    grid.innerHTML = '';

    products.forEach(product => {
        const avgRating = product.reviews.length 
            ? (product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length).toFixed(1)
            : 'No ratings';

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${product.image_url || 'https://via.placeholder.com/300'}" class="product-image" alt="${product.title}">
            <h3>${product.title}</h3>
            <p>${product.description}</p>
            <div class="star-rating">★ ${avgRating}</div>
            <p><strong>PHP ${product.price}</strong></p>
            <button class="cta-button" onclick="initiatePayment('${product.id}', ${product.price}, '${product.title}')">Buy via GCash</button>
            <button class="secondary-button" style="margin-top: 0.5rem;" onclick="openReviewModal('${product.id}')">Review</button>
        `;
        grid.appendChild(card);
    });
}

// Execute PayMongo Checkout
window.initiatePayment = async function(productId, price, title) {
    if (!currentUser) {
        alert('Please login to purchase items.');
        openModal('auth-modal');
        return;
    }

    try {
        const response = await fetch('/api/create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: price,
                description: title,
                buyerEmail: currentUser.email,
                buyerName: currentUser.user_metadata?.full_name || 'Buyer',
                productId: productId,
                buyerId: currentUser.id
            })
        });

        const data = await response.json();
        if (data.checkoutUrl) {
            window.location.href = data.checkoutUrl;
        } else {
            alert('Checkout initialization failed.');
        }
    } catch (err) {
        console.error('Checkout error:', err);
    }
};

// Seller Functions
async function handleCreateProduct(e) {
    e.preventDefault();
    if (!currentUser) return;

    const title = document.getElementById('prod-title').value;
    const description = document.getElementById('prod-desc').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    const category = document.getElementById('prod-category').value;
    const imageUrl = document.getElementById('prod-image').value;

    const { error } = await supabase.from('products').insert([{
        seller_id: currentUser.id,
        title,
        description,
        price,
        category,
        image_url: imageUrl
    }]);

    if (error) alert('Error publishing product: ' + error.message);
    else {
        alert('Product listed successfully!');
        closeModal('sell-modal');
        loadProducts();
    }
}

// User Dashboard History Loading
window.loadDashboardData = async function() {
    if(!currentUser) return;
    
    // Purchases
    const { data: purchases } = await supabase
        .from('orders')
        .select(`*, products(title)`)
        .eq('buyer_id', currentUser.id);

    const boughtContainer = document.getElementById('bought-history');
    if(boughtContainer) {
        boughtContainer.innerHTML = purchases?.map(p => `
            <p>Product: ${p.products?.title || 'Item'} - Amount: PHP ${p.amount} - Status: ${p.status}</p>
        `).join('') || '<p>No purchase history found.</p>';
    }

    // Sales (for sellers)
    const { data: sales } = await supabase
        .from('orders')
        .select(`*, products!inner(title, seller_id)`)
        .eq('products.seller_id', currentUser.id);

    const salesContainer = document.getElementById('sales-history');
    if(salesContainer) {
        salesContainer.innerHTML = sales?.map(s => `
            <p>Item Sold: ${s.products?.title} - Amount: PHP ${s.amount} - Date: ${new Date(s.created_at).toLocaleDateString()}</p>
        `).join('') || '<p>No sales history recorded yet.</p>';
    }
};

// Modals Setup
window.openModal = function(id) { document.getElementById(id).style.display = 'flex'; };
window.closeModal = function(id) { document.getElementById(id).style.display = 'none'; };

window.openReviewModal = function(productId) {
    document.getElementById('review-product-id').value = productId;
    openModal('review-modal');
};

async function handleCreateReview(e) {
    e.preventDefault();
    if (!currentUser) return;

    const productId = document.getElementById('review-product-id').value;
    const rating = parseInt(document.getElementById('review-rating').value);
    const comment = document.getElementById('review-comment').value;

    const { error } = await supabase.from('reviews').insert([{
        product_id: productId,
        user_id: currentUser.id,
        rating,
        comment
    }]);

    if (error) alert('Error submitting review: ' + error.message);
    else {
        alert('Review added!');
        closeModal('review-modal');
        loadProducts();
    }
}
