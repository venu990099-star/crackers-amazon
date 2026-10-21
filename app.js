/**
 * Amazon Crackers Bangalore - Public Customer Storefront Logic
 * 100% Client-Safe: Zero admin code or passwords.
 * Connected directly to Backend SQLite API for Live Stock, Orders & Tracking.
 */

const BANGALORE_AREAS = [
  { name: 'Kengeri', pincode: '560060', hub: 'Central Warehouse Hub', time: 'Express 1-2 Hours (Immediate Local Delivery)' },
  { name: 'Challaghatta', pincode: '560059', hub: 'Kengeri Hub Neighbor', time: 'Express 1-2 Hours (Direct Van Route)' },
  { name: 'Chickpet', pincode: '560053', hub: 'City Commercial Route', time: 'Express 3-4 Hours (Fast Mysore Road Corridor)' },
  { name: 'Majestic', pincode: '560009', hub: 'City Central Route', time: 'Express 3-4 Hours (Fast Mysore Road Corridor)' },
  { name: 'Banashankari', pincode: '560085', hub: 'South-West Corridor', time: 'Express 2-3 Hours (Via Outer Ring Road)' },
  { name: 'Whitefield', pincode: '560066', hub: 'East Corridor Metro Link', time: 'Same-Day / 24 Hours Doorstep Delivery' },
  { name: 'RR Nagar', pincode: '560098', hub: 'Near Kengeri Hub', time: 'Express 2 Hours (Local Area Route)' },
  { name: 'Nagarbhavi', pincode: '560072', hub: 'West Route', time: 'Express 2-3 Hours' },
  { name: 'Nayandahalli', pincode: '560039', hub: 'Mysore Road', time: 'Express 2 Hours' },
  { name: 'Vijayanagar', pincode: '560040', hub: 'West Central', time: 'Express 3 Hours' },
  { name: 'Basavanagudi', pincode: '560004', hub: 'South Central', time: 'Express 3 Hours' }
];

// App State
let products = [];
let cart = {};
let currentCategory = 'all';
let searchQuery = '';
let lastCreatedOrder = null;

document.addEventListener('DOMContentLoaded', () => {
  loadLiveProducts();
  loadCartState();
  setupEventListeners();
  updateCartUI();
});

// Fetch Live Stock from SQLite Backend
async function loadLiveProducts() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    products = data.products || [];
  } catch (e) {
    console.error('Error fetching live products:', e);
    products = [];
  }
  renderProducts();
  renderCombos();
}

function loadCartState() {
  try {
    const saved = localStorage.getItem('amz_crackers_cart');
    if (saved) cart = JSON.parse(saved);
  } catch (e) {
    cart = {};
  }
}

function saveCartState() {
  try {
    localStorage.setItem('amz_crackers_cart', JSON.stringify(cart));
  } catch (e) {
    console.error(e);
  }
}

