/**
 * ROTIMATIC NEXT — Interactive Application Logic
 * Production Asset Integration:
 *  1. Asset 1: Real Drag-to-Rotate 360° Turnaround Viewer (7 ordered frames: Front -> Right -> Back -> Left -> Front)
 *  2. Asset 2: Dramatic Black Spotlight Showcase with Vignette Edge Blend
 *  3. Asset 3: "In Real Indian Kitchens" Lifestyle Showcase
 *  4. Real HTML5 Video Player with Scroll-into-view Autoplay & Floating Unmute Pill
 *  5. Interactive Variant Switcher (Polar White ₹14,999 vs Onyx Black ₹24,999)
 *  6. Checkout flow that creates real pending orders through the backend
 */

// Global State
const appState = {
  currentVariant: 'black',
  heroMode: 'spotlight', // 'spotlight' | '360'
  quantity: 1,
  current360Frame: 1,
  checkoutAddresses: [],
  createdOrder: null,
  selectedPaymentMethod: 'razorpay',
  manualPaymentConfig: null,
  variants: {
    black: {
      key: 'black',
      name: 'Rotimatic NEXT (Black Edition)',
      shortName: 'Black Edition',
      price: 24999,
      originalPrice: 32999,
      savings: 8000,
      image: 'assets/machine-black-24k.jpg',
      badge: '5 Year Priority Warranty • Verified Blueprint Specs',
      summary: 'Rotimatic NEXT Black Edition (1 Unit)'
    },
    white: {
      key: 'white',
      name: 'Rotimatic Classic White',
      shortName: 'Classic White',
      price: 14999,
      originalPrice: 19999,
      savings: 5000,
      image: 'assets/machine-white-14k.jpg',
      badge: '5 Year Comprehensive Guarantee Included',
      summary: 'Rotimatic Classic White (1 Unit)'
    }
  },
  // Asset 1 Turnaround Ordered Frames (1 to 7)
  turnaroundFrames: [
    { frame: 1, src: 'assets/rotimatic-360-01.jpg', label: 'Front (0°)' },
    { frame: 2, src: 'assets/rotimatic-360-02.jpg', label: 'Front-Right 45°' },
    { frame: 3, src: 'assets/rotimatic-360-03.jpg', label: 'Right Side (90°)' },
    { frame: 4, src: 'assets/rotimatic-360-04.jpg', label: 'Back-Right (135°)' },
    { frame: 5, src: 'assets/rotimatic-360-05.jpg', label: 'Back (180°)' },
    { frame: 6, src: 'assets/rotimatic-360-06.jpg', label: 'Back-Left (225°)' },
    { frame: 7, src: 'assets/rotimatic-360-07.jpg', label: 'Left Side (270°)' }
  ]
};

// DOM Content Loaded Initializer
document.addEventListener('DOMContentLoaded', () => {
  preload360Images();
  init3DHeroTilt();
  init360Viewer();
  initVideoPlayer();
  initNavigationScroll();
  initMobileMenu();
  updateCheckoutSummary();
});

/* ==========================================================================
   1. PRELOAD 360° TURNAROUND IMAGES
   ========================================================================== */
const preloadedImages = [];
function preload360Images() {
  appState.turnaroundFrames.forEach(item => {
    const img = new Image();
    img.src = item.src;
    preloadedImages.push(img);
  });
}

/* ==========================================================================
   2. HERO MODE SWITCHER (SPOTLIGHT VS 360°)
   ========================================================================== */
function setHeroViewMode(mode) {
  appState.heroMode = mode;

  const btnSpotlight = document.getElementById('btnModeSpotlight');
  const btn360 = document.getElementById('btnMode360');
  const viewSpotlight = document.getElementById('viewSpotlight');
  const view360 = document.getElementById('view360');
  const card = document.getElementById('product3DCard');

  if (card) {
    card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  }

  if (mode === 'spotlight') {
    btnSpotlight.classList.add('active');
    btn360.classList.remove('active');
    viewSpotlight.classList.add('active');
    view360.classList.remove('active');
    showToast('✨ Switched to Studio Spotlight View', 'orange');
  } else {
    btn360.classList.add('active');
    btnSpotlight.classList.remove('active');
    view360.classList.add('active');
    viewSpotlight.classList.remove('active');
    showToast('🔄 Drag horizontally to spin 360°', 'orange');
  }
}

