// =============================================================
// Amazon Crackers Bangalore - Dedicated Product Detail Page JS
// Handles: Multi-photo gallery, specs, buy box, related items,
// star ratings, review submission, cart drawer, checkout modal.
// =============================================================

const WHATSAPP_PHONE = '918431027743';
const CART_STORAGE_KEY = 'amz_crackers_cart';

let currentProduct = null;
let allProducts = [];
let cart = {}; // { productId: qty }
let currentSelectedRating = 5;
let pageQuantity = 1;
let lastCreatedOrder = null;

// On Page Load
document.addEventListener('DOMContentLoaded', async () => {
  loadCartState();
  updateCartBadge();

  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  if (!productId) {
    showToast('No product specified. Returning to home catalog...', 'error');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);
    return;
  }

  // Fetch product detail and catalog concurrently
  await Promise.all([
    fetchProductDetails(productId),
    fetchAllProductsForRelated(productId)
  ]);
});

// -------------------------------------------------------------
// Cart Storage & State Management
// -------------------------------------------------------------
function loadCartState() {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    cart = saved ? JSON.parse(saved) : {};
  } catch (e) {
    cart = {};
  }
}

function saveCartState() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (e) {
    console.error('Failed to save cart:', e);
  }
}

function updateCartBadge() {
  const totalCount = Object.values(cart).reduce((sum, q) => sum + q, 0);
  const badge = document.getElementById('cartCountBadge');
  if (badge) {
    badge.innerText = totalCount;
  }
  const drawerCount = document.getElementById('drawerItemsCount');
  if (drawerCount) {
    drawerCount.innerText = `(${totalCount} item${totalCount === 1 ? '' : 's'})`;
  }
}

// -------------------------------------------------------------
// 1. Fetch & Render Main Product
// -------------------------------------------------------------
async function fetchProductDetails(productId) {
  try {
    const res = await fetch(`/api/products/${encodeURIComponent(productId)}`);
    const data = await res.json();

    if (!data.success || !data.product) {
      document.getElementById('productTitle').innerText = 'Product Not Found';
      document.getElementById('productDescription').innerText = 'This cracker might be sold out or discontinued.';
      showToast('Product not found in Bangalore inventory', 'error');
      return;
    }

    currentProduct = data.product;
    renderProductPage(currentProduct);
  } catch (err) {
    console.error('Error fetching product:', err);
    showToast('Could not load cracker details. Check connection.', 'error');
  }
}

