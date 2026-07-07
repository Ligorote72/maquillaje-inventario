// Configuración de Supabase
const supabaseUrl = 'https://hnjamkdpylopbflqefyd.supabase.co';
const supabaseKey = 'sb_publishable_p4-N9JRkDMo-jYAdNyQu5Q_Xxv_6vVs';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Estado de la aplicación
let inventory = [];
let salesHistory = [];
let cart = {}; // ID de producto -> { producto, cantidadVenta }

// Elementos del DOM
const inventoryBody = document.getElementById('inventory-body');
const salesBody = document.getElementById('sales-body');
const btnAddProduct = document.getElementById('btn-add-product');
const modalAddProduct = document.getElementById('add-product-modal');
const formAddProduct = document.getElementById('add-product-form');
const btnCloseModal = document.querySelector('.close-modal');

// Carrito
const cartSidebar = document.getElementById('cart-sidebar');
const mainContent = document.querySelector('.main-content');
const btnCloseCart = document.getElementById('close-cart');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalEl = document.getElementById('cart-total');
const btnConfirmSale = document.getElementById('btn-confirm-sale');
const paymentMethodSelect = document.getElementById('payment-method');

// Navegación
const navLinks = document.querySelectorAll('.nav-links li');
const tabContents = document.querySelectorAll('.tab-content');
const dailyTotalEl = document.getElementById('daily-total');

// Formatear moneda
const formatMoney = (amount) => {
    return '$' + parseFloat(amount).toFixed(2);
};

// --- CARGAR DATOS DESDE SUPABASE ---
const loadData = async () => {
    inventoryBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Cargando inventario...</td></tr>`;
    
    // Cargar productos
    const { data: prods, error: errProds } = await supabaseClient.from('productos').select('*').order('created_at', { ascending: false });
    if (!errProds && prods) {
        inventory = prods;
        renderInventory();
    } else {
        console.error("Error cargando productos", errProds);
    }

    // Cargar ventas
    const { data: sales, error: errSales } = await supabaseClient.from('ventas').select('*').order('created_at', { ascending: false });
    if (!errSales && sales) {
        salesHistory = sales;
        renderSalesHistory();
    } else {
        console.error("Error cargando ventas", errSales);
    }
};

// --- RENDERIZADO DEL INVENTARIO ---
const renderInventory = () => {
    inventoryBody.innerHTML = '';
    
    if (inventory.length === 0) {
        inventoryBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No hay productos en el inventario.</td></tr>`;
        return;
    }

    inventory.forEach(item => {
        const isOutOfStock = item.stock <= 0;
        const statusHTML = isOutOfStock 
            ? `<span class="status out-of-stock">Agotado</span>` 
            : `<span class="status in-stock">Disponible</span>`;
            
        const tr = document.createElement('tr');
        if(isOutOfStock) tr.classList.add('row-out-of-stock');
        
        // Verifica si ya está en el carrito
        const inCart = cart[item.id] ? true : false;
        const btnText = inCart ? 'En carrito' : 'Vender';
        const btnClass = inCart ? 'btn-secondary' : 'btn-primary';

        const profit = item.price - (item.cost || 0);
        const profitClass = profit > 0 ? 'profit-positive' : 'profit-negative';

        tr.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>${formatMoney(item.price)}</td>
            <td style="color: var(--text-muted);">${formatMoney(item.cost || 0)}</td>
            <td><span class="profit-badge ${profitClass}">${profit > 0 ? '+' : ''}${formatMoney(profit)}</span></td>
            <td>${item.stock}</td>
            <td>${statusHTML}</td>
            <td>
                <button class="${btnClass} btn-sell" data-id="${item.id}" ${isOutOfStock ? 'disabled' : ''}>
                    <i class="fa-solid fa-cart-plus"></i> ${btnText}
                </button>
            </td>
        `;
        inventoryBody.appendChild(tr);
    });

    // Añadir eventos a los botones de vender
    document.querySelectorAll('.btn-sell').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            addToCart(id);
        });
    });
};

// --- GESTIÓN DEL CARRITO ---
const toggleCart = (show) => {
    if (show) {
        cartSidebar.classList.add('open');
        mainContent.classList.add('cart-open');
    } else {
        cartSidebar.classList.remove('open');
        mainContent.classList.remove('cart-open');
    }
};

const addToCart = (id) => {
    const product = inventory.find(p => p.id === id || p.id == id);
    if (!product || product.stock <= 0) return;

    if (!cart[id]) {
        cart[id] = { product: product, quantity: 1 };
    }
    
    toggleCart(true);
    renderCart();
    renderInventory();
};

const updateCartItemQuantity = (id, change) => {
    if (!cart[id]) return;
    
    const item = cart[id];
    let newQty = item.quantity + change;
    
    if (newQty <= 0) {
        delete cart[id];
    } else if (newQty > item.product.stock) {
        newQty = item.product.stock;
    } else {
        item.quantity = newQty;
    }
    
    renderCart();
    if (Object.keys(cart).length === 0) {
        renderInventory();
    }
};

const renderCart = () => {
    cartItemsContainer.innerHTML = '';
    let total = 0;
    const cartKeys = Object.keys(cart);

    if (cartKeys.length === 0) {
        cartItemsContainer.innerHTML = `<div class="empty-cart-msg">No hay productos seleccionados.</div>`;
        btnConfirmSale.disabled = true;
        cartTotalEl.innerText = '$0.00';
        return;
    }

    cartKeys.forEach(id => {
        const item = cart[id];
        const itemTotal = item.product.price * item.quantity;
        total += itemTotal;

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-header">
                <strong>${item.product.name}</strong>
                <button class="icon-btn btn-remove-cart" data-id="${id}"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="cart-item-controls">
                <span>${formatMoney(item.product.price)} c/u</span>
                <div class="qty-control">
                    <button class="qty-btn btn-minus" data-id="${id}">-</button>
                    <input type="text" class="qty-input" value="${item.quantity}" readonly>
                    <button class="qty-btn btn-plus" data-id="${id}">+</button>
                </div>
            </div>
        `;
        cartItemsContainer.appendChild(div);
    });

    cartTotalEl.innerText = formatMoney(total);
    btnConfirmSale.disabled = false;

    // Eventos del carrito
    document.querySelectorAll('.btn-minus').forEach(btn => {
        btn.addEventListener('click', (e) => updateCartItemQuantity(e.currentTarget.dataset.id, -1));
    });
    document.querySelectorAll('.btn-plus').forEach(btn => {
        btn.addEventListener('click', (e) => updateCartItemQuantity(e.currentTarget.dataset.id, 1));
    });
    document.querySelectorAll('.btn-remove-cart').forEach(btn => {
        btn.addEventListener('click', (e) => {
            delete cart[e.currentTarget.dataset.id];
            renderCart();
            renderInventory();
        });
    });
};