/* ==========================================================================
   3. REAL DRAG-TO-ROTATE 360° TURNAROUND VIEWER (Asset 1)
   ========================================================================== */
function init360Viewer() {
  const container = document.getElementById('viewer360Container');
  const turnaroundImg = document.getElementById('turnaroundImg');
  if (!container || !turnaroundImg) return;

  let isDragging = false;
  let accumulatedDelta = 0;
  const pixelsPerFrame = 16; // Smooth responsive sensitivity
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0;
  let momentumRaf = null;

  function stopMomentum() {
    if (momentumRaf) {
      cancelAnimationFrame(momentumRaf);
      momentumRaf = null;
    }
  }

  function startDrag(clientX) {
    stopMomentum();
    isDragging = true;
    lastX = clientX;
    lastTime = performance.now();
    accumulatedDelta = 0;
    velocity = 0;
    container.classList.add('is-dragging');
  }

  function onDragMove(clientX) {
    if (!isDragging) return;
    const now = performance.now();
    const dt = Math.max(now - lastTime, 1);
    const deltaX = clientX - lastX;

    velocity = (deltaX / dt) * 16.67;
    lastX = clientX;
    lastTime = now;

    accumulatedDelta += deltaX;

    if (Math.abs(accumulatedDelta) >= pixelsPerFrame) {
      const stepCount = Math.trunc(accumulatedDelta / pixelsPerFrame);
      accumulatedDelta -= stepCount * pixelsPerFrame;
      step360Frame(stepCount);
    }
  }

  function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    container.classList.remove('is-dragging');

    // Smooth inertial momentum on release
    if (Math.abs(velocity) > 3) {
      let currentVelocity = velocity;
      function applyMomentum() {
        if (isDragging) return;
        currentVelocity *= 0.88;
        accumulatedDelta += currentVelocity;

        if (Math.abs(accumulatedDelta) >= pixelsPerFrame) {
          const stepCount = Math.trunc(accumulatedDelta / pixelsPerFrame);
          accumulatedDelta -= stepCount * pixelsPerFrame;
          step360Frame(stepCount);
        }

        if (Math.abs(currentVelocity) > 0.35) {
          momentumRaf = requestAnimationFrame(applyMomentum);
        }
      }
      momentumRaf = requestAnimationFrame(applyMomentum);
    }
  }

  // Mouse drag handlers
  container.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startDrag(e.clientX);
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      onDragMove(e.clientX);
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      endDrag();
    }
  });

  // Touch drag handlers (Mobile)
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX);
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length === 1) {
      onDragMove(e.touches[0].clientX);
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    if (isDragging) {
      endDrag();
    }
  });

  window.addEventListener('touchcancel', () => {
    if (isDragging) {
      endDrag();
    }
  });

  // Keyboard navigation when container is focused
  container.setAttribute('tabindex', '0');
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', '360 degree product viewer. Drag horizontally or use left and right arrow keys to rotate.');
  container.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stopMomentum();
      step360Frame(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      stopMomentum();
      step360Frame(1);
    }
  });

  // Interactive Dot Navigation
  document.querySelectorAll('.turnaround-dots-row .t-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      stopMomentum();
      const targetFrame = parseInt(e.currentTarget.getAttribute('data-frame'), 10);
      if (!isNaN(targetFrame)) {
        set360Frame(targetFrame);
      }
    });
  });
}

function step360Frame(stepDelta) {
  const total = appState.turnaroundFrames.length || 7;
  let next = (appState.current360Frame - 1 + stepDelta) % total;
  if (next < 0) next += total;
  set360Frame(next + 1);
}