function renderProductPage(prod) {
  // 1. Page Title & Breadcrumbs
  document.title = `${prod.name} | Sivakasi Direct Wholesale - Amazon Crackers Bangalore`;
  const crumbTitle = document.getElementById('crumbTitle');
  if (crumbTitle) crumbTitle.innerText = prod.name;
  
  const crumbCategory = document.getElementById('crumbCategory');
  if (crumbCategory) crumbCategory.innerText = prod.category || 'Crackers';

  // 2. Images & Thumbnail Gallery
  renderImageGallery(prod);

  // 3. Amazon Promotional Badges
  const badgeContainer = document.getElementById('badgeContainer');
  if (badgeContainer) {
    badgeContainer.innerHTML = getBadgeHtml(prod.badge);
  }

  // 4. Product Title & Ratings
  const titleEl = document.getElementById('productTitle');
  if (titleEl) titleEl.innerText = prod.name;

  const avgRating = prod.rating || 4.9;
  const revCount = prod.reviewCount !== undefined ? prod.reviewCount : (prod.reviews ? prod.reviews.length : 0);

  const starsEl = document.getElementById('productStars');
  if (starsEl) starsEl.innerHTML = generateStarsHtml(avgRating);

  const ratingScoreEl = document.getElementById('productRatingScore');
  if (ratingScoreEl) ratingScoreEl.innerText = `${avgRating} out of 5`;

  const reviewLinkEl = document.getElementById('productReviewCountLink');
  if (reviewLinkEl) {
    reviewLinkEl.innerText = revCount > 0 ? `(${revCount} customer rating${revCount === 1 ? '' : 's'})` : `(No reviews yet)`;
  }

  // 5. Wholesale Pricing & Savings
  const mrp = prod.mrp || Math.round(prod.price * 2);
  const price = prod.price || 0;
  const savings = Math.max(0, mrp - price);
  const discountPct = mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 50;

  const discountBadge = document.getElementById('discountBadge');
  if (discountBadge) discountBadge.innerText = `${discountPct}% OFF Wholesale Deal`;

  const priceEl = document.getElementById('productPrice');
  if (priceEl) priceEl.innerText = price.toLocaleString('en-IN');

  const mrpEl = document.getElementById('productMrp');
  if (mrpEl) mrpEl.innerText = `₹${mrp.toLocaleString('en-IN')}`;

  const savingsEl = document.getElementById('productSavings');
  if (savingsEl) {
    savingsEl.innerHTML = `You Save: ₹${savings.toLocaleString('en-IN')} (${discountPct}% Direct Sivakasi Factory Discount)`;
  }

  // 6. Specifications
  const specCat = document.getElementById('specCategory');
  if (specCat) specCat.innerText = prod.category || 'Diwali Crackers';

  const specPack = document.getElementById('specPackage');
  if (specPack) specPack.innerText = prod.specs ? `1 Box (${prod.specs})` : '1 Box Standard Pack';

  // 7. About Item / Description
  const descEl = document.getElementById('productDescription');
  if (descEl) {
    descEl.innerText = prod.description || 
      `Direct 100% genuine Sivakasi factory manufacturing with zero middleman markup.\nTested for premium brightness, intense sound clarity, and child-safe chemical composition.\nPackaged in weather-proof moisture-resistant boxes, dispatched directly from our Kengeri Central Warehouse across all Bangalore delivery corridors.`;
  }

  // 8. Buy Box
  const buyBoxPrice = document.getElementById('buyBoxPrice');
  if (buyBoxPrice) buyBoxPrice.innerText = `₹${price.toLocaleString('en-IN')}`;

  const stickyPrice = document.getElementById('stickyPriceVal');
  if (stickyPrice) stickyPrice.innerText = `₹${price.toLocaleString('en-IN')}`;

  const buyBoxStock = document.getElementById('buyBoxStock');
  if (buyBoxStock) {
    if (prod.inStock !== false) {
      buyBoxStock.innerHTML = `<span style="color: #067d62;">● In Stock (Ready for Dispatch from Kengeri)</span>`;
    } else {
      buyBoxStock.innerHTML = `<span style="color: #b12704;">● Currently Out of Stock</span>`;
      const cartBtn = document.getElementById('btnPageAddToCart');
      const buyBtn = document.getElementById('btnPageBuyNow');
      if (cartBtn) cartBtn.disabled = true;
      if (buyBtn) buyBtn.disabled = true;
      const stickyCart = document.querySelector('.sticky-btn-cart');
      const stickyBuy = document.querySelector('.sticky-btn-buy');
      if (stickyCart) stickyCart.disabled = true;
      if (stickyBuy) stickyBuy.disabled = true;
    }
  }

  updateWhatsAppLink(prod);

  // 9. Customer Ratings Overview & Reviews List
  renderReviewsSection(prod);
}

// -------------------------------------------------------------
// Image Gallery Handler
// -------------------------------------------------------------
function renderImageGallery(prod) {
  const mainImg = document.getElementById('mainDisplayImg');
  const thumbStrip = document.getElementById('thumbStrip');
  if (!mainImg || !thumbStrip) return;

  let images = [];
  if (Array.isArray(prod.images) && prod.images.length > 0) {
    images = prod.images;
  } else if (prod.image) {
    images = [prod.image];
  } else {
    images = ['images/hero-banner.jpg'];
  }

  mainImg.src = images[0];
  mainImg.alt = prod.name;

  thumbStrip.innerHTML = '';
  images.forEach((imgUrl, idx) => {
    const thumb = document.createElement('div');
    thumb.className = `p-thumb-item ${idx === 0 ? 'active' : ''}`;
    thumb.title = `Photo ${idx + 1}`;
    thumb.innerHTML = `<img src="${imgUrl}" alt="${prod.name} thumbnail ${idx + 1}" onerror="this.src='images/hero-banner.jpg'">`;
    thumb.onclick = () => {
      mainImg.src = imgUrl;
      document.querySelectorAll('.p-thumb-item').forEach(el => el.classList.remove('active'));
      thumb.classList.add('active');
    };
    thumbStrip.appendChild(thumb);
  });
}

