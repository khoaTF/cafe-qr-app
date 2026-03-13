const socket = io();

// Constants
const urlParams = new URLSearchParams(window.location.search);
const TABLE_NUMBER = urlParams.get('table') || "5";
let menuItems = [];
let cart = [];
let activeOrderId = null;

// DOM Elements
const menuContainer = document.getElementById('menu-container');
const categoryPills = document.querySelectorAll('.pill');
const loader = document.getElementById('loader');

// Cart DOM
const floatingCart = document.getElementById('floating-cart');
const cartItemCount = document.getElementById('cart-item-count');
const cartTotalPrice = document.getElementById('cart-total-price');
const viewCartBtn = document.getElementById('view-cart-btn');

// Modal DOM
const cartModal = document.getElementById('cart-modal');
const closeModalBtn = document.getElementById('close-modal');
const cartItemsContainer = document.getElementById('cart-items-container');
const checkoutTotal = document.getElementById('checkout-total');
const checkoutBtn = document.getElementById('checkout-btn');

// Success DOM
const successOverlay = document.getElementById('success-overlay');
const liveStatus = document.getElementById('live-status');
const newOrderBtn = document.getElementById('new-order-btn');

function init() {
    document.getElementById('table-number-display').textContent = TABLE_NUMBER;
    socket.emit('join_role', 'customer');
    
    // Request table access limit to 1 device
    socket.emit('request_table', TABLE_NUMBER.toString(), (res) => {
        if (!res.success) {
            document.body.innerHTML = `
                <div style="display:flex; height:100vh; flex-direction:column; justify-content:center; align-items:center; background:#f7fafc; padding:20px; text-align:center;">
                    <i class="fa-solid fa-lock" style="font-size: 4rem; color: #e53e3e; margin-bottom: 20px;"></i>
                    <h2 style="font-weight: 700; color: #2d3748;">Bàn Đang Bận</h2>
                    <p class="text-muted mt-2" style="font-size: 1.1rem;">${res.reason}</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;">(Vui lòng chờ khách trước đặt xong hoặc liên hệ nhân viên)</p>
                </div>
            `;
            return;
        }
        fetchMenu();
        attachEventListeners();
    });
}

// Fetch Menu from Backend
async function fetchMenu() {
    try {
        const response = await fetch('/api/products');
        menuItems = await response.json();
        loader.style.display = 'none';
        renderMenu('All');
    } catch (error) {
        console.error("Lỗi khi tải thực đơn:", error);
        loader.textContent = "Không tải được thực đơn. Vui lòng tải lại trang.";
    }
}

// Render Menu
function renderMenu(category) {
    menuContainer.innerHTML = '';
    const filteredItems = category === 'All' 
        ? menuItems 
        : menuItems.filter(item => item.category === category);

    if(filteredItems.length === 0) {
        menuContainer.innerHTML = '<p class="text-center text-muted">Không có món nào.</p>';
        return;
    }

    filteredItems.forEach(item => {
        const cartItem = cart.find(c => c._id === item._id);
        const qty = cartItem ? cartItem.quantity : 0;

        const card = document.createElement('div');
        card.className = 'menu-item';
        card.innerHTML = `
            <img class="menu-img" src="${item.imageUrl}" alt="${item.name}">
            <div class="menu-details">
                <div>
                    <div class="menu-title">${item.name}</div>
                    <div class="menu-desc">${item.description}</div>
                </div>
                <div class="menu-price-row">
                    <div class="menu-price">${item.price.toLocaleString('vi-VN')} đ</div>
                    ${qty > 0 ? `
                        <div class="qty-controls">
                            <button class="qty-btn" onclick="updateCart('${item._id}', -1)">-</button>
                            <span class="qty-num">${qty}</span>
                            <button class="qty-btn" onclick="updateCart('${item._id}', 1)">+</button>
                        </div>
                    ` : `
                        <button class="add-btn" onclick="updateCart('${item._id}', 1)"><i class="fa-solid fa-plus"></i></button>
                    `}
                </div>
            </div>
        `;
        menuContainer.appendChild(card);
    });
}