// Render Combos Section Dynamically
function renderCombos() {
  const container = document.getElementById('combosRow');
  if (!container) return;

  const combos = products.filter(p => p.category === 'combos');

  if (combos.length === 0) {
    container.innerHTML = `
      <div class="empty-stock-notice">
        <i class="fa-solid fa-gift text-orange" style="font-size: 2.8rem; margin-bottom: 0.8rem;"></i>
        <h3>Fresh Diwali Combos Arriving Soon</h3>
        <p>No combo packs have been published yet. Real box photos, assortment lists, and wholesale rates will appear here live once our shipment reaches Kengeri Hub.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = combos.map(prod => {
    const savingsPercent = Math.round(((prod.mrp - prod.price) / prod.mrp) * 100);
    return `
      <div class="amz-combo-item">
        <div class="combo-badge-tag">Family Value Pack</div>
        <img src="${prod.image}" alt="${prod.name}">
        <div class="combo-item-details">
          <h4>${prod.name}</h4>
          <span style="font-size: 0.78rem; color: #565959; margin-bottom: 0.4rem;">${prod.specs || ''}</span>
          <div class="amz-price-row">
            <span class="amz-deal-tag">${savingsPercent}% off</span>
            <span class="amz-rupee">₹${prod.price.toLocaleString('en-IN')}</span>
            <span class="amz-mrp">M.R.P.: <span class="strike">₹${prod.mrp.toLocaleString('en-IN')}</span></span>
          </div>
          <div class="prime-delivery-tag">
            <i class="fa-solid fa-check text-orange"></i> <strong>FREE Express Delivery</strong> from Kengeri Hub
          </div>
          <button class="amz-btn-yellow w-100" onclick="addComboToCart('${prod.id}')">Add to Cart</button>
        </div>
      </div>
    `;
  }).join('');
}

// Render Amazon Product Grid
function renderProducts() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  const countBadge = document.getElementById('itemsFoundCount');

  if (products.length === 0) {
    if (countBadge) countBadge.innerText = '0 items in catalog (Stock arriving soon)';
    grid.innerHTML = `
      <div class="empty-stock-notice">
        <i class="fa-solid fa-boxes-packing text-orange" style="font-size: 3rem; margin-bottom: 1rem;"></i>
        <h3>Fresh Sivakasi Stock Arriving Soon at Kengeri Hub</h3>
        <p>No crackers or prices are posted yet. Whenever our new shipment arrives, real box photos, wholesale prices, and live stock will be published right here.</p>
        <div style="margin-top: 1.2rem;">
          <a href="#kengeri-routes" class="amz-btn-secondary">
            <i class="fa-solid fa-location-dot"></i> Check Kengeri Delivery Routes
          </a>
        </div>
      </div>
    `;
    return;
  }

  const filtered = products.filter(prod => {
    const matchCategory = currentCategory === 'all' || prod.category === currentCategory;
    const matchSearch = searchQuery === '' || 
      prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (prod.specs && prod.specs.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  if (countBadge) {
    countBadge.innerText = `1-${filtered.length} of ${products.length} live items in stock`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; background: #fff; text-align: center; padding: 3rem; border-radius: 4px;">
        <h3>No results found for "${searchQuery}".</h3>
        <p style="color: #565959; font-size: 0.9rem; margin-top: 0.5rem;">Try another search term or view all categories.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(prod => {
    const qty = cart[prod.id] || 0;
    const savingsPercent = Math.round(((prod.mrp - prod.price) / prod.mrp) * 100);
    const isOut = prod.inStock === false;

    // Badges based on admin selection
    let badgeHtml = '';
    if (prod.badge === 'bestseller') {
      badgeHtml = `<div class="amz-badge-bestseller"><i class="fa-solid fa-trophy"></i> #1 Best Seller</div>`;
    } else if (prod.badge === 'choice') {
      badgeHtml = `<div class="amz-badge-choice"><span class="highlight">Amazon's</span> Choice</div>`;
    } else if (prod.badge === 'deal') {
      badgeHtml = `<div class="amz-badge-deal">⚡ Limited Deal</div>`;
    } else if (prod.badge === 'recommended') {
      badgeHtml = `<div class="amz-badge-recommended">★ Highly Recommended</div>`;
    }

    const ratingVal = prod.rating || 4.9;
    const reviewCnt = prod.reviewCount ? `(${prod.reviewCount})` : 'Verified Sivakasi';

    return `
      <div class="amz-product-card ${isOut ? 'out-of-stock' : ''}" id="card-${prod.id}">
        ${badgeHtml}
        <div class="amz-card-thumb" onclick="openProductModal('${prod.id}')" title="Click to view full photos & details">
          <img src="${prod.image}" alt="${prod.name}" loading="lazy">
        </div>
        <h3 class="amz-card-title" onclick="openProductModal('${prod.id}')" title="Click to view full photos & details">${prod.name}</h3>
        <span class="amz-card-specs">${prod.specs || '100% Authentic Sivakasi Stock'}</span>
        
        <div class="amz-card-ratings" onclick="openProductModal('${prod.id}')" style="cursor: pointer;">
          <span class="stars-gold">★★★★★</span>
          <span class="review-count">${ratingVal} ${reviewCnt}</span>
        </div>

        <div class="amz-card-price-box" onclick="openProductModal('${prod.id}')" style="cursor: pointer;">
          <div class="deal-line">
            <span class="deal-tag-red">${savingsPercent}% off</span>
            <span class="deal-label-red">Wholesale Rate</span>
          </div>
          <div class="price-main">₹${prod.price.toLocaleString('en-IN')}</div>
          <div class="mrp-line">M.R.P.: <span class="strike">₹${prod.mrp.toLocaleString('en-IN')}</span></div>
        </div>

        <div class="delivery-promise">
          <i class="fa-solid fa-truck-fast text-orange"></i> <strong>Express Delivery</strong><br>
          <span style="font-size: 0.72rem; color: #565959;">From Kengeri Hub (To Challaghatta & routes)</span>
        </div>

        <div style="margin: 0.4rem 0 0.6rem; text-align: center;">
          <a href="javascript:void(0)" onclick="openProductModal('${prod.id}')" style="font-size: 0.8rem; color: #007185; text-decoration: none; font-weight: 600;">
            <i class="fa-solid fa-circle-info"></i> View Details & Photos
          </a>
        </div>

        <div class="card-actions-row">
          <div class="qty-pill">
            <button ${isOut ? 'disabled' : ''} onclick="updateItemQty('${prod.id}', -1)">-</button>
            <span id="qty-${prod.id}">${qty}</span>
            <button ${isOut ? 'disabled' : ''} onclick="updateItemQty('${prod.id}', 1)">+</button>
          </div>
          <button class="btn-add-amz" ${isOut ? 'disabled' : ''} onclick="updateItemQty('${prod.id}', 1)">
            ${isOut ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Cart Logic
function updateItemQty(productId, delta) {
  const prod = products.find(p => p.id === productId);
  if (prod && prod.inStock === false && delta > 0) {
    showToast('Sorry! This item is currently Out of Stock.');
    return;
  }

  const current = cart[productId] || 0;
  const newQty = Math.max(0, current + delta);

  if (newQty === 0) {
    delete cart[productId];
  } else {
    cart[productId] = newQty;
  }

  saveCartState();
  updateCartUI();

  const qtySpan = document.getElementById(`qty-${productId}`);
  if (qtySpan) qtySpan.innerText = newQty;

  if (delta > 0 && prod) {
    showToast(`Added ${prod.name} to Amazon Cart!`);
  }
}

function addComboToCart(comboId) {
  updateItemQty(comboId, 1);
  openCart();
}

function updateCartUI() {
  let totalItems = 0;
  let totalMrpValue = 0;
  let totalPayable = 0;

  const itemsListEl = document.getElementById('cartItemsList');
  const cartEntries = Object.entries(cart);

  if (cartEntries.length === 0) {
    if (itemsListEl) {
      itemsListEl.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: #565959;">
          <i class="fa-solid fa-cart-shopping" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
          <h3 style="color: #0f1111;">Your Amazon Cart is empty.</h3>
          <p style="font-size: 0.85rem; margin-top: 0.4rem;">Select crackers to place an order!</p>
        </div>
      `;
    }
  } else {
    let itemsHtml = '';
    cartEntries.forEach(([id, qty]) => {
      const prod = products.find(p => p.id === id);
      if (!prod) return;

      totalItems += qty;
      totalMrpValue += (prod.mrp * qty);
      totalPayable += (prod.price * qty);

      itemsHtml += `
        <div class="cart-item-row">
          <div class="cart-item-details">
            <div class="cart-item-name">${prod.name}</div>
            <div class="cart-item-price">₹${prod.price.toLocaleString('en-IN')} × ${qty} = <strong>₹${(prod.price * qty).toLocaleString('en-IN')}</strong></div>
          </div>
          <div class="qty-pill">
            <button onclick="updateItemQty('${prod.id}', -1)">-</button>
            <span>${qty}</span>
            <button onclick="updateItemQty('${prod.id}', 1)">+</button>
          </div>
        </div>
      `;
    });

    if (itemsListEl) itemsListEl.innerHTML = itemsHtml;
  }

  const totalSavings = Math.max(0, totalMrpValue - totalPayable);

  const badge = document.getElementById('cartCountBadge');
  if (badge) badge.innerText = totalItems;

  const drawerCount = document.getElementById('drawerItemsCount');
  if (drawerCount) drawerCount.innerText = `(${totalItems} items)`;

  const checkoutCount = document.getElementById('checkoutItemCount');
  if (checkoutCount) checkoutCount.innerText = totalItems;

  const mrpEl = document.getElementById('totalMrp');
  if (mrpEl) mrpEl.innerText = `₹${totalMrpValue.toLocaleString('en-IN')}`;

  const savingsEl = document.getElementById('totalSavings');
  if (savingsEl) savingsEl.innerText = `-₹${totalSavings.toLocaleString('en-IN')}`;

  const payableEl = document.getElementById('netPayableTotal');
  if (payableEl) payableEl.innerText = `₹${totalPayable.toLocaleString('en-IN')}`;

  const threshold = 2499;
  const progressPercent = Math.min(100, Math.round((totalPayable / threshold) * 100));
  const progressBar = document.getElementById('deliveryProgressBar');
  const progressText = document.getElementById('deliveryProgressText');

  if (progressBar) progressBar.style.width = `${progressPercent}%`;

  if (progressText) {
    if (totalPayable >= threshold) {
      progressText.innerHTML = `🎉 <strong>Congratulations!</strong> You qualify for <strong>FREE Delivery</strong> from Kengeri Hub!`;
    } else {
      const remaining = threshold - totalPayable;
      progressText.innerHTML = `Add ₹${remaining.toLocaleString('en-IN')} for <strong>FREE Delivery</strong> from Kengeri Hub`;
    }
  }
}

