/* eslint-disable camelcase */
exports.up = (pgm) => {
    // Add last_reset_date to wallets table
    pgm.addColumns('wallets', {
        last_reset_date: {
            type: 'date',
            ifNotExists: true,
        },
    });

    // Add is_active to ration_cards if not exists
    pgm.addColumns('ration_cards', {
        is_active: {
            type: 'boolean',
            notNull: true,
            default: true,
            ifNotExists: true,
        },
    });

    // Add served_by to transactions (alias for dispensed_by for backward compatibility)
    pgm.addColumns('transactions', {
        served_by: {
            type: 'uuid',
            references: 'users',
            onDelete: 'SET NULL',
            ifNotExists: true,
        },
    });

    // Rename rice_qty, wheat_qty, sugar_qty to match code expectations
    pgm.sql(`
        DO $$
        BEGIN
            -- Check if old column names exist and rename them
            IF EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'transactions' AND column_name = 'rice_qty') THEN
                ALTER TABLE transactions RENAME COLUMN rice_qty TO rice_qty_kg;
            END IF;
            
            IF EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'transactions' AND column_name = 'wheat_qty') THEN
                ALTER TABLE transactions RENAME COLUMN wheat_qty TO wheat_qty_kg;
            END IF;
            
            IF EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'transactions' AND column_name = 'sugar_qty') THEN
                ALTER TABLE transactions RENAME COLUMN sugar_qty TO sugar_qty_kg;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- Columns might already be renamed, continue
                NULL;
        END $$;
    `);

    // Add the _kg columns if they don't exist
    pgm.addColumns('transactions', {
        rice_qty_kg: {
            type: 'numeric(8,2)',
            notNull: true,
            default: 0,
            ifNotExists: true,
        },
        wheat_qty_kg: {
            type: 'numeric(8,2)',
            notNull: true,
            default: 0,
            ifNotExists: true,
        },
        sugar_qty_kg: {
            type: 'numeric(8,2)',
            notNull: true,
            default: 0,
            ifNotExists: true,
        },
    });

    // Sync served_by with dispensed_by for existing records
    pgm.sql(`
        UPDATE transactions 
        SET served_by = dispensed_by 
        WHERE served_by IS NULL AND dispensed_by IS NOT NULL;
    `);
};

exports.down = (pgm) => {
    pgm.dropColumns('wallets', ['last_reset_date']);
    pgm.dropColumns('ration_cards', ['is_active']);
    pgm.dropColumns('transactions', ['served_by']);
};
