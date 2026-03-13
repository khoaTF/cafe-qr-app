const client = require('socket.io-client');
const kitchenSocket = client('http://localhost:3000');
const customerSocket = client('http://localhost:3000');

kitchenSocket.on('connect', () => {
    console.log("Kitchen connected");
    kitchenSocket.emit('join_role', 'kitchen');
    
    kitchenSocket.on('new_order_received', (order) => {
        console.log("SUCCESS: KITCHEN RECEIVED ORDER", order);
        process.exit(0);
    });
});

customerSocket.on('connect', () => {
    console.log("Customer connected");
    
    setTimeout(() => {
        console.log("Customer placing order...");
        customerSocket.emit('place_order', {
            tableNumber: "10",
            items: [{ productId: "p1", name: "Tea", quantity: 1, price: 2 }],
            totalPrice: 2
        });
    }, 1000);
});

// timeout
setTimeout(() => {
    console.error("FAIL: Kitchen did not receive order!");
    process.exit(1);
}, 3000);