// Cart Logic
window.updateCart = (productId, change) => {
    const product = menuItems.find(p => p._id === productId);
    if(!product) return;

    const existingIndex = cart.findIndex(c => c._id === productId);

    if (existingIndex > -1) {
        cart[existingIndex].quantity += change;
        if (cart[existingIndex].quantity <= 0) {
            cart.splice(existingIndex, 1);
        }
    } else if (change > 0) {
        cart.push({ ...product, quantity: 1 });
    }

    updateCartUI();
    // Re-render menu to update button states (Add btn vs Qty controls)
    const activeCategory = document.querySelector('.pill.active').dataset.category;
    renderMenu(activeCategory);
};

function updateCartUI() {
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (totalQty > 0) {
        floatingCart.style.display = 'block';
        cartItemCount.textContent = totalQty;
        cartTotalPrice.textContent = totalPrice.toLocaleString('vi-VN') + ' đ';
    } else {
        floatingCart.style.display = 'none';
        closeModal(); // Close modal if emptying cart
    }

    renderModalCart();
}

function renderModalCart() {
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<div class="empty-cart text-center text-muted">Giỏ hàng đang trống.</div>';
        checkoutTotal.textContent = "0";
        checkoutBtn.disabled = true;
        return;
    }

    cartItemsContainer.innerHTML = '';
    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const row = document.createElement('div');
        row.className = 'cart-item';
        row.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-title">${item.name}</div>
                <div class="cart-item-price">${item.price.toLocaleString('vi-VN')} đ</div>
            </div>
            <div class="qty-controls">
                <button class="qty-btn" onclick="updateCart('${item._id}', -1)">-</button>
                <span class="qty-num">${item.quantity}</span>
                <button class="qty-btn" onclick="updateCart('${item._id}', 1)">+</button>
            </div>
        `;
        cartItemsContainer.appendChild(row);
    });

    checkoutTotal.textContent = total.toLocaleString('vi-VN') + ' đ';
    checkoutBtn.disabled = false;
}

// UI Triggers
function openModal() { cartModal.classList.add('active'); }
function closeModal() { cartModal.classList.remove('active'); }

// Event Listeners
function attachEventListeners() {
    // Category filtering
    categoryPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            document.querySelector('.pill.active').classList.remove('active');
            e.target.classList.add('active');
            renderMenu(e.target.dataset.category);
        });
    });

    viewCartBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);

    // Mock Checkout
    checkoutBtn.addEventListener('click', () => {
        checkoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
        checkoutBtn.disabled = true;

        // Simulate payment delay
        setTimeout(() => {
            placeOrder();
        }, 1500);
    });

    newOrderBtn.addEventListener('click', () => {
        successOverlay.style.display = 'none';
        cart = [];
        updateCartUI();
        const activeCategory = document.querySelector('.pill.active').dataset.category;
        renderMenu(activeCategory);
        activeOrderId = null;
    });
}

// Socket Communication
function placeOrder() {
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Format items for DB schema
    const formattedItems = cart.map(item => ({
        productId: item._id,
        name: item.name,
        quantity: item.quantity,
        price: item.price
    }));

    const orderNote = document.getElementById('order-note') ? document.getElementById('order-note').value : '';

    const orderData = {
        tableNumber: TABLE_NUMBER,
        items: formattedItems,
        totalPrice: totalPrice,
        orderNote: orderNote
    };

    socket.emit('place_order', orderData);
}

// Listen for confirm from server
socket.on('order_confirmed', (savedOrder) => {
    closeModal();
    checkoutBtn.innerHTML = '<i class="fa-brands fa-apple-pay"></i> Thanh toán';
    successOverlay.style.display = 'flex';
    activeOrderId = savedOrder._id;
    liveStatus.className = 'text-primary';
    liveStatus.textContent = 'Đang chờ';
});

// Listen for updates from kitchen
socket.on('order_status_updated', (updatedOrder) => {
    // Check if this update belongs to the current user's active order
    if (activeOrderId === updatedOrder._id) {
        liveStatus.textContent = updatedOrder.status;
        
        // Color coding based on status
        if(updatedOrder.status === 'Preparing') {
            liveStatus.textContent = 'Đang làm';
            liveStatus.className = 'text-warning font-bold';
            liveStatus.style.color = '#ecc94b';
        } else if (updatedOrder.status === 'Ready') {
            liveStatus.textContent = 'Đã xong';
            liveStatus.className = 'text-success font-bold';
        } else if (updatedOrder.status === 'Completed') {
            liveStatus.textContent = 'Hoàn thành';
        }
    }
});

// Boot
init();
