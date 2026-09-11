/**
 * ROTIMATIC NEXT — Interactive Application Logic
 * Features:
 *  1. 3D Mouse Parallax & Gyro Tilt on Hero Product Render
 *  2. Interactive Variant Switcher (Polar White ₹14,999 vs Onyx Black ₹24,999)
 *  3. "How It Works" Live Process Video & Telemetry Simulation
 *  4. Specs Matrix Selectors & Instant Add to Cart
 *  5. Complete Dummy Checkout / Buy Now Modal (Client Demo Mock)
 *     NOTE: Payment gateway is mocked.
 *     TODO: integrate real payment gateway once client provides merchant account (Razorpay/PayU/Stripe)
 */

// Global State
const appState = {
  currentVariant: 'white',
  quantity: 1,
  customer: {
    name: 'Rahul Sharma',
    phone: '9876543210',
    address: 'Flat 402, Lotus Grand, Link Road',
    city: 'Mumbai',
    pin: '400050'
  },
  selectedPaymentMethod: 'upi',
  variants: {
    white: {
      key: 'white',
      name: 'Polar White Edition',
      price: 14999,
      originalPrice: 19999,
      savings: 5000,
      image: 'assets/rotimatic-white.jpg',
      badge: '5 Year Guarantee Included',
      summary: 'Polar White Edition (1 Unit)'
    },
    black: {
      key: 'black',
      name: 'Onyx Black Edition',
      price: 24999,
      originalPrice: 32999,
      savings: 8000,
      image: 'assets/rotimatic-black.jpg',
      badge: '5 Year Guarantee • Flagship Titanium',
      summary: 'Onyx Black Edition (1 Unit)'
    }
  }
};

// DOM Content Loaded Initializer
document.addEventListener('DOMContentLoaded', () => {
  init3DHeroTilt();
  initVariantSelection();
  initVideoSimulation();
  initNavigationScroll();
  initMobileMenu();
  updateCheckoutSummary();
});

/* ==========================================================================
   1. 3D HERO PRODUCT TILT & PARALLAX EFFECT
   ========================================================================== */