function getBadgeHtml(badge) {
  if (!badge) return '';
  switch (badge.toLowerCase()) {
    case 'bestseller':
      return `<span class="p-badge-bestseller"><i class="fa-solid fa-ribbon"></i> #1 Best Seller in Diwali Crackers</span>`;
    case 'amazon_choice':
      return `<span class="p-badge-choice"><span class="highlight">Amazon's</span> Choice</span>`;
    case 'deal':
      return `<span class="p-badge-deal"><i class="fa-solid fa-bolt"></i> Festive Deal • 50% Wholesale</span>`;
    case 'recommended':
      return `<span class="p-badge-recommended"><i class="fa-solid fa-star"></i> Sivakasi Recommended</span>`;
    default:
      return `<span class="p-badge-bestseller">${badge}</span>`;
  }
}

function generateStarsHtml(rating) {
  const fullStars = Math.floor(rating);
  const halfStar = (rating % 1) >= 0.4 ? 1 : 0;
  const emptyStars = Math.max(0, 5 - fullStars - halfStar);

  let html = '';
  for (let i = 0; i < fullStars; i++) html += '<i class="fa-solid fa-star text-gold"></i>';
  if (halfStar) html += '<i class="fa-solid fa-star-half-stroke text-gold"></i>';
  for (let i = 0; i < emptyStars; i++) html += '<i class="fa-regular fa-star text-gold"></i>';
  return html;
}

