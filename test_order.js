const io = require('socket.io-client');
const http = require('http');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log("Connected to server");
    
    // Simulate placing an order
    const mockOrder = {
        tableNumber: "5",
        items: [{ productId: "p1", name: "Espresso", quantity: 1, price: 3.50 }],
        totalPrice: 3.50
    };
    
    console.log("Placing order...");
    socket.emit('place_order', mockOrder);
});

socket.on('order_confirmed', (order) => {
    console.log("Order confirmed by server:", order);
    
    // Now fetch /api/orders
    console.log("Fetching /api/orders...");
    http.get('http://localhost:3000/api/orders', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log("Fetch result:", res.statusCode, data);
            process.exit(0);
        });
    }).on('error', err => {
        console.error("HTTP error:", err);
        process.exit(1);
    });
});

socket.on('order_error', (msg) => {
    console.error("Order error:", msg);
    process.exit(1);
});
