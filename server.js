require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

// Import Models
const Order = require('./models/Order');
const Product = require('./models/Product');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const path = require('path');
const jwt = require('jsonwebtoken');

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Set up MongoDB Connection (Using an environment variable or a local default for testing)
// We will use an in-memory fallback if MONGO_URI is not provided to keep the test environment simple
// For production, the user would provide their own MongoDB Cloud URI
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cafe_qr';
let useMongo = false;

// In-memory fallback data
let memoryProducts = [
    { _id: 'p1', name: 'Espresso', price: 3.50, category: 'Coffee', description: 'Rich and bold espresso shot.', isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=400' },
    { _id: 'p2', name: 'Latte', price: 4.50, category: 'Coffee', description: 'Espresso with steamed milk.', isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=400' },
    { _id: 'p3', name: 'Matcha Green Tea', price: 5.00, category: 'Tea', description: 'Premium matcha with steamed milk.', isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1582793988951-9aed550cbe10?auto=format&fit=crop&q=80&w=400' },
    { _id: 'p4', name: 'Croissant', price: 3.00, category: 'Food', description: 'Buttery, flaky pastry.', isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1e4006aa07?auto=format&fit=crop&q=80&w=400' }
];
let memoryOrders = [];

mongoose.connect(MONGO_URI)
    .then(() => {
        useMongo = true;
        console.log('Connected to MongoDB');
        seedDatabase();
    })
    .catch(err => {
        console.log('MongoDB Connection Failed. using IN-MEMORY array fallback.');
    });

async function seedDatabase() {
    try {
        const count = await Product.countDocuments();
        if (count === 0) {
            await Product.insertMany(memoryProducts.map(p => {
                const newP = {...p};
                delete newP._id; // Let mongo generate ID
                return newP;
            }));
        }
    } catch (e) {}
}

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_123';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const KITCHEN_PASSWORD = process.env.KITCHEN_PASSWORD || 'bep123';

// --- Auth Routes ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    let role = null;

    if (username === 'admin' && password === ADMIN_PASSWORD) {
        role = 'admin';
    } else if (username === 'kitchen' && password === KITCHEN_PASSWORD) {
        role = 'kitchen';
    }

    if (role) {
        const token = jwt.sign({ role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, role });
    } else {
        res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không đúng' });
    }
});

// Middleware to verify JWT token
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) return res.sendStatus(403);
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

// --- API Routes ---
app.get('/api/products', async (req, res) => {
    try {
        const isAdmin = req.query.admin === 'true';
        if (useMongo) {
            const query = isAdmin ? {} : { isAvailable: true };
            const products = await Product.find(query);
            res.json(products);
        } else {
            const products = isAdmin ? memoryProducts : memoryProducts.filter(p => p.isAvailable !== false);
            res.json(products);
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        if (useMongo) {
            const orders = await Order.find({ status: { $ne: 'Completed' } }).sort({ createdAt: 1 });
            res.json(orders);
        } else {
            res.json(memoryOrders.filter(o => o.status !== 'Completed'));
        }
    } catch (error) {
        console.error("GET /api/orders ERROR:", error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// --- Admin API Routes ---

// Get Order History (Including Completed)
app.get('/api/orders/history', authenticateJWT, async (req, res) => {
    try {
        if (useMongo) {
            const history = await Order.find().sort({ createdAt: -1 }).limit(100);
            res.json(history);
        } else {
            res.json([...memoryOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch order history' });
    }
});

// Add New Product
app.post('/api/products', authenticateJWT, async (req, res) => {
    try {
        let savedProduct;
        if (useMongo) {
            const newDoc = new Product(req.body);
            savedProduct = await newDoc.save();
        } else {
            savedProduct = { _id: 'p' + Date.now(), ...req.body, isAvailable: true };
            memoryProducts.push(savedProduct);
        }
        res.status(201).json(savedProduct);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add product' });
    }
});

// Update Product
app.put('/api/products/:id', authenticateJWT, async (req, res) => {
    try {
        const id = req.params.id;
        let updated;
        if (useMongo) {
            updated = await Product.findByIdAndUpdate(id, req.body, { new: true });
        } else {
            const idx = memoryProducts.findIndex(p => p._id === id);
            if(idx > -1) {
                memoryProducts[idx] = { ...memoryProducts[idx], ...req.body };
                updated = memoryProducts[idx];
            }
        }
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Toggle Product Availability (Soft Delete / Disable)
app.delete('/api/products/:id', authenticateJWT, async (req, res) => {
    try {
        const id = req.params.id;
        let updated;
        if (useMongo) {
            updated = await Product.findByIdAndUpdate(id, { isAvailable: false }, { new: true });
        } else {
             const idx = memoryProducts.findIndex(p => p._id === id);
             if(idx > -1) {
                 memoryProducts[idx].isAvailable = false;
                 updated = memoryProducts[idx];
             }
        }
        res.json({ success: true, product: updated });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// Restore Product Availability
app.put('/api/products/:id/restore', authenticateJWT, async (req, res) => {
    try {
        const id = req.params.id;
        let updated;
        if (useMongo) {
            updated = await Product.findByIdAndUpdate(id, { isAvailable: true }, { new: true });
        } else {
             const idx = memoryProducts.findIndex(p => p._id === id);
             if(idx > -1) {
                 memoryProducts[idx].isAvailable = true;
                 updated = memoryProducts[idx];
             }
        }
        res.json({ success: true, product: updated });
    } catch (error) {
        res.status(500).json({ error: 'Failed to restore product' });
    }
});


// --- Socket.IO Realtime Logic ---
const lockedTables = new Map(); // tableNumber -> socket.id or 'ordered'

io.on('connection', (socket) => {
    socket.on('join_role', (role) => {
        socket.join(role);
    });

    socket.on('request_table', (tableNumber, callback) => {
        const currentLock = lockedTables.get(tableNumber);
        
        // If table locked by another socket or has pending order
        if (currentLock && currentLock !== socket.id) {
            callback({ success: false, reason: `Bàn ${tableNumber} đang có khách gọi món. Vui lòng thử lại sau!` });
        } else {
            lockedTables.set(tableNumber, socket.id);
            socket.tableNumber = tableNumber;
            callback({ success: true });
        }
    });

    socket.on('disconnect', () => {
        if (socket.tableNumber) {
            const currentLock = lockedTables.get(socket.tableNumber);
            if (currentLock === socket.id) {
                // Unlock if they disconnect without placing an order
                lockedTables.delete(socket.tableNumber);
            }
        }
    });

    socket.on('place_order', async (orderData) => {
        try {
            let savedOrder;
            if (useMongo) {
                const newOrder = new Order(orderData);
                savedOrder = await newOrder.save();
            } else {
                savedOrder = {
                    _id: 'ord_' + Date.now(),
                    ...orderData,
                    status: 'Pending',
                    createdAt: new Date().toISOString()
                };
                memoryOrders.push(savedOrder);
            }

            // Lock permanently for this order
            lockedTables.set(orderData.tableNumber.toString(), 'ordered');

            io.to('kitchen').emit('new_order_received', savedOrder);
            socket.emit('order_confirmed', savedOrder);
        } catch (error) {
            socket.emit('order_error', 'Failed to place order.');
        }
    });

    socket.on('update_order_status', async (updateData) => {
        try {
            const { orderId, newStatus } = updateData;
            let updatedOrder;

            if (useMongo) {
                updatedOrder = await Order.findByIdAndUpdate(orderId, { status: newStatus }, { new: true });
            } else {
                const idx = memoryOrders.findIndex(o => o._id === orderId);
                if(idx > -1) {
                    memoryOrders[idx].status = newStatus;
                    updatedOrder = memoryOrders[idx];
                }
            }

            if(updatedOrder) {
                io.to('kitchen').emit('order_status_updated', updatedOrder);
                
                // Unlock table when order is finished
                if (newStatus === 'Completed' || newStatus === 'Cancelled') {
                    if (updatedOrder.tableNumber) {
                        lockedTables.delete(updatedOrder.tableNumber.toString());
                    }
                }
            }
        } catch (error) {}
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
