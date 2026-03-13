let products = [];
let orderHistory = [];
let productModalInstance;
const authHeaders = () => ({ 'Authorization': 'Bearer ' + localStorage.getItem('cafe_token') });

// DOM Elements
const productsTableBody = document.getElementById('products-table-body');
const historyTableBody = document.getElementById('history-table-body');
const totalRevenueEl = document.getElementById('total-revenue');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    productModalInstance = new bootstrap.Modal(document.getElementById('productModal'));
    fetchProducts();
    fetchHistory();
});

// --- Tab Switching Logic ---
function switchTab(tabName) {
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));

    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`section-${tabName}`).classList.add('active');

    if (tabName === 'history') {
        fetchHistory(); // Refresh history when switching to it
    } else {
        fetchProducts();
    }
}

// --- Menu Management ---

async function fetchProducts() {
    try {
        const response = await fetch('/api/products?admin=true', { headers: authHeaders() });
        if (response.status === 401 || response.status === 403) return window.location.href = '/login.html';
        products = await response.json();
        renderProductsTable();
    } catch (error) {
        productsTableBody.innerHTML = '<tr><td colspan="6" class="text-danger text-center">Không tải được thực đơn.</td></tr>';
    }
}

function renderProductsTable() {
    productsTableBody.innerHTML = '';
    
    if (products.length === 0) {
        productsTableBody.innerHTML = '<tr><td colspan="6" class="text-muted text-center py-4">Chưa có món nào. Hãy thêm món mới!</td></tr>';
        return;
    }

    products.forEach(p => {
        const tr = document.createElement('tr');
        const imgUrl = p.imageUrl || 'https://via.placeholder.com/50?text=No+Img';
        const isAvail = p.isAvailable !== false; // handle undefined as true
        
        tr.innerHTML = `
            <td><img src="${imgUrl}" class="table-avatar" alt="${p.name}"></td>
            <td class="fw-bold">${p.name} <br> <small class="text-muted fw-normal">${p.description || ''}</small></td>
            <td><span class="badge bg-secondary">${p.category}</span></td>
            <td class="text-primary fw-bold">${p.price.toLocaleString('vi-VN')} đ</td>
            <td>${isAvail ? '<span class="badge bg-success">Hoạt động</span>' : '<span class="badge bg-danger">Đã ẩn</span>'}</td>
            <td class="text-end">
                <button class="action-btn" onclick="editProduct('${p._id}')" title="Sửa"><i class="fa-solid fa-pen"></i></button>
                ${isAvail 
                    ? `<button class="action-btn delete" onclick="deleteProduct('${p._id}')" title="Ẩn món"><i class="fa-solid fa-eye-slash"></i></button>`
                    : `<button class="action-btn text-success" onclick="restoreProduct('${p._id}')" title="Hiện lại"><i class="fa-solid fa-eye"></i></button>`
                }
            </td>
        `;
        productsTableBody.appendChild(tr);
    });
}

function openProductModal() {
    // Reset form
    document.getElementById('productForm').reset();
    document.getElementById('prodId').value = '';
    document.getElementById('productModalLabel').innerText = 'Thêm món mới';
    productModalInstance.show();
}

function editProduct(id) {
    const product = products.find(p => p._id === id);
    if (!product) return;

    document.getElementById('prodId').value = product._id;
    document.getElementById('prodName').value = product.name;
    document.getElementById('prodCategory').value = product.category || 'Coffee';
    document.getElementById('prodPrice').value = product.price;
    document.getElementById('prodDesc').value = product.description || '';
    document.getElementById('prodImg').value = product.imageUrl || '';
    
    document.getElementById('productModalLabel').innerText = 'Chỉnh sửa món';
    productModalInstance.show();
}

