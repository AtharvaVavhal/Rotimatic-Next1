const PRODUCT_CATALOG = {
  productId: 'rotimatic-next',
  currency: 'INR',
  variants: {
    black: {
      variantId: 'black',
      productName: 'Rotimatic NEXT',
      variantName: 'Black Edition',
      unitPriceCents: 2499900,
    },
    white: {
      variantId: 'white',
      productName: 'Rotimatic NEXT',
      variantName: 'Classic White',
      unitPriceCents: 1499900,
    },
  },
};

function findVariant(variantId) {
  return PRODUCT_CATALOG.variants[variantId] || null;
}

module.exports = { PRODUCT_CATALOG, findVariant };