// Drawer Open / Close
function openCart() {
  document.getElementById('cartDrawer')?.classList.add('active');
  document.getElementById('cartOverlay')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cartDrawer')?.classList.remove('active');
  document.getElementById('cartOverlay')?.classList.remove('active');
  document.body.style.overflow = '';
}

// Checkout Modal
function openCheckoutModal() {
  const cartEntries = Object.entries(cart);
  if (cartEntries.length === 0) {
    alert('Your cart is empty! Please add crackers before checkout.');
    return;
  }

  let totalItems = 0;
  let totalPayable = 0;
  cartEntries.forEach(([id, qty]) => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    totalItems += qty;
    totalPayable += (prod.price * qty);
  });

  const summaryItems = document.getElementById('modalSummaryItems');
  if (summaryItems) summaryItems.innerText = `${totalItems} Items`;

  const summaryTotal = document.getElementById('modalSummaryTotal');
  if (summaryTotal) summaryTotal.innerText = `₹${totalPayable.toLocaleString('en-IN')}`;

  closeCart();
  document.getElementById('checkoutModalBackdrop')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCheckoutModal() {
  document.getElementById('checkoutModalBackdrop')?.classList.remove('active');
  document.body.style.overflow = '';
}

function handleLocalityChange(locality) {
  const pincodeInput = document.getElementById('orderCustPincode');
  if (!pincodeInput) return;

  const match = BANGALORE_AREAS.find(a => locality.includes(a.name));
  if (match) {
    pincodeInput.value = match.pincode;
  }
}

