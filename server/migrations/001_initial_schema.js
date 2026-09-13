/**
 * Initial schema for Rotimatic NEXT.
 *
 * Creates: users, sessions, addresses, orders, order_items, payments.
 * No seed data, no application logic — schema/constraints only.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // UUID generation used as the default for every primary key below.
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

  // Reusable trigger function: keeps updated_at current on every UPDATE.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Reusable trigger function: normalizes users.email to lowercase on write.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION normalize_user_email()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.email = lower(NEW.email);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // ------------------------------------------------------------------
  // users
  // ------------------------------------------------------------------
  pgm.sql(`
    CREATE TABLE users (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name     VARCHAR(150),
      last_name      VARCHAR(150),
      email          VARCHAR(255) NOT NULL,
      password_hash  TEXT NOT NULL,
      phone          VARCHAR(30),
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT users_email_unique UNIQUE (email),
      CONSTRAINT users_email_lowercase_chk CHECK (email = lower(email))
    );
  `);

  pgm.sql(`
    CREATE TRIGGER trg_users_normalize_email
    BEFORE INSERT OR UPDATE OF email ON users
    FOR EACH ROW EXECUTE FUNCTION normalize_user_email();
  `);

  pgm.sql(`
    CREATE TRIGGER trg_users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // ------------------------------------------------------------------
  // sessions
  // ------------------------------------------------------------------
  pgm.sql(`
    CREATE TABLE sessions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at  TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql('CREATE INDEX idx_sessions_user_id ON sessions(user_id);');
  pgm.sql('CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);');

  pgm.sql(`
    CREATE TRIGGER trg_sessions_set_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // ------------------------------------------------------------------
  // addresses
  // ------------------------------------------------------------------
  pgm.sql(`
    CREATE TABLE addresses (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name       VARCHAR(200) NOT NULL,
      phone           VARCHAR(30),
      address_line1   VARCHAR(255) NOT NULL,
      address_line2   VARCHAR(255),
      city            VARCHAR(100) NOT NULL,
      state           VARCHAR(100) NOT NULL,
      postal_code     VARCHAR(20) NOT NULL,
      country         VARCHAR(100) NOT NULL,
      is_default      BOOLEAN NOT NULL DEFAULT false,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql('CREATE INDEX idx_addresses_user_id ON addresses(user_id);');

  // At most one default address per user (partial unique index).
  pgm.sql(`
    CREATE UNIQUE INDEX uq_addresses_default_per_user
    ON addresses(user_id)
    WHERE is_default;
  `);

  pgm.sql(`
    CREATE TRIGGER trg_addresses_set_updated_at
    BEFORE UPDATE ON addresses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // ------------------------------------------------------------------
  // orders
  // ------------------------------------------------------------------
  pgm.sql(`
    CREATE TABLE orders (
      id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      order_number             VARCHAR(50) NOT NULL,
      status                   VARCHAR(20) NOT NULL DEFAULT 'pending',
      subtotal                 NUMERIC(12,2) NOT NULL,
      shipping_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
      tax_amount               NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_amount             NUMERIC(12,2) NOT NULL,
      currency                 VARCHAR(3) NOT NULL DEFAULT 'INR',
      shipping_full_name       VARCHAR(200) NOT NULL,
      shipping_phone           VARCHAR(30) NOT NULL,
      shipping_address_line1   VARCHAR(255) NOT NULL,
      shipping_address_line2   VARCHAR(255),
      shipping_city            VARCHAR(100) NOT NULL,
      shipping_state           VARCHAR(100) NOT NULL,
      shipping_postal_code     VARCHAR(20) NOT NULL,
      shipping_country         VARCHAR(100) NOT NULL,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT orders_order_number_unique UNIQUE (order_number),
      CONSTRAINT orders_status_chk CHECK (
        status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')
      ),
      CONSTRAINT orders_subtotal_nonnegative_chk CHECK (subtotal >= 0),
      CONSTRAINT orders_shipping_amount_nonnegative_chk CHECK (shipping_amount >= 0),
      CONSTRAINT orders_tax_amount_nonnegative_chk CHECK (tax_amount >= 0),
      CONSTRAINT orders_total_amount_nonnegative_chk CHECK (total_amount >= 0)
    );
  `);

  pgm.sql('CREATE INDEX idx_orders_user_id ON orders(user_id);');
  pgm.sql('CREATE INDEX idx_orders_status ON orders(status);');

  pgm.sql(`
    CREATE TRIGGER trg_orders_set_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // ------------------------------------------------------------------
  // order_items
  // ------------------------------------------------------------------
  pgm.sql(`
    CREATE TABLE order_items (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_name  VARCHAR(255) NOT NULL,
      variant       VARCHAR(100),
      quantity      INTEGER NOT NULL,
      unit_price    NUMERIC(12,2) NOT NULL,
      total_price   NUMERIC(12,2) NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT order_items_quantity_positive_chk CHECK (quantity > 0),
      CONSTRAINT order_items_unit_price_nonnegative_chk CHECK (unit_price >= 0),
      CONSTRAINT order_items_total_price_nonnegative_chk CHECK (total_price >= 0)
    );
  `);

  pgm.sql('CREATE INDEX idx_order_items_order_id ON order_items(order_id);');

  // ------------------------------------------------------------------
  // payments
  // ------------------------------------------------------------------
  pgm.sql(`
    CREATE TABLE payments (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id              UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      provider              VARCHAR(50) NOT NULL,
      provider_order_id     VARCHAR(255),
      provider_payment_id   VARCHAR(255),
      amount                NUMERIC(12,2) NOT NULL,
      currency              VARCHAR(3) NOT NULL DEFAULT 'INR',
      status                VARCHAR(20) NOT NULL DEFAULT 'pending',
      method                VARCHAR(50),
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT payments_amount_nonnegative_chk CHECK (amount >= 0),
      CONSTRAINT payments_status_chk CHECK (
        status IN ('pending', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded')
      )
    );
  `);

  pgm.sql('CREATE INDEX idx_payments_order_id ON payments(order_id);');

  // provider_order_id / provider_payment_id are nullable (a payment starts
  // pending, before either external id necessarily exists). Postgres unique
  // indexes already treat NULLs as distinct from one another, so multiple
  // pending payments with no provider id yet do not collide.
  pgm.sql(`
    CREATE UNIQUE INDEX uq_payments_provider_order_id
    ON payments(provider, provider_order_id);
  `);
  pgm.sql(`
    CREATE UNIQUE INDEX uq_payments_provider_payment_id
    ON payments(provider, provider_payment_id);
  `);

  pgm.sql(`
    CREATE TRIGGER trg_payments_set_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS payments;');
  pgm.sql('DROP TABLE IF EXISTS order_items;');
  pgm.sql('DROP TABLE IF EXISTS orders;');
  pgm.sql('DROP TABLE IF EXISTS addresses;');
  pgm.sql('DROP TABLE IF EXISTS sessions;');
  pgm.sql('DROP TABLE IF EXISTS users;');

  pgm.sql('DROP FUNCTION IF EXISTS normalize_user_email();');
  pgm.sql('DROP FUNCTION IF EXISTS set_updated_at();');

  // pgcrypto is intentionally left installed — it is a shared, database-wide
  // extension that other schemas/objects may depend on.
};