function init3DHeroTilt() {
  const stage = document.getElementById('hero3DStage');
  const card = document.getElementById('product3DCard');
  const glare = document.getElementById('glareLayer');
  if (!stage || !card) return;

  let isHovered = false;

  stage.addEventListener('mouseenter', () => {
    isHovered = true;
    if (glare) glare.style.opacity = '0.35';
  });

  stage.addEventListener('mouseleave', () => {
    isHovered = false;
    card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    if (glare) glare.style.opacity = '0';
  });

  stage.addEventListener('mousemove', (e) => {
    if (!isHovered) return;

    const rect = stage.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Max rotation angles (degrees)
    const rotateX = -((y - centerY) / centerY) * 14;
    const rotateY = ((x - centerX) / centerX) * 16;

    card.style.transform = `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.03, 1.03, 1.03)`;

    if (glare) {
      const glareX = (x / rect.width) * 100;
      const glareY = (y / rect.height) * 100;
      glare.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.3) 0%, transparent 60%)`;
      glare.style.opacity = '0.45';
    }
  });

  // Window scroll subtle parallax
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if (scrollY < 800) {
      const floatY = Math.sin(scrollY * 0.005) * 6;
      if (!isHovered) {
        card.style.transform = `perspective(1200px) translateY(${floatY.toFixed(1)}px)`;
      }
    }
  }, { passive: true });
}

/* ==========================================================================
   2. VARIANT SWITCHER
   ========================================================================== */
function initVariantSelection() {
  // Sync initial state
  selectVariant('white', false);
}

function selectVariant(variantKey, triggerToast = true) {
  if (!appState.variants[variantKey]) return;
  appState.currentVariant = variantKey;
  const variant = appState.variants[variantKey];

  // Update Hero elements
  const heroImg = document.getElementById('heroProductImage');
  const heroDot = document.getElementById('heroVariantDot');
  const heroTitle = document.getElementById('heroVariantTitle');
  const heroPrice = document.getElementById('heroPriceTag');

  if (heroImg) {
    heroImg.style.opacity = '0.3';
    heroImg.style.transform = 'scale(0.97)';
    setTimeout(() => {
      heroImg.src = variant.image;
      heroImg.alt = `Rotimatic NEXT ${variant.name}`;
      heroImg.style.opacity = '1';
      heroImg.style.transform = 'scale(1)';
    }, 150);
  }

  if (heroDot) {
    heroDot.className = `pill-indicator ${variantKey === 'black' ? 'black' : ''}`;
  }
  if (heroTitle) heroTitle.textContent = variant.name;
  if (heroPrice) heroPrice.textContent = `₹${variant.price.toLocaleString('en-IN')}`;

  // Update Variant cards styling
  const cardWhite = document.getElementById('variantCardWhite');
  const cardBlack = document.getElementById('variantCardBlack');

  if (cardWhite && cardBlack) {
    if (variantKey === 'white') {
      cardWhite.classList.add('active');
      cardWhite.setAttribute('aria-pressed', 'true');
      cardWhite.querySelector('.select-text').textContent = 'Selected (Active)';
      cardWhite.querySelector('.check-icon').textContent = '✓';

      cardBlack.classList.remove('active');
      cardBlack.setAttribute('aria-pressed', 'false');
      cardBlack.querySelector('.select-text').textContent = 'Choose Onyx Black';
      cardBlack.querySelector('.check-icon').textContent = '→';
    } else {
      cardBlack.classList.add('active');
      cardBlack.setAttribute('aria-pressed', 'true');
      cardBlack.querySelector('.select-text').textContent = 'Selected (Active)';
      cardBlack.querySelector('.check-icon').textContent = '✓';

      cardWhite.classList.remove('active');
      cardWhite.setAttribute('aria-pressed', 'false');
      cardWhite.querySelector('.select-text').textContent = 'Choose Polar White';
      cardWhite.querySelector('.check-icon').textContent = '→';
    }
  }

  // Update Modal radio controls
  const radioWhite = document.querySelector('input[name="checkoutVariant"][value="white"]');
  const radioBlack = document.querySelector('input[name="checkoutVariant"][value="black"]');
  if (variantKey === 'white' && radioWhite) radioWhite.checked = true;
  if (variantKey === 'black' && radioBlack) radioBlack.checked = true;

  updateCheckoutSummary();

  if (triggerToast) {
    showToast(`Switched to ${variant.name} (₹${variant.price.toLocaleString('en-IN')})`, 'orange');
  }
}

function selectAndCheckout(variantKey) {
  selectVariant(variantKey, false);
  openCheckoutModal(variantKey);
}

/* ==========================================================================
   3. "HOW IT WORKS" VIDEO & PROCESS SIMULATION
   ========================================================================== */
let simulationInterval = null;
let currentStep = 1;
let isPlaying = false;
let simTime = 45; // seconds (0 to 90)

const stepData = {
  1: {
    number: 'STEP 1',
    text: 'Airtight Canisters Dosing Water, Oil & Whole Wheat Flour',
    temp: 'CHAMBER: 180°C',
    duration: '0:00 - 0:30'
  },
  2: {
    number: 'STEP 2',
    text: 'Twin Calibrated Discs Compressing Dough Ball (400kg force)',
    temp: 'CHAMBER: 235°C',
    duration: '0:30 - 1:05'
  },
  3: {
    number: 'STEP 3',
    text: 'Dual 360° Baking Plates Vaporizing Moisture & Balloon-Puffing Roti',
    temp: 'CHAMBER: 245°C (PEAK)',
    duration: '1:05 - 1:30'
  }
};

function initVideoSimulation() {
  updateSimulationUI();
}

function togglePlaySimulation() {
  const playBtn = document.getElementById('playVideoBtn');
  const playIcon = document.getElementById('playIconSvg');

  if (isPlaying) {
    pauseSimulation();
    showToast('Simulation Paused');
  } else {
    playSimulation();
    showToast('Live telemetry simulation running...');
  }
}

function playSimulation() {
  isPlaying = true;
  const playIcon = document.getElementById('playIconSvg');
  if (playIcon) {
    playIcon.innerHTML = `<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>`;
  }

  if (simulationInterval) clearInterval(simulationInterval);
  simulationInterval = setInterval(() => {
    simTime += 1;
    if (simTime > 90) {
      simTime = 0; // loop
    }
    updateSimulationStepFromTime();
    updateSimulationUI();
  }, 350);
}

function pauseSimulation() {
  isPlaying = false;
  const playIcon = document.getElementById('playIconSvg');
  if (playIcon) {
    playIcon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"></polygon>`;
  }
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
}

function updateSimulationStepFromTime() {
  if (simTime <= 30) {
    currentStep = 1;
  } else if (simTime <= 65) {
    currentStep = 2;
  } else {
    currentStep = 3;
  }
}

function jumpToStep(stepNum) {
  currentStep = stepNum;
  if (stepNum === 1) simTime = 10;
  if (stepNum === 2) simTime = 45;
  if (stepNum === 3) simTime = 75;
  updateSimulationUI();
}