// Submit Order via Backend API
async function submitNativeOrder(e) {
  e.preventDefault();

  const name = document.getElementById('orderCustName')?.value.trim();
  const phone = document.getElementById('orderCustPhone')?.value.trim();
  const locality = document.getElementById('orderCustLocality')?.value;
  const pincode = document.getElementById('orderCustPincode')?.value.trim();
  const address = document.getElementById('orderCustAddress')?.value.trim();
  const notes = document.getElementById('orderNotes')?.value.trim();
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'Cash on Delivery (COD)';

  const cartEntries = Object.entries(cart);
  if (cartEntries.length === 0) return;

  let orderItems = [];
  let totalPayable = 0;
  let totalMrp = 0;

  cartEntries.forEach(([id, qty]) => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    orderItems.push({
      id: prod.id,
      name: prod.name,
      qty: qty,
      price: prod.price,
      mrp: prod.mrp
    });
    totalPayable += (prod.price * qty);
    totalMrp += (prod.mrp * qty);
  });

  const orderPayload = {
    customerName: name,
    phone: phone,
    locality: locality,
    pincode: pincode,
    address: address,
    notes: notes,
    paymentMethod: paymentMethod,
    items: orderItems,
    totalMrp: totalMrp,
    totalPayable: totalPayable
  };

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });
    const data = await res.json();

    if (data.success && data.orderId) {
      lastCreatedOrder = { ...orderPayload, id: data.orderId };

      cart = {};
      saveCartState();
      updateCartUI();
      renderProducts();

      closeCheckoutModal();

      const orderBadge = document.getElementById('createdOrderId');
      if (orderBadge) orderBadge.innerText = data.orderId;

      document.getElementById('orderSuccessModalBackdrop')?.classList.add('active');
    } else {
      alert(data.error || 'Could not place order. Please check inputs.');
    }
  } catch (err) {
    alert('Server connection error. Please try again.');
  }
}

function closeSuccessModal() {
  document.getElementById('orderSuccessModalBackdrop')?.classList.remove('active');
  document.body.style.overflow = '';
}

function trackFromSuccessModal() {
  closeSuccessModal();
  if (lastCreatedOrder) {
    const trackInput = document.getElementById('trackSearchInput');
    if (trackInput) trackInput.value = lastCreatedOrder.id;
    searchOrderStatus();
    document.getElementById('track-section')?.scrollIntoView({ behavior: 'smooth' });
  }
}

function sendOrderSummaryToWhatsapp() {
  if (!lastCreatedOrder) return;
  const o = lastCreatedOrder;
  let itemsText = '';
  o.items.forEach((item, idx) => {
    itemsText += `${idx + 1}. ${item.name} x ${item.qty} = ₹${(item.price * item.qty).toLocaleString('en-IN')}\n`;
  });

  const msg = 
`🎆 *AMAZON CRACKERS BANGALORE - ORDER: ${o.id}* 🎆
👤 Customer: ${o.customerName}
📞 Phone: ${o.phone}
📍 Locality: ${o.locality} (${o.pincode})
🏠 Address: ${o.address}
💳 Payment: ${o.paymentMethod}

🛒 ITEMS:
${itemsText}
💰 Total Amount: ₹${o.totalPayable.toLocaleString('en-IN')}

Please share live tracking updates on this WhatsApp number!`;

  window.open(`https://wa.me/918431027743?text=${encodeURIComponent(msg)}`, '_blank');
}

