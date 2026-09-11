# Rotimatic NEXT — Automatic Roti Maker Landing Page

A premium, modern **3D-styled e-commerce landing page** for **Rotimatic NEXT — Automatic Roti Maker**, designed in an Apple / Dyson product showcase aesthetic with dark charcoal surfaces, studio lighting, and signature orange (`#FF8A00`) brand accents.

---

## ✨ Features

- **Hero Showcase**: Full-screen studio lighting with ambient champagne/orange glow, bold typography, and interactive 3D perspective tilt & specular glare on mouse move.
- **Interactive Variant Switcher**: Side-by-side selectable cards for **Polar White (₹14,999)** and **Onyx Black (₹24,999)** with live hero image transition, price calculation, and 5-year guarantee badge.
- **"How It Works" Chamber Telemetry**: Simulated real-time cooking telemetry HUD with temperature readings (`235°C`), play/pause controls, timeline scrubber, and 3-step synchronization (*Add Ingredients → Knead & Press → Fresh Puffed Roti*).
- **6 Feature Highlights**: Glassmorphic cards with glowing orange hover accents showcasing circular precision, 60+ rotis/hour, zero mess, AI calibration, easy cleaning, and food-grade hygiene.
- **Specs & Pricing Matrix**: Comprehensive hardware comparison table between Polar White and Onyx Black with instant purchase triggers.
- **Social Proof & Google Reviews**: Authentic Google rating badge (**4.6★ / 5.0** based on 4,892 verified customer reviews) and 4 customer testimonials from major Indian metros.
- **Top Offers Strip**: Festive launch ticker with 5-year guarantee, 50% advance booking notice, and direct WhatsApp customer care hotline.
- **Dummy Checkout & Buy Now Flow**: Complete multi-step checkout modal with customer address form, order summary with GST breakdown, and placeholder payment options (UPI, Cards, COD/Advance).
- **Production-Ready & Zero Dependencies**: Built with modern semantic HTML5, CSS3, and Vanilla JavaScript. Runs directly in any web browser without build steps or servers.

---

## 🚀 Getting Started

Simply clone or download the repository, and open `index.html` in any modern web browser:

```bash
# Clone the repository
git clone <YOUR_GITHUB_REPO_URL>

# Open index.html directly
start index.html
```

---

## 🛠️ Project Structure

```
rotimatic-next/
├── index.html        # Main semantic HTML5 document with all 9 sections
├── styles.css        # Apple/Dyson style design system, 3D studio lighting, animations
├── app.js            # Interactive 3D tilt, variant switcher, video HUD, checkout modal
├── README.md         # Documentation & guide
└── assets/           # High-resolution 3D product renders
    ├── rotimatic-white.jpg
    ├── rotimatic-black.jpg
    └── roti-demo.jpg
```

---

## 💳 Payment Gateway Handover Note

The current checkout flow is running in **Client Demo Mode** with simulated payment processing:
- Source code in `app.js` is marked with:
  ```javascript
  // TODO: integrate real payment gateway once client provides merchant account (Razorpay/PayU/Stripe)
  ```
- Clicking **"Place Order"** simulates a 1-second processing state before transitioning to the **Order Confirmation** screen with a generated Order ID (`#ROTI-2026-XXXX`).
