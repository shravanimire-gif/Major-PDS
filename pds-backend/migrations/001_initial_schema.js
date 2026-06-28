/* eslint-disable camelcase */
exports.up = (pgm) => {
    // Extensions
    pgm.createExtension('pgcrypto', { ifNotExists: true });

    // Enum types
    pgm.createType('user_role', ['admin', 'shopkeeper', 'beneficiary']);
    pgm.createType('ration_category', ['APL', 'BPL', 'AAY']);

    // areas
    pgm.createTable('areas', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        name: { type: 'varchar(100)', notNull: true, unique: true },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') },
    });

    // policies
    pgm.createTable('policies', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        category: { type: 'ration_category', notNull: true, unique: true },
        rice_per_person_kg: { type: 'numeric(5,2)', notNull: true, default: 0 },
        wheat_per_person_kg: { type: 'numeric(5,2)', notNull: true, default: 0 },
        sugar_per_person_kg: { type: 'numeric(5,2)', notNull: true, default: 0 },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') },
    });

    // users
    pgm.createTable('users', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        role: { type: 'user_role', notNull: true },
        name: { type: 'varchar(150)' },
        email: { type: 'varchar(255)', unique: true },
        mobile: { type: 'varchar(15)', unique: true },
        password_hash: { type: 'text' },
        is_active: { type: 'boolean', notNull: true, default: true },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') },
    });

    // shops
    pgm.createTable('shops', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        shop_code: { type: 'varchar(20)', notNull: true, unique: true },
        shop_name: { type: 'varchar(150)', notNull: true },
        area_id: { type: 'uuid', notNull: true, references: 'areas', onDelete: 'RESTRICT' },
        shopkeeper_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') },
    });

    pgm.createIndex('shops', 'area_id');
    pgm.createIndex('shops', 'shopkeeper_id');

    // ration_cards
    pgm.createTable('ration_cards', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        card_number: { type: 'varchar(50)', notNull: true, unique: true },
        category: { type: 'ration_category', notNull: true },
        head_user_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
        shop_id: { type: 'uuid', notNull: true, references: 'shops', onDelete: 'RESTRICT' },
        area_id: { type: 'uuid', notNull: true, references: 'areas', onDelete: 'RESTRICT' },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') },
    });

    pgm.createIndex('ration_cards', 'shop_id');
    pgm.createIndex('ration_cards', 'area_id');
    pgm.createIndex('ration_cards', 'head_user_id');

    // family_members
    pgm.createTable('family_members', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        ration_card_id: { type: 'uuid', notNull: true, references: 'ration_cards', onDelete: 'CASCADE' },
        user_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
        name: { type: 'varchar(150)', notNull: true },
        age: { type: 'integer', notNull: true },
        is_head: { type: 'boolean', notNull: true, default: false },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') },
    });

    pgm.createIndex('family_members', 'ration_card_id');
    pgm.createIndex('family_members', 'user_id');

    // wallets
    pgm.createTable('wallets', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        ration_card_id: { type: 'uuid', notNull: true, unique: true, references: 'ration_cards', onDelete: 'CASCADE' },
        rice_balance_kg: { type: 'numeric(8,2)', notNull: true, default: 0 },
        wheat_balance_kg: { type: 'numeric(8,2)', notNull: true, default: 0 },
        sugar_balance_kg: { type: 'numeric(8,2)', notNull: true, default: 0 },
        updated_at: { type: 'timestamp', default: pgm.func('NOW()') },
    });

    // transactions
    pgm.createTable('transactions', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        ration_card_id: { type: 'uuid', notNull: true, references: 'ration_cards', onDelete: 'CASCADE' },
        shop_id: { type: 'uuid', notNull: true, references: 'shops', onDelete: 'RESTRICT' },
        dispensed_by: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
        rice_qty: { type: 'numeric(8,2)', notNull: true, default: 0 },
        wheat_qty: { type: 'numeric(8,2)', notNull: true, default: 0 },
        sugar_qty: { type: 'numeric(8,2)', notNull: true, default: 0 },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') },
    });

    pgm.createIndex('transactions', 'ration_card_id');
    pgm.createIndex('transactions', 'shop_id');

    // otp_verifications
    pgm.createTable('otp_verifications', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        mobile: { type: 'varchar(15)', notNull: true },
        otp_hash: { type: 'text', notNull: true },
        expires_at: { type: 'timestamp', notNull: true },
        is_used: { type: 'boolean', notNull: true, default: false },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') },
    });

    pgm.createIndex('otp_verifications', 'mobile');

    // Seed: default policies
    pgm.sql(`
    INSERT INTO policies (category, rice_per_person_kg, wheat_per_person_kg, sugar_per_person_kg) VALUES
      ('APL', 3.00, 2.00, 0.50),
      ('BPL', 5.00, 3.00, 1.00),
      ('AAY', 7.00, 8.00, 1.00)
    ON CONFLICT (category) DO NOTHING;
  `);

    // Seed: admin user (password: admin123)
    pgm.sql(`
    INSERT INTO users (role, email, password_hash)
    VALUES ('admin', 'admin@pds.gov', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi')
    ON CONFLICT (email) DO NOTHING;
  `);
};

exports.down = (pgm) => {
    pgm.dropTable('otp_verifications');
    pgm.dropTable('transactions');
    pgm.dropTable('wallets');
    pgm.dropTable('family_members');
    pgm.dropTable('ration_cards');
    pgm.dropTable('shops');
    pgm.dropTable('users');
    pgm.dropTable('policies');
    pgm.dropTable('areas');
    pgm.dropType('ration_category');
    pgm.dropType('user_role');
};