// --- CONFIRMAR VENTA ---
btnConfirmSale.addEventListener('click', async () => {
    const cartKeys = Object.keys(cart);
    if (cartKeys.length === 0) return;

    btnConfirmSale.disabled = true;
    btnConfirmSale.innerText = "Procesando...";

    let totalSale = 0;
    const soldItems = [];

    // Preparar actualizaciones de stock
    for (const id of cartKeys) {
        const item = cart[id];
        const invProduct = inventory.find(p => p.id == id);
        if (invProduct) {
            const newStock = invProduct.stock - item.quantity;
            totalSale += (invProduct.price * item.quantity);
            soldItems.push({
                name: invProduct.name,
                qty: item.quantity,
                price: invProduct.price
            });

            // Actualizar stock en Supabase
            await supabaseClient.from('productos').update({ stock: newStock }).eq('id', id);
        }
    }

    // Registrar venta en Supabase
    const saleRecord = {
        items: soldItems, // JSONB
        total: totalSale,
        method: paymentMethodSelect.value
    };
    
    await supabaseClient.from('ventas').insert([saleRecord]);

    // Limpiar y recargar
    cart = {};
    renderCart();
    toggleCart(false);
    btnConfirmSale.innerText = "Confirmar Venta";
    
    // Recargar datos frescos de la nube
    await loadData();
    
    alert('¡Venta registrada con éxito en la nube!');
});

// --- RENDERIZAR HISTORIAL DE VENTAS ---
const renderSalesHistory = () => {
    salesBody.innerHTML = '';
    
    const today = new Date().toLocaleDateString();
    let dailyTotal = 0;
    
    if (salesHistory.length === 0) {
        salesBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No hay ventas registradas aún.</td></tr>`;
        dailyTotalEl.innerText = '$0.00';
        return;
    }

    salesHistory.forEach(sale => {
        const saleDate = new Date(sale.created_at);
        
        if (saleDate.toLocaleDateString() === today) {
            dailyTotal += Number(sale.total);
        }

        const timeString = saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = saleDate.toLocaleDateString();
        
        const itemsList = sale.items.map(i => `${i.qty}x ${i.name}`).join('<br>');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div>${dateString}</div>
                <div style="color: var(--text-muted); font-size: 0.8rem;">${timeString}</div>
            </td>
            <td>${itemsList}</td>
            <td><span class="status" style="background: rgba(255,255,255,0.1);">${sale.method}</span></td>
            <td><strong>${formatMoney(sale.total)}</strong></td>
        `;
        salesBody.appendChild(tr);
    });

    dailyTotalEl.innerText = formatMoney(dailyTotal);
};

// --- AGREGAR PRODUCTO ---
btnAddProduct.addEventListener('click', () => {
    modalAddProduct.classList.add('open');
});

btnCloseModal.addEventListener('click', () => {
    modalAddProduct.classList.remove('open');
    formAddProduct.reset();
});

formAddProduct.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = formAddProduct.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerText = "Guardando en la nube...";

    const name = document.getElementById('prod-name').value;
    const cost = parseFloat(document.getElementById('prod-cost').value);
    const price = parseFloat(document.getElementById('prod-price').value);
    const stock = parseInt(document.getElementById('prod-stock').value);

    const newProduct = {
        name,
        cost,
        price,
        stock
    };

    // Guardar en Supabase
    const { data, error } = await supabaseClient.from('productos').insert([newProduct]).select();
    
    if (!error) {
        // Recargar inventario
        await loadData();
    } else {
        alert("Error al guardar el producto.");
        console.error(error);
    }
    
    submitBtn.disabled = false;
    submitBtn.innerText = "Guardar Producto";
    modalAddProduct.classList.remove('open');
    formAddProduct.reset();
});

// --- NAVEGACIÓN (TABS) ---
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navLinks.forEach(l => l.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        link.classList.add('active');
        const tabId = link.dataset.tab;
        document.getElementById(`${tabId}-tab`).classList.add('active');
    });
});

btnCloseCart.addEventListener('click', () => toggleCart(false));

// Inicialización: Cargar datos de la nube
loadData();
