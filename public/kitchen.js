const socket = io();
let orders = [];

// DOM Elements
const ordersContainer = document.getElementById('orders-container');
const loader = document.getElementById('loader');
const connStatus = document.getElementById('connection-status');
// const dingSound = document.getElementById('ding');

// Initialize
function init() {
    socket.emit('join_role', 'kitchen');
    fetchActiveOrders();
}

// Fetch Initial Orders from Server
async function fetchActiveOrders() {
    try {
        const response = await fetch('/api/orders');
        orders = await response.json();
        loader.style.display = 'none';
        renderOrders();
    } catch (error) {
        console.error("Lỗi tải đơn hàng:", error);
        loader.textContent = "Không tải được đơn hàng. Vui lòng tải lại trang.";
    }
}

// Render Orders Grid
function renderOrders() {
    try {
        if (!ordersContainer) return;
        ordersContainer.innerHTML = '';
        
        if (!Array.isArray(orders) || orders.length === 0) {
            ordersContainer.innerHTML = '<div class="text-muted" style="grid-column: 1 / -1;">Không có đơn hàng nào chờ xử lý.</div>';
            return;
        }

        orders.forEach(order => {
            // Defensive checks
            let timeStr = "Vừa xong";
            if (order.createdAt) {
                try {
                    timeStr = new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                } catch(e) {}
            }
            
            // Build items list
            const items = Array.isArray(order.items) ? order.items : [];
            const itemsHtml = items.map(item => `
                <li>
                    <span>${item.quantity || 1}x ${item.name || 'Unknown Item'}</span>
                </li>
            `).join('');

            const card = document.createElement('div');
            card.className = `order-card status-${order.status || 'Pending'}`;
            card.id = `order-${order._id}`;
            
            card.innerHTML = `
                <div class="order-header">
                    <div class="order-table">Bàn ${order.tableNumber || '?'}</div>
                    <div class="order-time">${timeStr}</div>
                </div>
                <ul class="order-list">
                    ${itemsHtml}
                </ul>
                ${order.orderNote ? `<div style="padding: 10px; background: #fff3cd; color: #856404; font-size: 0.9em; border-radius: 4px; margin-top: 10px; font-weight: bold;"><i class="fa-solid fa-note-sticky"></i> Ghi chú: ${order.orderNote}</div>` : ''}
                <div class="mt-3">
                    <select class="status-select" onchange="updateOrderStatus('${order._id}', this.value)">
                        <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>⏳ Chờ xác nhận</option>
                        <option value="Preparing" ${order.status === 'Preparing' ? 'selected' : ''}>🍳 Đang chế biến</option>
                        <option value="Ready" ${order.status === 'Ready' ? 'selected' : ''}>✅ Đã xong</option>
                        <option value="Completed" ${order.status === 'Completed' ? 'selected' : ''}>🎉 Hoàn thành (Ẩn)</option>
                    </select>
                </div>
            `;
            
            ordersContainer.appendChild(card);
        });
    } catch (e) {
        console.error("Lỗi hiển thị đơn hàng:", e);
        ordersContainer.innerHTML = '<div class="text-danger">Không tải được giao diện đơn hàng. Xem console để biết thêm chi tiết.</div>';
    }
}

// Update Order Status via Socket
window.updateOrderStatus = (orderId, newStatus) => {
    socket.emit('update_order_status', { orderId, newStatus });

    // Optimistic update locally
    const orderIndex = orders.findIndex(o => o._id === orderId);
    if (orderIndex > -1) {
        // If completed, we remove it from the active dashboard view immediately
        if (newStatus === 'Completed') {
            orders.splice(orderIndex, 1);
        } else {
            orders[orderIndex].status = newStatus;
        }
        renderOrders();
    }
};

// --- Socket Listeners ---

// Listen for new orders
socket.on('new_order_received', (newOrder) => {
    // try { dingSound.play(); } catch(e){} // Play sound notification
    orders.push(newOrder);
    // Sort by creation time (just in case)
    orders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    renderOrders();
});

// Listen for status updates (made by other kitchen screens)
socket.on('order_status_updated', (updatedOrder) => {
    const orderIndex = orders.findIndex(o => o._id === updatedOrder._id);

    if (updatedOrder.status === 'Completed') {
        if (orderIndex > -1) {
            orders.splice(orderIndex, 1);
            renderOrders();
        }
    } else {
        if (orderIndex > -1) {
            orders[orderIndex].status = updatedOrder.status;
            renderOrders();
        } else {
            // Unlikely, but if an order was updated from completed back to ready
            orders.push(updatedOrder);
            orders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            renderOrders();
        }
    }
});

// Connection state handling
socket.on('connect', () => {
    connStatus.innerHTML = '<i class="fa-solid fa-wifi"></i> Trực tuyến';
    connStatus.className = 'text-success';
});

socket.on('disconnect', () => {
    connStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Mất kết nối';
    connStatus.className = 'text-danger';
});

// Boot
init();