// Package Tracking via SQLite Backend API
async function searchOrderStatus() {
  const input = document.getElementById('trackSearchInput');
  const query = input?.value.trim().toUpperCase();
  const resultBox = document.getElementById('trackingResultBox');
  if (!resultBox) return;

  if (!query) {
    resultBox.style.display = 'block';
    resultBox.innerHTML = `<p style="color: #cc0c39; font-weight: 700;">Please enter your Order ID (e.g. BLR-1001) or 10-digit Phone Number.</p>`;
    return;
  }

  resultBox.style.display = 'block';
  resultBox.innerHTML = `<p style="color: #565959;"><i class="fa-solid fa-spinner fa-spin"></i> Fetching live package status...</p>`;

  try {
    const isId = query.startsWith('BLR-') || query.includes('-');
    const param = isId ? `id=${encodeURIComponent(query)}` : `phone=${encodeURIComponent(query)}`;
    const res = await fetch(`/api/orders/track?${param}`);
    const data = await res.json();

    if (!data.success || !data.order) {
      resultBox.innerHTML = `
        <div style="text-align: right; margin-bottom: 0.5rem;">
          <button class="btn-close-tracking" onclick="closeTrackingBox()"><i class="fa-solid fa-xmark"></i> Close</button>
        </div>
        <div style="text-align: center; color: #565959; padding: 1.5rem;">
          <h4>No package found for "${query}"</h4>
          <p style="font-size: 0.85rem; margin-top: 0.4rem;">Check your Order ID (e.g. BLR-1001) or registered phone number.</p>
        </div>
      `;
      return;
    }

    const order = data.order;
    const estDelivery = order.estimatedDelivery || 'Today / Tomorrow (Fast Kengeri Route)';

    resultBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #d5d9d9; padding-bottom: 0.8rem; margin-bottom: 1rem;">
        <div>
          <h3 style="font-size: 1.3rem; color: #0f1111; margin: 0;">Order #${order.id}</h3>
          <span style="font-size: 0.8rem; color: #565959;">Placed on: ${order.timestamp}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span style="background: #e7f4e8; color: #067d62; padding: 0.3rem 0.8rem; border-radius: 4px; font-weight: 700; font-size: 0.85rem;">
            ${order.status.toUpperCase().replace(/_/g, ' ')}
          </span>
          <button class="btn-close-tracking" onclick="closeTrackingBox()" title="Dismiss tracking box"><i class="fa-solid fa-xmark"></i> Close Tracker</button>
        </div>
      </div>

      <!-- Real-time Location and Delivery Time from Seller -->
      <div style="background: #fff; border: 1px solid #ff9900; border-radius: 4px; padding: 1rem; margin-bottom: 1rem;">
        <div style="margin-bottom: 0.5rem;">
          <strong style="color: #c45500;"><i class="fa-solid fa-clock"></i> Estimated Delivery Time:</strong>
          <span style="font-size: 1rem; font-weight: 700; color: #0f1111; margin-left: 0.4rem;">${estDelivery}</span>
        </div>
        <div>
          <strong style="color: #c45500;"><i class="fa-solid fa-location-dot"></i> Live Van Location from Kengeri Hub:</strong>
          <p style="font-size: 0.95rem; color: #0f1111; margin-top: 0.2rem;">${order.liveLocation || 'Order is being processed at Kengeri Central Warehouse.'}</p>
        </div>
      </div>

      <div style="font-size: 0.85rem; color: #565959;">
        <strong>Delivery Destination:</strong> ${order.customerName} • ${order.locality} (${order.pincode}) • ${order.address}<br>
        <strong>Payment:</strong> ${order.paymentMethod} • Total: <strong style="color: #b12704;">₹${order.totalPayable.toLocaleString('en-IN')}</strong>
      </div>
    `;
  } catch (err) {
    resultBox.innerHTML = `
      <div style="text-align: right; margin-bottom: 0.5rem;">
        <button class="btn-close-tracking" onclick="closeTrackingBox()"><i class="fa-solid fa-xmark"></i> Close</button>
      </div>
      <p style="color: #cc0c39;">Could not connect to tracking server. Please try again.</p>
    `;
  }
}

function closeTrackingBox() {
  const resultBox = document.getElementById('trackingResultBox');
  if (resultBox) {
    resultBox.innerHTML = '';
    resultBox.style.display = 'none';
  }
  const input = document.getElementById('trackSearchInput');
  if (input) input.value = '';
}

// Category / Filter Controls
function setCategoryFilter(category) {
  currentCategory = category;
  document.querySelectorAll('.tab-chip').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-category') === category);
  });
  renderProducts();
}

function filterByCategory(category) {
  setCategoryFilter(category);
  document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
}

function onCategorySelectChange(val) {
  setCategoryFilter(val);
}

function triggerSearch() {
  const input = document.getElementById('catalogSearchInput');
  if (input) {
    searchQuery = input.value.trim();
    renderProducts();
    document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
  }
}

function scrollToLocationChecker() {
  document.getElementById('kengeri-routes')?.scrollIntoView({ behavior: 'smooth' });
}

function scrollToTracking() {
  document.getElementById('track-section')?.scrollIntoView({ behavior: 'smooth' });
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// Setup Event Listeners
function setupEventListeners() {
  document.getElementById('closeCartBtn')?.addEventListener('click', closeCart);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCart);

  const searchInput = document.getElementById('catalogSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderProducts();
    });
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') triggerSearch();
    });
  }

  const pincodeBtn = document.getElementById('checkPincodeBtn');
  const pincodeInput = document.getElementById('pincodeInput');
  if (pincodeBtn && pincodeInput) {
    pincodeBtn.addEventListener('click', () => {
      checkBangaloreArea(pincodeInput.value);
    });
    pincodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') checkBangaloreArea(pincodeInput.value);
    });
  }

  document.getElementById('backToTopBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function checkBangaloreArea(query) {
  const resultEl = document.getElementById('pincodeResult');
  if (!resultEl) return;

  const cleanQuery = query.toLowerCase().trim();
  if (!cleanQuery) {
    resultEl.style.display = 'block';
    resultEl.innerText = 'Please enter an area name (e.g. Kengeri, Challaghatta, Chickpet, Majestic, Banashankari, Whitefield) or 6-digit Pincode.';
    return;
  }

  const match = BANGALORE_AREAS.find(a => 
    a.name.toLowerCase().includes(cleanQuery) || 
    a.pincode === cleanQuery
  );

  resultEl.style.display = 'block';
  if (match) {
    resultEl.innerHTML = `
      <strong><i class="fa-solid fa-circle-check text-green"></i> Direct Delivery Available for ${match.name} (${match.pincode})!</strong><br>
      🚚 <strong>Speed:</strong> ${match.time} (Dispatched directly from Kengeri Central Warehouse).
    `;
    const locDisplay = document.getElementById('currentLocalityDisplay');
    if (locDisplay) locDisplay.innerText = `${match.name} ▼`;
  } else {
    resultEl.innerHTML = `
      <strong><i class="fa-solid fa-truck-fast text-orange"></i> Yes! Express Delivery Available across Bengaluru!</strong><br>
      🚚 Dispatched from Kengeri Central Warehouse within 24 hours.
    `;
  }
}

// -------------------------------------------------------------
// Amazon Interactive Product Detail Modal & Reviews Logic
// -------------------------------------------------------------
let currentModalProductId = null;
let currentModalSelectedRating = 5;

async function openProductModal(productId) {
  currentModalProductId = productId;
  const modalBackdrop = document.getElementById('productModalBackdrop');
  const modalBody = document.getElementById('productModalBody');
  if (!modalBackdrop || !modalBody) return;

  modalBody.innerHTML = `
    <div style="text-align: center; padding: 4rem 1rem;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 2.5rem; color: #ff9900; margin-bottom: 1rem;"></i>
      <h3 style="color: #0f1111;">Loading cracker photos & specifications...</h3>
    </div>
  `;
  modalBackdrop.classList.add('active');
  document.body.style.overflow = 'hidden';

  try {
    const res = await fetch(`/api/products/${productId}`);
    const data = await res.json();
    if (!data.success || !data.product) {
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 3rem;">
          <h3>Product details not found</h3>
          <button class="btn btn-outline" onclick="closeProductModal()">Close</button>
        </div>
      `;
      return;
    }

    const prod = data.product;
    const images = (prod.images && prod.images.length > 0) ? prod.images : [prod.image];
    const isOut = prod.inStock === false;
    const savingsPercent = Math.round(((prod.mrp - prod.price) / prod.mrp) * 100);
    const savingsAmount = prod.mrp - prod.price;
    const reviews = prod.reviews || [];
    const ratingVal = prod.rating || 4.9;
    const reviewCount = prod.reviewCount || reviews.length;

    // Badges
    let badgeHtml = '';
    if (prod.badge === 'bestseller') {
      badgeHtml = `<span class="amz-badge-bestseller"><i class="fa-solid fa-trophy"></i> #1 Best Seller in Diwali Crackers</span>`;
    } else if (prod.badge === 'choice') {
      badgeHtml = `<span class="amz-badge-choice"><span class="highlight">Amazon's</span> Choice</span>`;
    } else if (prod.badge === 'deal') {
      badgeHtml = `<span class="amz-badge-deal">⚡ Limited Time Festival Deal</span>`;
    } else if (prod.badge === 'recommended') {
      badgeHtml = `<span class="amz-badge-recommended">★ Highly Recommended</span>`;
    }

    const catLabels = {
      aerial: 'Sky Shots & Aerial Celebrations',
      sparklers: 'Sparklers & Lights',
      flowerpots: 'Flower Pots / Anar',
      chakkars: 'Ground Chakkars & Spinners',
      kids: 'Kids Novelties',
      combos: 'Diwali Family Combos'
    };
    const catName = catLabels[prod.category] || 'Direct Sivakasi Crackers';

    const thumbsHtml = images.map((imgUrl, idx) => `
      <div class="modal-thumb-item ${idx === 0 ? 'active' : ''}" onclick="switchModalImage('${imgUrl}', this)">
        <img src="${imgUrl}" alt="${prod.name} photo ${idx + 1}">
      </div>
    `).join('');

    let reviewsListHtml = '';
    if (reviews.length === 0) {
      reviewsListHtml = `
        <div style="padding: 1rem 0; color: #565959; font-size: 0.9rem;">
          <p>No customer reviews yet. Be the first customer in Bangalore to review this cracker box!</p>
        </div>
      `;
    } else {
      reviewsListHtml = reviews.map(rev => `
        <div class="review-item-card">
          <div class="review-user-row">
            <i class="fa-solid fa-circle-user" style="color: #888; font-size: 1.2rem;"></i>
            <span>${rev.customer_name}</span>
            <span class="verified-tag"><i class="fa-solid fa-circle-check"></i> Verified Bangalore Purchase</span>
          </div>
          <div style="margin: 0.3rem 0; display: flex; align-items: center; gap: 0.5rem;">
            <span class="stars-gold">${'★'.repeat(rev.rating)}${'☆'.repeat(5 - rev.rating)}</span>
            <strong style="font-size: 0.88rem; color: #0f1111;">${rev.title || 'Great Diwali Cracker!'}</strong>
          </div>
          <p style="font-size: 0.85rem; color: #333; line-height: 1.4; margin: 0.2rem 0;">${rev.comment}</p>
          <span style="font-size: 0.75rem; color: #888;">Reviewed on ${rev.created_at || 'Verified Date'}</span>
        </div>
      `).join('');
    }

    modalBody.innerHTML = `
      <div class="modal-breadcrumb">
        <span>Amazon Crackers</span> &gt; <span>${catName}</span> &gt; <span>${prod.name}</span>
      </div>

      <div class="product-modal-grid">
        <!-- Left: Image Gallery with Thumbnails -->
        <div class="modal-gallery-wrap">
          <div class="modal-main-img-box" id="modalMainImageBox">
            <img id="modalMainImg" src="${images[0]}" alt="${prod.name}">
          </div>
          ${images.length > 1 ? `<div class="modal-thumb-strip">${thumbsHtml}</div>` : ''}
          <div style="font-size: 0.78rem; color: #565959; text-align: center; margin-top: 0.4rem;">
            <i class="fa-solid fa-shield-halved text-green"></i> 100% Genuine Box Direct from Sivakasi Factory • Dispatch via Kengeri Hub
          </div>
        </div>

        <!-- Right: Details & Buy Box -->
        <div class="modal-details-wrap">
          ${badgeHtml ? `<div class="modal-badge-row">${badgeHtml}</div>` : ''}
          <h2 class="modal-title">${prod.name}</h2>
          
          <div class="modal-ratings-row">
            <span class="stars-gold">★★★★★</span>
            <span style="font-size: 0.9rem; font-weight: 700; color: #007185;">${ratingVal} out of 5 stars</span>
            <span style="color: #565959; font-size: 0.85rem;">(${reviewCount} verified customer ratings)</span>
          </div>

          <div class="modal-price-box">
            <span class="modal-deal-badge">${savingsPercent}% OFF Wholesale Deal</span>
            <div class="modal-price-main">
              <span class="curr">₹</span>
              <span class="val">${prod.price.toLocaleString('en-IN')}</span>
            </div>
            <div class="modal-mrp-strike">
              M.R.P.: <span style="text-decoration: line-through;">₹${prod.mrp.toLocaleString('en-IN')}</span>
            </div>
            <div class="modal-savings-highlight">
              You Save: ₹${savingsAmount.toLocaleString('en-IN')} (${savingsPercent}% Direct Factory Discount)
            </div>
            <div style="font-size: 0.76rem; color: #565959; margin-top: 0.3rem;">
              Inclusive of all festival taxes • Doorstep delivery available
            </div>
          </div>

          <!-- Specs Table -->
          <table class="modal-specs-table">
            <tbody>
              <tr>
                <td class="spec-label">Product Type</td>
                <td class="spec-val"><strong>${catName}</strong></td>
              </tr>
              <tr>
                <td class="spec-label">Box Packaging</td>
                <td class="spec-val">${prod.specs || 'Standard Sivakasi Factory Pack'}</td>
              </tr>
              <tr>
                <td class="spec-label">Dispatched From</td>
                <td class="spec-val">Amazon Crackers Kengeri Central Warehouse, Bangalore</td>
              </tr>
              <tr>
                <td class="spec-label">Authenticity</td>
                <td class="spec-val"><i class="fa-solid fa-circle-check text-green"></i> 100% Original Sivakasi Quality Checked</td>
              </tr>
            </tbody>
          </table>

          <!-- About this item / Description -->
          <div class="modal-about-item">
            <h4>About this item</h4>
            <p>${prod.description || `${prod.name} is manufactured directly in Sivakasi with stringent quality standards. Designed for high performance, vivid colors, and thrilling celebrations. Delivered fresh and safe to your doorstep across Bangalore.`}</p>
          </div>

          <!-- Buy Box Actions -->
          <div class="modal-buy-box">
            <div class="modal-stock-status" style="color: ${isOut ? '#cc0c39' : '#067d62'};">
              ${isOut ? '● Currently Out of Stock' : '● In Stock. Ships same-day from Kengeri Hub.'}
            </div>
            <div class="modal-delivery-promise">
              <i class="fa-solid fa-truck-fast text-orange"></i> <strong>Fast Doorstep Delivery</strong> across Kengeri, Challaghatta, Chickpet, Majestic, Banashankari, and Whitefield.
            </div>

            <div class="modal-actions-row">
              <button class="btn-modal-cart" ${isOut ? 'disabled' : ''} onclick="updateItemQty('${prod.id}', 1)">
                <i class="fa-solid fa-cart-shopping"></i> Add to Cart
              </button>
              <button class="btn-modal-buy" ${isOut ? 'disabled' : ''} onclick="buyNowFromModal('${prod.id}')">
                <i class="fa-solid fa-bolt"></i> Buy Now (Express Checkout)
              </button>
              <a href="https://wa.me/918431027743?text=Namaskara%20Amazon%20Crackers%2C%20I%20want%20to%20order%20${encodeURIComponent(prod.name)}%20(Price%3A%20₹${prod.price})" target="_blank" class="btn-modal-whatsapp">
                <i class="fa-brands fa-whatsapp" style="font-size: 1.2rem;"></i> Order Directly on WhatsApp (+91 84310 27743)
              </a>
            </div>
          </div>

        </div>
      </div>

      <!-- Customer Reviews & Rating Section -->
      <div class="modal-reviews-section">
        <h3 style="font-size: 1.25rem; font-weight: 700; color: #0f1111; margin-bottom: 1rem;">
          Customer Reviews & Verified Ratings
        </h3>
        
        <div class="reviews-grid-wrap">
          <!-- Left: Write a Review Form -->
          <div class="write-review-card">
            <h4 style="font-size: 1rem; color: #0f1111; margin-bottom: 0.4rem;">Rate this Product</h4>
            <p style="font-size: 0.82rem; color: #565959; margin-bottom: 0.8rem;">Share your festival feedback with Bangalore buyers:</p>
            
            <form onsubmit="handleCustomerReviewSubmit(event, '${prod.id}')">
              <div style="margin-bottom: 0.8rem;">
                <label style="font-size: 0.82rem; font-weight: 700; color: #333; display: block;">Your Name *</label>
                <input type="text" id="reviewAuthor" required placeholder="e.g. Ramesh Kumar, Kengeri" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85rem;">
              </div>

              <div style="margin-bottom: 0.8rem;">
                <label style="font-size: 0.82rem; font-weight: 700; color: #333; display: block;">Overall Rating *</label>
                <div class="star-rating-select" id="starRatingSelect">
                  <span class="star selected" data-value="1" onclick="setStarRating(1)">★</span>
                  <span class="star selected" data-value="2" onclick="setStarRating(2)">★</span>
                  <span class="star selected" data-value="3" onclick="setStarRating(3)">★</span>
                  <span class="star selected" data-value="4" onclick="setStarRating(4)">★</span>
                  <span class="star selected" data-value="5" onclick="setStarRating(5)">★</span>
                </div>
              </div>

              <div style="margin-bottom: 0.8rem;">
                <label style="font-size: 0.82rem; font-weight: 700; color: #333; display: block;">Headline (Optional)</label>
                <input type="text" id="reviewTitle" placeholder="e.g. Super sound and vibrant colors!" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85rem;">
              </div>

              <div style="margin-bottom: 1rem;">
                <label style="font-size: 0.82rem; font-weight: 700; color: #333; display: block;">Your Review *</label>
                <textarea id="reviewComment" required rows="3" placeholder="Tell customers how this cracker performed..." style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85rem;"></textarea>
              </div>

              <button type="submit" class="amz-btn-yellow" style="width: 100%; padding: 0.6rem; font-weight: 700;">
                Submit Customer Review
              </button>
            </form>
          </div>

          <!-- Right: Existing Reviews -->
          <div>
            <div style="display: flex; align-items: baseline; gap: 0.8rem; margin-bottom: 1rem;">
              <span style="font-size: 2.2rem; font-weight: 700; color: #0f1111;">${ratingVal}</span>
              <span class="stars-gold" style="font-size: 1.3rem;">★★★★★</span>
              <span style="color: #565959; font-size: 0.9rem;">based on ${reviewCount} customer reviews</span>
            </div>
            
            <div id="reviewsListContainer">
              ${reviewsListHtml}
            </div>
          </div>
        </div>
      </div>
    `;

    currentModalSelectedRating = 5;
  } catch (err) {
    modalBody.innerHTML = `
      <div style="text-align: center; padding: 3rem;">
        <h3>Could not load product details. Please check your internet connection.</h3>
        <button class="btn btn-outline" onclick="closeProductModal()">Close</button>
      </div>
    `;
  }
}