async function saveProduct() {
    const id = document.getElementById('prodId').value;
    const productData = {
        name: document.getElementById('prodName').value,
        category: document.getElementById('prodCategory').value,
        price: parseFloat(document.getElementById('prodPrice').value),
        description: document.getElementById('prodDesc').value,
        imageUrl: document.getElementById('prodImg').value
    };

    if (!productData.name || isNaN(productData.price)) {
        alert("Vui lòng điền đầy đủ các thông tin bắt buộc.");
        return;
    }

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/products/${id}` : '/api/products';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(productData)
        });

        if (response.ok) {
            productModalInstance.hide();
            fetchProducts();
        } else {
            alert("Lưu sản phẩm thất bại.");
        }
    } catch (error) {
        alert("Lỗi kết nối máy chủ.");
    }
}

async function deleteProduct(id) {
    if(!confirm("Bạn có chắc chắn muốn ẩn món này không?")) return;
    
    try {
        const response = await fetch(`/api/products/${id}`, { method: 'DELETE', headers: authHeaders() });
        if (response.ok) {
            fetchProducts();
        } else {
            alert("Lỗi khi xóa sản phẩm.");
        }
    } catch (e) {
        alert("Lỗi kết nối máy chủ.");
    }
}

async function restoreProduct(id) {
    if(!confirm("Bạn có muốn hiển thị lại món này trên thực đơn không?")) return;
    
    try {
        const response = await fetch(`/api/products/${id}/restore`, { method: 'PUT', headers: authHeaders() });
        if (response.ok) {
            fetchProducts();
        } else {
            alert("Lỗi khi khôi phục sản phẩm.");
        }
    } catch (e) {
        alert("Lỗi kết nối máy chủ.");
    }
}


// --- Order History ---

async function fetchHistory() {
    try {
        const response = await fetch('/api/orders/history', { headers: authHeaders() });
        if (response.ok) {
            orderHistory = await response.json();
            renderHistoryTable();
        } else {
            throw new Error('Load failed');
        }
    } catch (error) {
        historyTableBody.innerHTML = '<tr><td colspan="6" class="text-danger text-center">Lỗi tải lịch sử đơn hàng.</td></tr>';
    }
}

function renderHistoryTable() {
    historyTableBody.innerHTML = '';
    let revenue = 0;

    if (orderHistory.length === 0) {
        historyTableBody.innerHTML = '<tr><td colspan="6" class="text-muted text-center py-4">Chưa có đơn hàng nào trong quá khứ.</td></tr>';
        totalRevenueEl.innerText = `Tổng doanh thu: 0 đ`;
        return;
    }

    orderHistory.forEach(order => {
        let dateStr = "Unknown Date";
        if(order.createdAt) {
            try {
                dateStr = new Date(order.createdAt).toLocaleString();
            }catch(e){}
        }

        const itemsStr = (order.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ');
        const total = order.totalPrice || 0;
        
        if (order.status === 'Completed') {
            revenue += total;
        }

        const statusMap = {
            'Pending': 'Chờ xác nhận',
            'Preparing': 'Đang làm',
            'Ready': 'Đã xong',
            'Completed': 'Hoàn thành',
            'Cancelled': 'Đã hủy'
        };

        const statusBadgeClasses = {
            'Pending': 'bg-warning text-dark',
            'Preparing': 'bg-primary',
            'Ready': 'bg-info text-dark',
            'Completed': 'bg-success',
            'Cancelled': 'bg-danger'
        };
        const badgeClass = statusBadgeClasses[order.status] || 'bg-secondary';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-muted"><small>${(order._id||'').substring(0, 8)}...</small></td>
            <td>${dateStr}</td>
            <td class="fw-bold">Bàn ${order.tableNumber || '?'}</td>
            <td><small>${itemsStr}</small></td>
            <td class="text-success fw-bold">${total.toLocaleString('vi-VN')} đ</td>
            <td><span class="badge ${badgeClass}">${statusMap[order.status] || order.status}</span></td>
        `;
        historyTableBody.appendChild(tr);
    });

    totalRevenueEl.innerHTML = `<strong>Tổng doanh thu (Hoàn thành):</strong> <span class="text-success ms-2">${revenue.toLocaleString('vi-VN')} đ</span>`;
}