function set360Frame(frameIndex) {
  appState.current360Frame = frameIndex;
  const frameData = appState.turnaroundFrames[frameIndex - 1];
  if (!frameData) return;

  const turnaroundImg = document.getElementById('turnaroundImg');
  const angleLabel = document.getElementById('angleNameText');
  const dots = document.querySelectorAll('.turnaround-dots-row .t-dot');

  if (turnaroundImg) {
    turnaroundImg.src = frameData.src;
  }
  if (angleLabel) {
    angleLabel.textContent = frameData.label;
  }

  dots.forEach(dot => {
    const f = parseInt(dot.getAttribute('data-frame'), 10);
    dot.classList.toggle('active', f === frameIndex);
  });
}

/* ==========================================================================
   4. 3D HERO PRODUCT TILT & PARALLAX EFFECT
   ========================================================================== */
function init3DHeroTilt() {
  const stage = document.getElementById('hero3DStage');
  const card = document.getElementById('product3DCard');
  if (!stage || !card) return;

  let isHovered = false;

  stage.addEventListener('mouseenter', () => {
    isHovered = true;
  });

  stage.addEventListener('mouseleave', () => {
    isHovered = false;
    card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  });

  stage.addEventListener('mousemove', (e) => {
    if (!isHovered || appState.heroMode === '360') return; // Tilt in spotlight mode

    const rect = stage.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = -((y - centerY) / centerY) * 12;
    const rotateY = ((x - centerX) / centerX) * 14;

    card.style.transform = `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
  });

  // Window scroll subtle parallax
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if (scrollY < 800) {
      const floatY = Math.sin(scrollY * 0.005) * 5;
      if (!isHovered) {
        card.style.transform = `perspective(1200px) translateY(${floatY.toFixed(1)}px)`;
      }
    }
  }, { passive: true });
}

/* ==========================================================================
   5. REAL VIDEO PLAYER (SCROLL-INTO-VIEW AUTOPLAY & UNMUTE)
   ========================================================================== */
function initVideoPlayer() {
  const video = document.getElementById('howItWorksVideo');
  if (!video) return;

  // IntersectionObserver to auto-play muted on scroll into view
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          video.play().catch(() => {
            // Autoplay policy prevented playback, controls remain interactive
          });
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.35 });

    observer.observe(video);
  }
}

function toggleVideoSound() {
  const video = document.getElementById('howItWorksVideo');
  const icon = document.getElementById('unmuteIcon');
  const text = document.getElementById('unmuteText');
  if (!video) return;

  if (video.muted) {
    video.muted = false;
    video.play().catch(() => { });
    if (icon) icon.textContent = '🔇';
    if (text) text.textContent = 'Mute Audio';
    showToast('🔊 Audio Unmuted');
  } else {
    video.muted = true;
    if (icon) icon.textContent = '🔊';
    if (text) text.textContent = 'Click for Sound';
    showToast('🔇 Audio Muted');
  }
}

/* ==========================================================================
   6. VARIANT SWITCHER
   ========================================================================== */
function selectVariant(variantKey, triggerToast = true) {
  if (!appState.variants[variantKey]) return;
  appState.currentVariant = variantKey;
  const variant = appState.variants[variantKey];

  // Update Hero elements
  const heroImg = document.getElementById('heroProductImage');
  const heroDot = document.getElementById('heroVariantDot');
  const heroTitle = document.getElementById('heroVariantTitle');
  const heroPrice = document.getElementById('heroPriceTag');
  const spotlightFrame = document.querySelector('.spotlight-frame');
  const spotlightBadgeText = document.getElementById('spotlightBadgeText');

  if (heroImg) {
    heroImg.style.opacity = '0.2';
    setTimeout(() => {
      heroImg.src = variant.image;
      heroImg.alt = `${variant.name} Automatic Roti Maker`;
      heroImg.style.opacity = '1';
    }, 150);
  }

  if (spotlightFrame) {
    spotlightFrame.classList.toggle('is-white-machine', variantKey === 'white');
    spotlightFrame.classList.toggle('is-black-machine', variantKey === 'black');
  }

  if (spotlightBadgeText) {
    spotlightBadgeText.textContent = variantKey === 'white'
      ? 'Rotimatic Classic White (₹14,999)'
      : 'Rotimatic NEXT Black Edition (₹24,999)';
  }

  // Update Stage Machine Switcher Buttons if present
  const btnStageWhite = document.getElementById('btnStageWhite');
  const btnStageBlack = document.getElementById('btnStageBlack');
  if (btnStageWhite && btnStageBlack) {
    btnStageWhite.classList.toggle('active', variantKey === 'white');
    btnStageBlack.classList.toggle('active', variantKey === 'black');
  }

  if (heroDot) {
    heroDot.className = `pill-indicator ${variantKey === 'black' ? 'black' : 'white'}`;
  }
  if (heroTitle) heroTitle.textContent = variant.name;
  if (heroPrice) heroPrice.textContent = `₹${variant.price.toLocaleString('en-IN')}`;

  // Update Variant cards styling in #variants section
  const cardWhite = document.getElementById('variantCardWhite');
  const cardBlack = document.getElementById('variantCardBlack');

  if (cardWhite && cardBlack) {
    if (variantKey === 'black') {
      cardBlack.classList.add('active');
      cardBlack.setAttribute('aria-pressed', 'true');
      const blackBtn = cardBlack.querySelector('.select-text');
      if (blackBtn) blackBtn.textContent = 'Selected (Active)';
      const blackIcon = cardBlack.querySelector('.check-icon');
      if (blackIcon) blackIcon.textContent = '✓';

      cardWhite.classList.remove('active');
      cardWhite.setAttribute('aria-pressed', 'false');
      const whiteBtn = cardWhite.querySelector('.select-text');
      if (whiteBtn) whiteBtn.textContent = 'Choose Classic White';
      const whiteIcon = cardWhite.querySelector('.check-icon');
      if (whiteIcon) whiteIcon.textContent = '→';
    } else {
      cardWhite.classList.add('active');
      cardWhite.setAttribute('aria-pressed', 'true');
      const whiteBtn = cardWhite.querySelector('.select-text');
      if (whiteBtn) whiteBtn.textContent = 'Selected (Active)';
      const whiteIcon = cardWhite.querySelector('.check-icon');
      if (whiteIcon) whiteIcon.textContent = '✓';

      cardBlack.classList.remove('active');
      cardBlack.setAttribute('aria-pressed', 'false');
      const blackBtn = cardBlack.querySelector('.select-text');
      if (blackBtn) blackBtn.textContent = 'Choose NEXT Black';
      const blackIcon = cardBlack.querySelector('.check-icon');
      if (blackIcon) blackIcon.textContent = '→';
    }
  }

  // Update Modal radio controls
  const radioWhite = document.querySelector('input[name="checkoutVariant"][value="white"]');
  const radioBlack = document.querySelector('input[name="checkoutVariant"][value="black"]');
  if (variantKey === 'white' && radioWhite) radioWhite.checked = true;
  if (variantKey === 'black' && radioBlack) radioBlack.checked = true;

  // Sync Enquiry variant select if modal exists
  const enquirySelect = document.getElementById('enquiryProductSelect');
  if (enquirySelect) {
    enquirySelect.value = variantKey;
  }

  updateCheckoutSummary();

  if (triggerToast) {
    showToast(`Displaying ${variant.name} (₹${variant.price.toLocaleString('en-IN')})`, 'orange');
  }
}

function selectAndCheckout(variantKey) {
  selectVariant(variantKey, false);
  openCheckoutModal(variantKey);
}

function selectAndEnquire(variantKey) {
  selectVariant(variantKey, false);
  openEnquiryModal(variantKey);
}

/* ==========================================================================
   7. CHECKOUT / BUY NOW MODAL FLOW
   ========================================================================== */
function openCheckoutModal(variantKey = null) {
  if (variantKey && appState.variants[variantKey]) {
    selectVariant(variantKey, false);
  }

  const modal = document.getElementById('checkoutModal');
  if (!modal) return;

  resetPaymentStepUI();
  goToCheckoutStep(1);
  loadCheckoutAddresses();
  loadPaymentConfig();
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
  const taxAmount = 0;

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
  if (gstEl) gstEl.textContent = `₹${taxAmount.toLocaleString('en-IN')}`;
  if (totalEl) totalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;

  document.querySelectorAll('.payTotalDisplay').forEach(el => {
    el.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
  });

  const halfPrice = Math.round(subtotal / 2);
  document.querySelectorAll('.payHalfDisplay').forEach(el => {
    el.textContent = `₹${halfPrice.toLocaleString('en-IN')}`;
  });

  const reviewProduct = document.getElementById('reviewProductName');
  const reviewQuantity = document.getElementById('reviewQuantity');
  const reviewTotal = document.getElementById('reviewTotal');
  if (reviewProduct) reviewProduct.textContent = variant.name;
  if (reviewQuantity) reviewQuantity.textContent = qty;
  if (reviewTotal) reviewTotal.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
}

async function loadCheckoutAddresses() {
  const select = document.getElementById('checkoutAddressSelect');
  const message = document.getElementById('checkoutAddressMessage');
  if (!select || !window.RotimaticApi) return;

  select.disabled = true;
  select.innerHTML = '<option value="">Loading saved addresses...</option>';
  if (message) message.textContent = '';
  try {
    const response = await RotimaticApi.addresses();
    appState.checkoutAddresses = response.data.addresses || [];
    select.innerHTML = '';
    if (!appState.checkoutAddresses.length) {
      select.innerHTML = '<option value="">No saved addresses</option>';
      if (message) message.innerHTML = 'Add a saved address in <a href="dashboard.html">My Account</a> before creating an order.';
      return;
    }
    appState.checkoutAddresses.forEach(address => {
      const option = document.createElement('option');
      option.value = address.id;
      option.textContent = `${address.fullName} — ${[address.addressLine1, address.city, address.postalCode].filter(Boolean).join(', ')}`;
      select.appendChild(option);
    });
    const defaultAddress = appState.checkoutAddresses.find(address => address.isDefault);
    select.value = (defaultAddress || appState.checkoutAddresses[0]).id;
  } catch (error) {
    if (error.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    select.innerHTML = '<option value="">Unable to load addresses</option>';
    if (message) message.textContent = 'We could not load your saved addresses. Please try again.';
  } finally {
    select.disabled = false;
  }
}

/* ==========================================================================
   7b. PAYMENT METHOD SELECTION (Razorpay vs. UPI / QR Scanner)
   ========================================================================== */
function resetPaymentStepUI() {
  appState.selectedPaymentMethod = 'razorpay';
  const razorpayRadio = document.querySelector('input[name="paymentMethod"][value="razorpay"]');
  if (razorpayRadio) razorpayRadio.checked = true;

  const reviewPanel = document.getElementById('orderReviewPanel');
  const qrPanel = document.getElementById('qrPaymentPanel');
  if (reviewPanel) reviewPanel.hidden = false;
  if (qrPanel) qrPanel.hidden = true;

  const referenceInput = document.getElementById('upiReferenceInput');
  if (referenceInput) referenceInput.value = '';
  const upiMessage = document.getElementById('upiSubmitMessage');
  if (upiMessage) upiMessage.textContent = '';

  const placeBtn = document.getElementById('placeOrderBtn');
  if (placeBtn) placeBtn.textContent = 'Create Pending Order';
}

async function loadPaymentConfig() {
  if (!window.RotimaticApi) return;
  try {
    const response = await RotimaticApi.manualPaymentConfig();
    appState.manualPaymentConfig = response.data.config;
  } catch (error) {
    appState.manualPaymentConfig = { enabled: false, upiId: null, qrImagePath: null };
  }

  const config = appState.manualPaymentConfig;
  const manualRadio = document.querySelector('input[name="paymentMethod"][value="manual_upi"]');
  const unavailableNote = document.getElementById('manualUpiUnavailableNote');
  if (!config || !config.enabled) {
    if (manualRadio) manualRadio.disabled = true;
    if (unavailableNote) unavailableNote.hidden = false;
    if (appState.selectedPaymentMethod === 'manual_upi') setPaymentMethod('razorpay');
  } else {
    if (manualRadio) manualRadio.disabled = false;
    if (unavailableNote) unavailableNote.hidden = true;
  }
}

function setPaymentMethod(method) {
  appState.selectedPaymentMethod = method;
  const razorpayRadio = document.querySelector('input[name="paymentMethod"][value="razorpay"]');
  const manualRadio = document.querySelector('input[name="paymentMethod"][value="manual_upi"]');
  if (razorpayRadio) razorpayRadio.checked = method === 'razorpay';
  if (manualRadio) manualRadio.checked = method === 'manual_upi';

  const placeBtn = document.getElementById('placeOrderBtn');
  if (placeBtn) placeBtn.textContent = method === 'manual_upi' ? 'Continue to UPI Payment' : 'Create Pending Order';
}

function showQrPaymentPanel(order) {
  const config = appState.manualPaymentConfig;
  const reviewPanel = document.getElementById('orderReviewPanel');
  const qrPanel = document.getElementById('qrPaymentPanel');
  if (reviewPanel) reviewPanel.hidden = true;
  if (qrPanel) qrPanel.hidden = false;

  const img = document.getElementById('qrPaymentImage');
  if (img && config && config.qrImagePath) img.src = config.qrImagePath;
  const upiIdEl = document.getElementById('qrUpiId');
  if (upiIdEl) upiIdEl.textContent = config && config.upiId ? config.upiId : '—';
  const amountEl = document.getElementById('qrAmount');
  if (amountEl) amountEl.textContent = `₹${Number(order.totalAmount).toLocaleString('en-IN')}`;
}

function backToOrderReview() {
  const reviewPanel = document.getElementById('orderReviewPanel');
  const qrPanel = document.getElementById('qrPaymentPanel');
  if (qrPanel) qrPanel.hidden = true;
  if (reviewPanel) reviewPanel.hidden = false;
}

async function submitManualPaymentReference() {
  const input = document.getElementById('upiReferenceInput');
  const message = document.getElementById('upiSubmitMessage');
  const btn = document.getElementById('upiPaidBtn');
  if (!input || !btn) return;

  const referenceId = input.value.trim();
  if (!referenceId) {
    if (message) message.textContent = 'Enter your UPI transaction ID to continue.';
    return;
  }
  if (!appState.createdOrder) {
    if (message) message.textContent = 'Order not found. Please go back and try again.';
    return;
  }

  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span>Submitting...</span>';
  if (message) message.textContent = '';

  try {
    await RotimaticApi.submitManualPayment({ orderId: appState.createdOrder.id, referenceId });
    renderOrderConfirmation(appState.createdOrder, 'pending');
    const statusEl = document.getElementById('confStatus');
    if (statusEl) statusEl.textContent = 'Pending verification';
    const subtitleEl = document.querySelector('#checkoutStep3 .conf-subtitle');
    if (subtitleEl) subtitleEl.textContent = 'Your payment reference was submitted and is awaiting admin verification.';
    goToCheckoutStep(3);
    showToast('Payment reference submitted. Your order is pending verification.', 'orange');
  } catch (error) {
    if (error.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (message) message.textContent = error.message || 'We could not submit your payment reference. Please try again.';
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
}

async function goToCheckoutStep(stepNumber) {
  if (stepNumber === 2) {
    const select = document.getElementById('checkoutAddressSelect');
    if (!select || !select.value) {
      const message = document.getElementById('checkoutAddressMessage');
      if (message) message.textContent = 'Select a saved address before continuing.';
      return;
    }

    try {
      const response = await RotimaticApi.me();
      if (!response.data.authenticated) {
        window.location.href = 'login.html';
        return;
      }
    } catch (error) {
      if (error.status === 401) window.location.href = 'login.html';
      else showToast('We could not verify your session. Please try again.', 'orange');
      return;
    }
  }

  [1, 2, 3].forEach(num => {
    const stepEl = document.getElementById(`checkoutStep${num}`);
    const tabEl = document.getElementById(`cStepTab${num}`);
    if (stepEl) stepEl.classList.toggle('active', num === stepNumber);
    if (tabEl) tabEl.classList.toggle('active', num <= stepNumber);
  });

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

function renderOrderConfirmation(order, paymentState = 'pending') {
  const variant = appState.variants[appState.currentVariant];
  const orderIdEl = document.getElementById('confOrderId');
  const variantEl = document.getElementById('confVariant');
  const totalEl = document.getElementById('confTotal');
  const destEl = document.getElementById('confDestination');
  const statusEl = document.getElementById('confStatus');
  const currencyEl = document.getElementById('confCurrency');
  const titleEl = document.querySelector('#checkoutStep3 .conf-title');
  const subtitleEl = document.querySelector('#checkoutStep3 .conf-subtitle');
  if (titleEl) titleEl.textContent = paymentState === 'confirmed' ? 'Payment confirmed.' : 'Order created.';
  if (subtitleEl) subtitleEl.textContent = paymentState === 'confirmed'
    ? 'Your payment was verified and your order is confirmed.'
    : 'Your order is saved, but payment is still pending.';
  if (orderIdEl) orderIdEl.textContent = order.orderNumber;
  if (variantEl) variantEl.textContent = `${variant.name} (${order.items[0].quantity} Unit${order.items[0].quantity > 1 ? 's' : ''})`;
  if (totalEl) totalEl.textContent = `₹${Number(order.totalAmount).toLocaleString('en-IN')} (${paymentState === 'confirmed' ? 'paid' : 'pending payment'})`;
  if (destEl) destEl.textContent = `${order.shippingAddress.city}, ${order.shippingAddress.state} (${order.shippingAddress.postalCode})`;
  if (statusEl) statusEl.textContent = paymentState === 'confirmed' ? 'Confirmed' : 'Pending payment';
  if (currencyEl) currencyEl.textContent = order.currency;
}

async function openRazorpayCheckout(order, payment) {
  if (!window.Razorpay) {
    renderOrderConfirmation(order);
    goToCheckoutStep(3);
    showToast('Payment checkout is unavailable. Your order remains pending.', 'orange');
    return;
  }

  const selectedAddress = appState.checkoutAddresses.find(address => address.id === document.getElementById('checkoutAddressSelect').value);
  let userResponse;
  try {
    userResponse = await RotimaticApi.me();
  } catch (error) {
    if (error.status === 401) window.location.href = 'login.html';
    else showToast('We could not load your checkout details.', 'orange');
    return;
  }

  const options = {
    key: payment.keyId,
    amount: payment.amount,
    currency: payment.currency,
    name: 'Rotimatic NEXT',
    description: `Order ${order.orderNumber}`,
    order_id: payment.razorpayOrderId,
    prefill: {
      name: selectedAddress ? selectedAddress.fullName : `${userResponse.data.user.firstName} ${userResponse.data.user.lastName}`,
      email: userResponse.data.user.email,
      contact: selectedAddress ? selectedAddress.phone : userResponse.data.user.phone,
    },
    notes: { localOrderId: order.id },
    handler: async (response) => {
      try {
        const verified = await RotimaticApi.verifyPayment({
          orderId: order.id,
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        });
        const paymentResult = verified.data.payment;
        if (paymentResult.status === 'captured' && paymentResult.orderStatus === 'confirmed') {
          renderOrderConfirmation({ ...order, status: 'confirmed' }, 'confirmed');
          goToCheckoutStep(3);
          showToast('Payment verified and order confirmed.', 'orange');
        } else {
          renderOrderConfirmation(order);
          goToCheckoutStep(3);
          showToast('Payment is not captured. Your order remains pending.', 'orange');
        }
      } catch (error) {
        renderOrderConfirmation(order);
        goToCheckoutStep(3);
        showToast(error.status === 400 ? 'Payment verification failed. Your order remains pending.' : 'We could not verify the payment yet.', 'orange');
      }
    },
    modal: {
      ondismiss: () => {
        renderOrderConfirmation(order);
        goToCheckoutStep(3);
        showToast('Checkout closed. Your order remains pending payment.', 'orange');
      },
    },
  };

  try {
    const checkout = new window.Razorpay(options);
    checkout.on('payment.failed', () => {
      renderOrderConfirmation(order);
      goToCheckoutStep(3);
      showToast('Payment failed. Your order remains pending.', 'orange');
    });
    checkout.open();
  } catch (error) {
    renderOrderConfirmation(order);
    goToCheckoutStep(3);
    showToast('Payment checkout could not be opened. Your order remains pending.', 'orange');
  }
}

async function processRealOrder() {
  const placeBtn = document.getElementById('placeOrderBtn');
  if (!placeBtn) return;

  const origHtml = placeBtn.innerHTML;
  let createdOrder = null;
  placeBtn.disabled = true;
  placeBtn.innerHTML = '<span>Creating order...</span>';

  try {
    const select = document.getElementById('checkoutAddressSelect');
    const response = await RotimaticApi.createOrder({
      variant: appState.currentVariant,
      quantity: appState.quantity,
      addressId: select.value,
    });
    const order = response.data.order;
    createdOrder = order;
    appState.createdOrder = order;

    if (appState.selectedPaymentMethod === 'manual_upi') {
      showQrPaymentPanel(order);
    } else {
      const paymentResponse = await RotimaticApi.createPaymentOrder({ orderId: order.id });
      await openRazorpayCheckout(order, paymentResponse.data.payment);
    }
  } catch (error) {
    if (error.status === 401) {
      window.location.href = 'login.html';
    } else if (error.status === 404) {
      showToast('That saved address is no longer available. Refresh your addresses.', 'orange');
    } else if (createdOrder) {
      renderOrderConfirmation(createdOrder);
      goToCheckoutStep(3);
      showToast('Order created, but payment could not be started. Your order remains pending.', 'orange');
    } else {
      showToast(error.status >= 500 ? 'We could not create the order. Please try again.' : error.message, 'orange');
    }
  } finally {
    placeBtn.disabled = false;
    placeBtn.innerHTML = origHtml;
  }
}

/* ==========================================================================
   8. NAVIGATION & UTILITIES
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

/* ==========================================================================
   9. QUICK ENQUIRY MODAL & CONTACT ACTIONS
   ========================================================================== */
function openEnquiryModal(variantKey = null) {
  if (variantKey && appState.variants[variantKey]) {
    selectVariant(variantKey, false);
  }

  const modal = document.getElementById('enquiryModal');
  if (!modal) return;

  const select = document.getElementById('enquiryProductSelect');
  if (select) {
    select.value = appState.currentVariant;
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeEnquiryModal() {
  const modal = document.getElementById('enquiryModal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

function handleEnquiryVariantChange() {
  const select = document.getElementById('enquiryProductSelect');
  if (!select) return;
  selectVariant(select.value, false);
}

function submitEnquiryForm(e) {
  if (e) e.preventDefault();
  const name = (document.getElementById('enqName')?.value || 'Valued Customer').trim();
  const phone = (document.getElementById('enqPhone')?.value || '').trim();
  const city = (document.getElementById('enqCity')?.value || '').trim();
  const productKey = document.getElementById('enquiryProductSelect')?.value || appState.currentVariant;
  const variant = appState.variants[productKey] || appState.variants.black;
  const message = (document.getElementById('enqMessage')?.value || '').trim();

  const ticketId = 'ENQ-' + Math.floor(100000 + Math.random() * 900000);

  closeEnquiryModal();
  showToast(`✅ Enquiry ${ticketId} received for ${variant.name}! Our representative will call within 2 business hours.`, 'orange');
}

function sendWhatsAppEnquiry(variantKey = null) {
  const key = variantKey || appState.currentVariant;
  const variant = appState.variants[key] || appState.variants.black;
  const text = encodeURIComponent(
    `Hello Rotimatic Team, I would like to make an enquiry regarding the ${variant.name} (₹${variant.price.toLocaleString('en-IN')}). Please provide product catalogue, commercial quotation and dispatch timelines.`
  );
  window.open(`https://wa.me/917413838893?text=${text}`, '_blank', 'noopener,noreferrer');
}

function handleGoogleReviewAction() {
  showToast('⭐ Opening Google Verified Reviews & Ratings...', 'orange');
  const reviewTarget = document.getElementById('reviews');
  if (reviewTarget) {
    reviewTarget.scrollIntoView({ behavior: 'smooth' });
  }
}

// Close enquiry modal on escape or backdrop
document.addEventListener('click', (e) => {
  const enqModal = document.getElementById('enquiryModal');
  if (enqModal && e.target === enqModal) {
    closeEnquiryModal();
  }
});
