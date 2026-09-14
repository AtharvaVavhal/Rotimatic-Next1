/**
 * Adds manual UPI/QR payment support on top of the existing payments model.
 *
 * - payments.status gains 'rejected' (admin-reviewed manual payments that
 *   failed verification); the existing values are untouched.
 * - payments gains customer/admin-supplied fields needed only by the manual
 *   flow (reference_id, verified_at/by, rejected_at/by, rejection_reason).
 *   They stay NULL for Razorpay rows, which never populate them.
 * - payment_settings is a new single-row table (id is pinned to 1) holding
 *   the client's configured UPI ID and QR image reference. It starts empty
 *   — no fabricated UPI ID or QR image ships by default.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.dropConstraint('payments', 'payments_status_chk');
  pgm.addConstraint('payments', 'payments_status_chk', {
    check: "status IN ('pending', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded', 'rejected')",
  });

  pgm.addColumn('payments', {
    reference_id: { type: 'varchar(64)' },
    verified_at: { type: 'timestamptz' },
    verified_by: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    rejected_at: { type: 'timestamptz' },
    rejected_by: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    rejection_reason: { type: 'varchar(500)' },
  });

  pgm.createIndex('payments', 'reference_id');

  pgm.sql(`
    CREATE TABLE payment_settings (
      id             INTEGER PRIMARY KEY DEFAULT 1,
      upi_id         VARCHAR(100),
      qr_image_path  VARCHAR(150),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by     UUID REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT payment_settings_single_row_chk CHECK (id = 1)
    );
  `);

  pgm.sql(`
    CREATE TRIGGER trg_payment_settings_set_updated_at
    BEFORE UPDATE ON payment_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS payment_settings;');
  pgm.dropIndex('payments', 'reference_id');
  pgm.dropColumn('payments', [
    'reference_id',
    'verified_at',
    'verified_by',
    'rejected_at',
    'rejected_by',
    'rejection_reason',
  ]);
  pgm.dropConstraint('payments', 'payments_status_chk');
  pgm.addConstraint('payments', 'payments_status_chk', {
    check: "status IN ('pending', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded')",
  });
};
