import { config } from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

config();

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/triskell_gate';

const client = new pg.Client({ connectionString, ssl: false });

async function seed() {
  await client.connect();
  console.log('🌱 Starting PostgreSQL seed...\n');

  try {
    await client.query('BEGIN');

    // Fix serial sequences that may be out of sync with existing data
    const serialTables = [
      'organizers', 'events', 'ticket_types', 'orders', 'tickets',
      'staff', 'validation_logs', 'settings', 'sales_stats',
      'platform_fees', 'invoices', 'subscriptions',
    ];
    for (const tbl of serialTables) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('${tbl}', 'id'),
                       COALESCE((SELECT MAX(id) FROM ${tbl}), 0) + 1, false)`
      );
    }
    console.log('🔧 Serial sequences synced\n');

    // --- Organizer ---
    const orgRes = await client.query(
      `INSERT INTO organizers (name, email, country, currency)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, name`,
      ['X-Ops Conference', 'info@xopsconference.com', 'AE', 'EUR']
    );
    let organizerId;
    if (orgRes.rows.length) {
      organizerId = orgRes.rows[0].id;
      console.log(`✅ Organizer created: ${orgRes.rows[0].name} (id=${organizerId})`);
    } else {
      const existing = await client.query(
        `SELECT id, name FROM organizers WHERE email = $1`,
        ['info@xopsconference.com']
      );
      organizerId = existing.rows[0].id;
      console.log(`ℹ️  Organizer already exists: ${existing.rows[0].name} (id=${organizerId})`);
    }

    // --- Staff admin ---
    const passwordHash = await bcrypt.hash('HsmStaff2026!', 12);
    const staffRes = await client.query(
      `INSERT INTO staff (email, name, password_hash, auth_provider, role, permissions, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, role`,
      [
        'teststaff@hsm.dev',
        'HSM Test Admin',
        passwordHash,
        'local',
        'admin',
        JSON.stringify(['all']),
        true,
      ]
    );
    if (staffRes.rows.length) {
      console.log(`✅ Staff created: ${staffRes.rows[0].email} (role=${staffRes.rows[0].role})`);
    } else {
      console.log('ℹ️  Staff teststaff@hsm.dev already exists');
    }

    // --- Event ---
    const eventRes = await client.query(
      `INSERT INTO events
         (name, slug, description, location, start_date, end_date,
          max_tickets, status, platform_fee_percent, organizer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (slug) DO NOTHING
       RETURNING id, name, slug`,
      [
        'X-Ops Dubai 2026',
        'xops-dubai-2026',
        'The premier DevSecOps & platform engineering conference in the Middle East',
        'Dubai, UAE',
        '2026-07-20T08:00:00Z',
        '2026-07-22T18:00:00Z',
        500,
        'active',
        3.0,
        organizerId,
      ]
    );
    let eventId;
    if (eventRes.rows.length) {
      eventId = eventRes.rows[0].id;
      console.log(`✅ Event created: ${eventRes.rows[0].name} (slug=${eventRes.rows[0].slug}, id=${eventId})`);
    } else {
      const existing = await client.query(
        `SELECT id, name FROM events WHERE slug = $1`,
        ['xops-dubai-2026']
      );
      eventId = existing.rows[0].id;
      console.log(`ℹ️  Event already exists: ${existing.rows[0].name} (id=${eventId})`);
    }

    // --- Ticket Types ---
    const ticketTypes = [
      {
        name: 'Early Bird',
        description: 'Discounted early-access ticket',
        price: 49.0,
        maxQuantity: 100,
        saleStart: '2026-01-01T00:00:00Z',
        saleEnd: '2026-06-30T23:59:59Z',
      },
      {
        name: 'General Admission',
        description: 'Standard conference pass — all sessions included',
        price: 99.0,
        maxQuantity: 300,
        saleStart: '2026-01-01T00:00:00Z',
        saleEnd: '2026-07-15T23:59:59Z',
      },
      {
        name: 'VIP',
        description: 'VIP pass with front-row seating, speaker dinner & swag bag',
        price: 249.0,
        maxQuantity: 50,
        saleStart: '2026-01-01T00:00:00Z',
        saleEnd: '2026-07-15T23:59:59Z',
      },
    ];

    console.log('\n🎫 Ticket types:');
    for (const tt of ticketTypes) {
      // Use a subquery to check existence by (event_id, name) since there's no unique constraint
      const exists = await client.query(
        `SELECT id FROM ticket_types WHERE event_id = $1 AND name = $2`,
        [eventId, tt.name]
      );
      if (exists.rows.length) {
        console.log(`   ℹ️  ${tt.name}: already exists (id=${exists.rows[0].id})`);
        continue;
      }
      const res = await client.query(
        `INSERT INTO ticket_types
           (event_id, name, description, price, max_quantity, sale_start_date, sale_end_date, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, name, price`,
        [eventId, tt.name, tt.description, tt.price, tt.maxQuantity, tt.saleStart, tt.saleEnd, true]
      );
      console.log(`   ✅ ${res.rows[0].name}: €${res.rows[0].price} (id=${res.rows[0].id})`);
    }

    // --- Settings ---
    const settingsData = [
      { key: 'platform_fee_percent', value: '3.0', category: 'payment', description: 'Default platform fee percentage', isPublic: false },
      { key: 'stripe_fee_percent', value: '2.9', category: 'payment', description: 'Stripe processing fee percentage', isPublic: false },
      { key: 'stripe_fee_fixed', value: '0.30', category: 'payment', description: 'Stripe fixed fee per transaction (EUR)', isPublic: false },
      { key: 'max_tickets_per_order', value: '10', category: 'sales', description: 'Maximum tickets per single order', isPublic: false },
      { key: 'support_email', value: 'support@hsm.dev', category: 'contact', description: 'Support email address', isPublic: true },
      { key: 'company_name', value: 'TriskelGate by HSM', category: 'general', description: 'Platform display name', isPublic: true },
      { key: 'enable_qr_validation', value: 'true', category: 'validation', description: 'Enable QR code ticket validation', isPublic: false },
      { key: 'refund_policy_days', value: '14', category: 'payment', description: 'Days allowed for refund requests', isPublic: false },
    ];

    console.log('\n⚙️  Settings:');
    for (const s of settingsData) {
      const res = await client.query(
        `INSERT INTO settings (key, value, category, description, is_public)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (key) DO NOTHING
         RETURNING key, value`,
        [s.key, s.value, s.category, s.description, s.isPublic]
      );
      if (res.rows.length) {
        console.log(`   ✅ ${res.rows[0].key} = ${res.rows[0].value}`);
      } else {
        console.log(`   ℹ️  ${s.key} already exists`);
      }
    }

    await client.query('COMMIT');

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   • Organizer: X-Ops Conference (info@xopsconference.com)');
    console.log('   • Staff admin: teststaff@hsm.dev / HsmStaff2026!');
    console.log('   • Event: X-Ops Dubai 2026 (Jul 20-22)');
    console.log(`   • Ticket types: ${ticketTypes.length} tiers (Early Bird €49, General €99, VIP €249)`);
    console.log(`   • Settings: ${settingsData.length} entries`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
