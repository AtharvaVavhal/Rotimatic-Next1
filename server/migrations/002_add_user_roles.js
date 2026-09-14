exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn('users', {
    role: {
      type: 'varchar(20)',
      notNull: true,
      default: 'customer',
    },
  });

  pgm.addConstraint('users', 'users_role_chk', {
    check: "role IN ('customer', 'admin')",
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('users', 'users_role_chk');
  pgm.dropColumn('users', 'role');
};