// -------------------------------------------------------------
// WhatsApp Ordering Direct Link
// -------------------------------------------------------------
function updateWhatsAppLink(prod) {
  const waBtn = document.getElementById('btnPageWhatsApp');
  if (!waBtn || !prod) return;

  const msg = `Namaskara Amazon Crackers Bangalore!\nI want to order: ${prod.name}\nQuantity: ${pageQuantity} Box(es)\nPrice: ₹${prod.price} each (Total: ₹${prod.price * pageQuantity})\nDelivery Locality: Bangalore\nPlease confirm availability and dispatch from Kengeri Hub.`;
  waBtn.href = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`;
}

// -------------------------------------------------------------
// 2. Related Products Shelf ("Customers also viewed")
// -------------------------------------------------------------
async function fetchAllProductsForRelated(currentId) {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.success && Array.isArray(data.products)) {
      allProducts = data.products;
      renderRelatedProducts(currentId);
    }
  } catch (err) {
    console.error('Error fetching catalog for related items:', err);
  }
}

function renderRelatedProducts(currentId) {
  const grid = document.getElementById('relatedProductsGrid');
  if (!grid) return;

  const related = allProducts.filter(p => p.id !== currentId).slice(0, 4);
  if (related.length === 0) {
    grid.innerHTML = '<p style="color: #565959; font-size: 0.9rem;">Browse our complete catalog on the home page.</p>';
    return;
  }

  grid.innerHTML = related.map(prod => {
    const imgUrl = (prod.images && prod.images.length > 0) ? prod.images[0] : (prod.image || 'images/hero-banner.jpg');
    const mrp = prod.mrp || Math.round(prod.price * 2);
    const discount = mrp > 0 ? Math.round(((mrp - prod.price) / mrp) * 100) : 50;
    const badgeHtml = prod.badge === 'bestseller' 
      ? '<span style="background: #e67a00; color: #fff; font-size: 0.65rem; font-weight: 800; padding: 2px 6px; border-radius: 2px;">#1 Best Seller</span>' 
      : '';

    return `
      <div class="amz-product-card" style="margin: 0; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onclick="goToRelatedProduct('${prod.id}')">
        <div style="height: 180px; background: #fafafa; display: flex; align-items: center; justify-content: center; overflow: hidden; border-bottom: 1px solid #f0f0f0;">
          <img src="${imgUrl}" alt="${prod.name}" style="max-height: 100%; max-width: 100%; object-fit: contain;" onerror="this.src='images/hero-banner.jpg'">
        </div>
        <div style="padding: 0.8rem; display: flex; flex-direction: column; gap: 0.3rem;">
          <div style="height: 18px;">${badgeHtml}</div>
          <h4 style="font-size: 0.92rem; font-weight: 700; color: #007185; line-height: 1.3; height: 2.6rem; overflow: hidden; margin: 0;">${prod.name}</h4>
          <div style="font-size: 0.8rem; color: #de7921;">★★★★★ <span style="color: #565959;">(4.9)</span></div>
          <div style="display: flex; align-items: baseline; gap: 0.4rem; margin-top: 0.2rem;">
            <span style="font-size: 1.15rem; font-weight: 800; color: #b12704;">₹${prod.price.toLocaleString('en-IN')}</span>
            <span style="font-size: 0.78rem; text-decoration: line-through; color: #565959;">₹${mrp}</span>
            <span style="font-size: 0.75rem; color: #cc0c39; font-weight: 700;">${discount}% off</span>
          </div>
          <div style="font-size: 0.72rem; color: #067d62; font-weight: 600;">Direct Sivakasi Wholesale</div>
          <button class="amz-btn-yellow" style="width: 100%; margin-top: 0.4rem; font-size: 0.82rem; padding: 0.4rem;" onclick="event.stopPropagation(); goToRelatedProduct('${prod.id}')">
            View Photos & Details
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function goToRelatedProduct(id) {
  window.location.href = `product.html?id=${encodeURIComponent(id)}`;
}

// -------------------------------------------------------------
// 3. Customer Ratings & Reviews
// -------------------------------------------------------------
function renderReviewsSection(prod) {
  const reviews = Array.isArray(prod.reviews) ? prod.reviews : [];
  const count = reviews.length;
  const avg = prod.rating || 4.9;

  const scoreEl = document.getElementById('reviewAvgScore');
  if (scoreEl) scoreEl.innerText = avg;

  const starsEl = document.getElementById('reviewAvgStars');
  if (starsEl) starsEl.innerHTML = generateStarsHtml(avg);

  const totalEl = document.getElementById('reviewTotalCount');
  if (totalEl) totalEl.innerText = count > 0 ? `${count} customer rating${count === 1 ? '' : 's'}` : 'Product Rating';

  // Update dynamic rating breakdown bars
  for (let s = 1; s <= 5; s++) {
    const countForStar = reviews.filter(r => Math.round(r.rating || 5) === s).length;
    const pct = count > 0 ? Math.round((countForStar / count) * 100) : (s === 5 ? 100 : 0);
    const fillEl = document.getElementById(`barFill${s}`);
    const pctEl = document.getElementById(`barPct${s}`);
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (pctEl) pctEl.innerText = `${pct}%`;
  }

  const container = document.getElementById('reviewsListContainer');
  if (!container) return;

  if (reviews.length === 0) {
    container.innerHTML = `
      <div style="padding: 2.5rem 1.5rem; text-align: center; background: #fafafa; border: 1px dashed #d5d9d9; border-radius: 8px; color: #565959;">
        <i class="fa-regular fa-comment-dots" style="font-size: 2.4rem; color: #a0aec0; margin-bottom: 0.8rem; display: block;"></i>
        <h4 style="color: #0f1111; margin: 0 0 0.4rem; font-size: 1.05rem;">No customer reviews yet</h4>
        <p style="font-size: 0.88rem; margin: 0 0 1rem; color: #565959;">Be the first customer to share your experience with this cracker!</p>
        <a href="#starPicker" style="color: #007185; font-size: 0.88rem; font-weight: 700; text-decoration: none;">Write a review below ↓</a>
      </div>
    `;
  } else {
    container.innerHTML = reviews.map(r => {
      const rStars = generateStarsHtml(r.rating || 5);
      const headline = r.title || 'Verified Quality Cracker';
      const comment = r.comment || 'Great experience with fast Bangalore delivery.';
      const reviewer = r.customer_name || 'Amazon Customer';
      const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Verified Review';

      return `
        <div class="customer-review-card">
          <div class="rev-user-line">
            <i class="fa-solid fa-circle-user" style="color: #a0aec0; font-size: 1.5rem;"></i>
            <span>${reviewer}</span>
            <span class="rev-verified-tag"><i class="fa-solid fa-check"></i> Verified Purchase</span>
          </div>
          <div style="color: #de7921; font-size: 0.85rem; margin: 0.2rem 0;">${rStars}</div>
          <div class="rev-headline">${headline}</div>
          <div class="rev-comment">${comment}</div>
          <div class="rev-date">Reviewed on ${dateStr}</div>
        </div>
      `;
    }).join('');
  }
}

// Interactive Star Rating Picker
function selectStar(val) {
  currentSelectedRating = val;
  const stars = document.querySelectorAll('#starPicker .star');
  stars.forEach((s, idx) => {
    if (idx < val) {
      s.classList.add('active');
    } else {
      s.classList.remove('active');
    }
  });
}

// Submit Customer Review
async function handleReviewSubmission(e) {
  e.preventDefault();
  if (!currentProduct) return;

  const name = document.getElementById('reviewerName').value.trim();
  const headline = document.getElementById('reviewerHeadline').value.trim();
  const comment = document.getElementById('reviewerComment').value.trim();

  if (!name || !comment) {
    showToast('Please enter your name and a comment', 'error');
    return;
  }

  const payload = {
    customer_name: name,
    rating: currentSelectedRating,
    title: headline || 'Customer Review',
    comment: comment
  };

  try {
    const res = await fetch(`/api/products/${encodeURIComponent(currentProduct.id)}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      showToast('Thank you! Your verified review has been published.', 'success');
      document.getElementById('reviewerName').value = '';
      document.getElementById('reviewerHeadline').value = '';
      document.getElementById('reviewerComment').value = '';
      
      // Reload product details to show newly added review
      await fetchProductDetails(currentProduct.id);
    } else {
      showToast(data.error || 'Failed to submit review', 'error');
    }
  } catch (err) {
    console.error('Error submitting review:', err);
    showToast('Server connection error. Please try again.', 'error');
  }
}

// -------------------------------------------------------------
// 4. Quantity Controls & Buy Box Actions
// -------------------------------------------------------------
function changePageQty(delta) {
  const newQty = pageQuantity + delta;
  if (newQty < 1 || newQty > 50) return;
  pageQuantity = newQty;
  document.getElementById('pageQtyVal').innerText = pageQuantity;
  if (currentProduct) {
    updateWhatsAppLink(currentProduct);
  }
}

function addProductToCartFromPage() {
  if (!currentProduct) return;
  const id = currentProduct.id;
  cart[id] = (cart[id] || 0) + pageQuantity;
  saveCartState();
  updateCartBadge();
  showToast(`Added ${pageQuantity}x "${currentProduct.name}" to cart!`, 'success');
  openCart();
}

function buyNowFromPage() {
  if (!currentProduct) return;
  const id = currentProduct.id;
  cart[id] = (cart[id] || 0) + pageQuantity;
  saveCartState();
  updateCartBadge();
  openCheckout();
}

// -------------------------------------------------------------
// 5. Slide-Out Cart Drawer
// -------------------------------------------------------------
function openCart() {
  renderCartDrawer();
  document.getElementById('cartDrawer')?.classList.add('active');
  document.getElementById('cartOverlay')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cartDrawer')?.classList.remove('active');
  document.getElementById('cartOverlay')?.classList.remove('active');
  document.body.style.overflow = '';
}

function renderCartDrawer() {
  const listEl = document.getElementById('cartItemsList');
  const subtotalEl = document.getElementById('drawerSubtotal');
  if (!listEl) return;

  const entries = Object.entries(cart);
  if (entries.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: #565959;">
        <i class="fa-solid fa-cart-shopping" style="font-size: 3rem; color: #d5d9d9; margin-bottom: 1rem;"></i>
        <h4 style="color: #0f1111;">Your Amazon Crackers Cart is empty</h4>
        <p style="font-size: 0.85rem; margin-top: 0.4rem;">Add Sivakasi direct wholesale boxes to celebrate Diwali!</p>
        <button class="amz-btn-yellow" style="margin-top: 1rem; padding: 0.5rem 1.2rem;" onclick="closeCart()">Continue Shopping</button>
      </div>
    `;
    if (subtotalEl) subtotalEl.innerText = '₹0';
    return;
  }

  let subtotal = 0;
  let itemsHtml = '';

  entries.forEach(([id, qty]) => {
    // Find product either in currentProduct or allProducts
    let item = (currentProduct && currentProduct.id === id) ? currentProduct : allProducts.find(p => p.id === id);
    if (!item) {
      item = { id, name: 'Cracker Item', price: 0, image: 'images/hero-banner.jpg' };
    }

    const price = item.price || 0;
    const itemTotal = price * qty;
    subtotal += itemTotal;
    const imgUrl = (item.images && item.images.length > 0) ? item.images[0] : (item.image || 'images/hero-banner.jpg');

    itemsHtml += `
      <div class="cart-drawer-item" style="display: flex; gap: 0.8rem; padding: 0.8rem 0; border-bottom: 1px solid #f0f0f0; align-items: center;">
        <img src="${imgUrl}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: contain; background: #fafafa; border: 1px solid #e7e7e7; border-radius: 4px;" onerror="this.src='images/hero-banner.jpg'">
        <div style="flex: 1;">
          <h4 style="font-size: 0.88rem; font-weight: 700; color: #0f1111; margin: 0; line-height: 1.3;">${item.name}</h4>
          <div style="font-size: 0.82rem; font-weight: 700; color: #b12704; margin-top: 0.2rem;">₹${price.toLocaleString('en-IN')}</div>
          <div style="display: flex; align-items: center; gap: 0.4rem; margin-top: 0.4rem;">
            <button onclick="updateCartItemQty('${id}', -1)" style="padding: 2px 8px; border: 1px solid #ccc; background: #f0f2f2; border-radius: 3px; cursor: pointer;">-</button>
            <span style="font-size: 0.85rem; font-weight: 700; min-width: 20px; text-align: center;">${qty}</span>
            <button onclick="updateCartItemQty('${id}', 1)" style="padding: 2px 8px; border: 1px solid #ccc; background: #f0f2f2; border-radius: 3px; cursor: pointer;">+</button>
            <button onclick="removeCartItem('${id}')" style="margin-left: 0.6rem; color: #007185; background: none; border: none; font-size: 0.78rem; cursor: pointer; text-decoration: underline;">Delete</button>
          </div>
        </div>
        <div style="font-size: 0.95rem; font-weight: 800; color: #0f1111;">
          ₹${itemTotal.toLocaleString('en-IN')}
        </div>
      </div>
    `;
  });

  listEl.innerHTML = itemsHtml;
  if (subtotalEl) subtotalEl.innerText = `₹${subtotal.toLocaleString('en-IN')}`;
}

function updateCartItemQty(id, delta) {
  if (!cart[id]) return;
  cart[id] += delta;
  if (cart[id] <= 0) {
    delete cart[id];
  }
  saveCartState();
  updateCartBadge();
  renderCartDrawer();
}

function removeCartItem(id) {
  delete cart[id];
  saveCartState();
  updateCartBadge();
  renderCartDrawer();
}

// -------------------------------------------------------------
// 6. Checkout Modal & Order Placement
// -------------------------------------------------------------
function openCheckout() {
  closeCart();
  const entries = Object.entries(cart);
  if (entries.length === 0) {
    showToast('Your cart is empty', 'error');
    return;
  }

  let totalPayable = 0;
  entries.forEach(([id, qty]) => {
    let item = (currentProduct && currentProduct.id === id) ? currentProduct : allProducts.find(p => p.id === id);
    const price = item ? item.price : 0;
    totalPayable += price * qty;
  });

  const totalEl = document.getElementById('checkoutTotalPayable');
  if (totalEl) totalEl.innerText = `₹${totalPayable.toLocaleString('en-IN')}`;

  document.getElementById('checkoutModalBackdrop')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  document.getElementById('checkoutModalBackdrop')?.classList.remove('active');
  document.body.style.overflow = '';
}

async function handlePlaceOrder(e) {
  e.preventDefault();

  const name = document.getElementById('custName')?.value.trim();
  const phone = document.getElementById('custPhone')?.value.trim();
  const locality = document.getElementById('custLocality')?.value;
  const pincode = document.getElementById('custPincode')?.value.trim();
  const address = document.getElementById('custAddress')?.value.trim();
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'Cash on Delivery (COD)';

  const cartEntries = Object.entries(cart);
  if (cartEntries.length === 0) {
    showToast('Cart is empty', 'error');
    return;
  }

  let orderItems = [];
  let totalPayable = 0;
  let totalMrp = 0;

  cartEntries.forEach(([id, qty]) => {
    let item = (currentProduct && currentProduct.id === id) ? currentProduct : allProducts.find(p => p.id === id);
    if (!item) return;
    const price = item.price || 0;
    const mrp = item.mrp || (price * 2);
    orderItems.push({
      id: item.id,
      name: item.name,
      qty: qty,
      price: price,
      mrp: mrp
    });
    totalPayable += (price * qty);
    totalMrp += (mrp * qty);
  });

  const orderPayload = {
    customerName: name,
    phone: phone,
    locality: locality,
    pincode: pincode,
    address: address,
    notes: 'Direct from product page',
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

      // Empty cart
      cart = {};
      saveCartState();
      updateCartBadge();

      closeCheckout();

      const orderBadge = document.getElementById('createdOrderId');
      if (orderBadge) orderBadge.innerText = data.orderId;

      document.getElementById('orderSuccessModalBackdrop')?.classList.add('active');
    } else {
      alert(data.error || 'Could not place order. Please check inputs.');
    }
  } catch (err) {
    console.error('Error placing order:', err);
    alert('Server connection error. Please try again.');
  }
}

function sendOrderSummaryToWhatsapp() {
  if (!lastCreatedOrder) return;

  const itemsText = lastCreatedOrder.items.map(it => `• ${it.name} x ${it.qty} = ₹${it.price * it.qty}`).join('\n');
  const msg = `Namaskara Amazon Crackers!\nI just placed an order:\nOrder ID: ${lastCreatedOrder.id}\nCustomer: ${lastCreatedOrder.customerName}\nPhone: ${lastCreatedOrder.phone}\nLocality: ${lastCreatedOrder.locality}\nAddress: ${lastCreatedOrder.address}, ${lastCreatedOrder.pincode}\nItems:\n${itemsText}\nTotal Payable: ₹${lastCreatedOrder.totalPayable} (${lastCreatedOrder.paymentMethod})\nPlease confirm dispatch from Kengeri Central Hub.`;

  window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`, '_blank');
}

// -------------------------------------------------------------
// Header Search Redirection
// -------------------------------------------------------------
function executeHeaderSearch() {
  const query = document.getElementById('globalSearchInput')?.value.trim();
  if (query) {
    window.location.href = `index.html?search=${encodeURIComponent(query)}`;
  } else {
    window.location.href = `index.html#catalog-section`;
  }
}

function handleHeaderCategory(cat) {
  window.location.href = `index.html?category=${encodeURIComponent(cat)}`;
}

// -------------------------------------------------------------
// Toast Notifications
// -------------------------------------------------------------
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-msg toast-${type}`;
  toast.style.cssText = `
    background: ${type === 'error' ? '#cc0c39' : '#067d62'};
    color: #fff;
    padding: 0.8rem 1.2rem;
    border-radius: 4px;
    margin-bottom: 0.5rem;
    font-size: 0.88rem;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.18);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    animation: fadeIn 0.2s ease;
  `;
  toast.innerHTML = `<i class="fa-solid fa-${type === 'error' ? 'circle-exclamation' : 'circle-check'}"></i> ${msg}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
