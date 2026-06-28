require('./setup');
const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
});

let adminToken;

beforeAll(async () => {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
        `INSERT INTO users (role, email, password_hash) VALUES ('admin', 'admin@pds.gov', $1)
     ON CONFLICT (email) DO UPDATE SET password_hash = $1`,
        [hash],
    );
});

afterAll(async () => {
    await pool.end();
});

describe('POST /auth/login', () => {
    test('1. valid admin credentials → 200 + token', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'admin@pds.gov', password: 'admin123' });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.role).toBe('admin');
        adminToken = res.body.token;
    });

    test('2. wrong password → 401', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'admin@pds.gov', password: 'wrongpass' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid credentials');
    });

    test('3. missing email → 400 validation error', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ password: 'admin123' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation failed');
    });

    test('4. invalid email format → 400', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'notanemail', password: 'admin123' });

        expect(res.status).toBe(400);
    });

    test('5. missing password → 400', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'admin@pds.gov' });

        expect(res.status).toBe(400);
    });

    test('6. beneficiary token on admin route → 403', async () => {
        const hash = await bcrypt.hash('pass123', 10);
        await pool.query(
            `INSERT INTO users (role, mobile, password_hash) VALUES ('beneficiary', '+919000000001', $1)`,
            [hash],
        );

        // Beneficiaries log in via OTP, so we sign a token manually
        const jwt = require('jsonwebtoken');
        const beneficiaryToken = jwt.sign(
            { id: '00000000-0000-0000-0000-000000000001', role: 'beneficiary' },
            process.env.JWT_SECRET || 'test_secret',
            { expiresIn: '1h' },
        );

        const res = await request(app)
            .get('/api/admin/users')
            .set('Authorization', `Bearer ${beneficiaryToken}`);

        expect(res.status).toBe(403);
    });

    test('7. no token on protected route → 401', async () => {
        const res = await request(app).get('/api/admin/users');
        expect(res.status).toBe(401);
    });

    test('8. OTP send with invalid mobile format → 400', async () => {
        const res = await request(app)
            .post('/auth/otp/send')
            .send({ mobile: '9876543210' });

        expect(res.status).toBe(400);
    });
});