function switchModalImage(imgUrl, thumbEl) {
  const mainImg = document.getElementById('modalMainImg');
  if (mainImg) mainImg.src = imgUrl;

  document.querySelectorAll('.modal-thumb-item').forEach(el => el.classList.remove('active'));
  if (thumbEl) thumbEl.classList.add('active');
}

function closeProductModal() {
  const modalBackdrop = document.getElementById('productModalBackdrop');
  if (modalBackdrop) modalBackdrop.classList.remove('active');
  document.body.style.overflow = '';
}

function handleProductModalBackdropClick(event) {
  if (event.target.id === 'productModalBackdrop') {
    closeProductModal();
  }
}

function setStarRating(val) {
  currentModalSelectedRating = val;
  const stars = document.querySelectorAll('#starRatingSelect .star');
  stars.forEach(star => {
    const starVal = parseInt(star.getAttribute('data-value'), 10);
    star.classList.toggle('selected', starVal <= val);
  });
}

async function handleCustomerReviewSubmit(event, productId) {
  event.preventDefault();
  const customerName = document.getElementById('reviewAuthor')?.value.trim();
  const title = document.getElementById('reviewTitle')?.value.trim();
  const comment = document.getElementById('reviewComment')?.value.trim();

  if (!customerName || !comment) {
    alert('Please enter your name and review comment.');
    return;
  }

  try {
    const res = await fetch(`/api/products/${productId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName,
        rating: currentModalSelectedRating,
        title,
        comment
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Thank you! Your customer review was published successfully.');
      openProductModal(productId);
      loadProductsFromBackend();
    } else {
      alert(data.error || 'Failed to submit review.');
    }
  } catch (err) {
    alert('Network error submitting review.');
  }
}

function buyNowFromModal(productId) {
  updateItemQty(productId, 1);
  closeProductModal();
  openCart();
  setTimeout(() => {
    openCheckout();
  }, 250);
}