function scrubTimeline(event) {
  const bar = event.currentTarget;
  const rect = bar.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const pct = Math.max(0, Math.min(1, clickX / rect.width));
  simTime = Math.round(pct * 90);
  updateSimulationStepFromTime();
  updateSimulationUI();
}

function updateSimulationUI() {
  // Update HUD text
  const stepInfo = stepData[currentStep];
  const hudNumber = document.getElementById('hudStepNumber');
  const hudText = document.getElementById('hudStepText');
  const hudTemp = document.getElementById('hudTemp');
  const fill = document.getElementById('timelineFill');
  const elapsed = document.getElementById('timeElapsed');

  if (hudNumber) hudNumber.textContent = stepInfo.number;
  if (hudText) hudText.textContent = stepInfo.text;
  if (hudTemp) hudTemp.textContent = stepInfo.temp;

  if (fill) {
    const pct = (simTime / 90) * 100;
    fill.style.width = `${pct}%`;
  }

  if (elapsed) {
    const mins = Math.floor(simTime / 60);
    const secs = simTime % 60;
    elapsed.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Update step cards highlight
  [1, 2, 3].forEach((num) => {
    const card = document.getElementById(`stepCard${num}`);
    if (card) {
      if (num === currentStep) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    }
  });
}

/* ==========================================================================
   4. CHECKOUT / BUY NOW MODAL FLOW
   ========================================================================== */
function openCheckoutModal(variantKey = null) {
  if (variantKey && appState.variants[variantKey]) {
    selectVariant(variantKey, false);
  }

  const modal = document.getElementById('checkoutModal');
  if (!modal) return;

  goToCheckoutStep(1);
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkoutModal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// Close on backdrop click
document.addEventListener('click', (e) => {
  const modal = document.getElementById('checkoutModal');
  if (modal && e.target === modal) {
    closeCheckoutModal();
  }
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeCheckoutModal();
  }
});

function setCheckoutVariant(variantKey) {
  selectVariant(variantKey, false);
}

function updateQuantity(delta) {
  const newQty = appState.quantity + delta;
  if (newQty < 1 || newQty > 10) return;
  appState.quantity = newQty;

  const display = document.getElementById('modalQtyDisplay');
  if (display) display.textContent = newQty;

  const cartCounter = document.getElementById('cartCountBadge');
  if (cartCounter) cartCounter.textContent = newQty;

  updateCheckoutSummary();
}

function updateCheckoutSummary() {
  const variant = appState.variants[appState.currentVariant];
  const qty = appState.quantity;
  const unitPrice = variant.price;
  const subtotal = unitPrice * qty;
  // 18% GST is included in subtotal
  const gstAmount = Math.round(subtotal - (subtotal / 1.18));

  // Update summary preview
  const thumb = document.getElementById('summaryThumb');
  const nameEl = document.getElementById('summaryVariantName');
  const qtyEl = document.getElementById('summaryQty');
  const singlePriceEl = document.getElementById('summarySinglePrice');
  const subtotalEl = document.getElementById('costSubtotal');
  const gstEl = document.getElementById('costGst');
  const totalEl = document.getElementById('costTotal');

  if (thumb) thumb.src = variant.image;
  if (nameEl) nameEl.textContent = variant.name;
  if (qtyEl) qtyEl.textContent = qty;
  if (singlePriceEl) singlePriceEl.textContent = `₹${unitPrice.toLocaleString('en-IN')} each`;
  if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
  if (gstEl) gstEl.textContent = `₹${gstAmount.toLocaleString('en-IN')}`;
  if (totalEl) totalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;

  // Update all payment total labels
  document.querySelectorAll('.payTotalDisplay').forEach(el => {
    el.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
  });

  const halfPrice = Math.round(subtotal / 2);
  document.querySelectorAll('.payHalfDisplay').forEach(el => {
    el.textContent = `₹${halfPrice.toLocaleString('en-IN')}`;
  });
}

function goToCheckoutStep(stepNumber) {
  // If moving from Step 1 to Step 2, validate and store shipping details
  if (stepNumber === 2) {
    const nameInput = document.getElementById('custName');
    const phoneInput = document.getElementById('custPhone');
    const addrInput = document.getElementById('custAddress');
    const cityInput = document.getElementById('custCity');
    const pinInput = document.getElementById('custPin');

    if (nameInput && nameInput.value.trim()) appState.customer.name = nameInput.value.trim();
    if (phoneInput && phoneInput.value.trim()) appState.customer.phone = phoneInput.value.trim();
    if (addrInput && addrInput.value.trim()) appState.customer.address = addrInput.value.trim();
    if (cityInput && cityInput.value.trim()) appState.customer.city = cityInput.value.trim();
    if (pinInput && pinInput.value.trim()) appState.customer.pin = pinInput.value.trim();
  }

  // Hide all steps, show target step
  [1, 2, 3].forEach(num => {
    const stepEl = document.getElementById(`checkoutStep${num}`);
    const tabEl = document.getElementById(`cStepTab${num}`);
    if (stepEl) stepEl.classList.toggle('active', num === stepNumber);
    if (tabEl) tabEl.classList.toggle('active', num <= stepNumber);
  });

  // Scroll modal container to top
  const container = document.querySelector('.checkout-modal-container');
  if (container) container.scrollTop = 0;
}

function switchPayTab(tabKey) {
  appState.selectedPaymentMethod = tabKey;
  ['upi', 'card', 'cod'].forEach(key => {
    const btn = document.getElementById(`tab${capitalize(key)}`);
    const content = document.getElementById(`content${capitalize(key)}`);
    if (btn) btn.classList.toggle('active', key === tabKey);
    if (content) content.classList.toggle('active', key === tabKey);
  });
}

/**
 * DUMMY PAYMENT GATEWAY PROCESSOR (CLIENT DEMO)
 * NOTE: Payment gateway is completely mocked for client review.
 * // TODO: integrate real payment gateway once client provides merchant account (Razorpay/PayU/Stripe)
 */
function processDummyPayment() {
  const placeBtn = document.getElementById('placeOrderBtn');
  if (!placeBtn) return;

  const origHtml = placeBtn.innerHTML;
  placeBtn.disabled = true;
  placeBtn.innerHTML = `<span>Processing Order...</span>`;

  setTimeout(() => {
    placeBtn.disabled = false;
    placeBtn.innerHTML = origHtml;

    // Generate dummy order data
    const randomOrderId = '#ROTI-2026-' + Math.floor(1000 + Math.random() * 9000);
    const variant = appState.variants[appState.currentVariant];
    const total = (variant.price * appState.quantity).toLocaleString('en-IN');

    // Populate confirmation screen
    const nameEl = document.getElementById('confCustomerName');
    const orderIdEl = document.getElementById('confOrderId');
    const variantEl = document.getElementById('confVariant');
    const totalEl = document.getElementById('confTotal');
    const destEl = document.getElementById('confDestination');
    const waBtn = document.getElementById('confWhatsAppBtn');

    if (nameEl) nameEl.textContent = appState.customer.name;
    if (orderIdEl) orderIdEl.textContent = randomOrderId;
    if (variantEl) variantEl.textContent = `${variant.name} (${appState.quantity} Unit${appState.quantity > 1 ? 's' : ''})`;
    if (totalEl) totalEl.textContent = `₹${total} (Inclusive of 18% GST)`;
    if (destEl) destEl.textContent = `${appState.customer.city} (${appState.customer.pin})`;

    if (waBtn) {
      const waMsg = encodeURIComponent(
        `Hi Rotimatic Team, I have placed order ${randomOrderId} for ${variant.name} (Qty: ${appState.quantity}) to ${appState.customer.city}. Please confirm dispatch timeline.`
      );
      waBtn.href = `https://wa.me/919876543210?text=${waMsg}`;
    }

    goToCheckoutStep(3);
    showToast('🎉 Booking Confirmed Successfully!', 'orange');
  }, 1100);
}

/* ==========================================================================
   5. NAVIGATION & UTILITIES
   ========================================================================== */
function initNavigationScroll() {
  const links = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id]');

  window.addEventListener('scroll', () => {
    let currentId = '';
    const scrollPosition = window.scrollY + 140;

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (scrollPosition >= top && scrollPosition < top + height) {
        currentId = section.getAttribute('id');
      }
    });

    links.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${currentId}`) {
        link.classList.add('active');
      }
    });
  }, { passive: true });
}

function initMobileMenu() {
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const navLinks = document.getElementById('navLinks');
  if (!toggleBtn || !navLinks) return;

  toggleBtn.addEventListener('click', () => {
    const isVisible = navLinks.style.display === 'flex';
    navLinks.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.top = '72px';
      navLinks.style.left = '0';
      navLinks.style.right = '0';
      navLinks.style.background = '#0a0a0c';
      navLinks.style.padding = '1.5rem 2rem';
      navLinks.style.borderBottom = '1px solid var(--border-medium)';
      navLinks.style.gap = '1.25rem';
    }
  });

  // Close when link clicked
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        navLinks.style.display = 'none';
      }
    });
  });
}

function showToast(message, type = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-msg ${type}`;
  toast.innerHTML = `<span>✨</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
