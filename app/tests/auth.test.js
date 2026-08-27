const request = require('supertest');
const app = require('../src/server');
const { mockDb } = require('../src/db/pool');

describe('Authentication Routes', () => {
  beforeEach(() => {
    mockDb.reset();
  });

  describe('POST /auth/register', () => {
    const validUser = {
      name: 'Dr. Alice Smith',
      email: 'alice@pharma.com',
      password: 'SecurePassword123!',
      role: 'MANUFACTURER',
    };

    test('should register a new user successfully with hashed password', async () => {
      const res = await request(app).post('/auth/register').send(validUser);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('User registered successfully');
      expect(res.body.user.email).toBe('alice@pharma.com');
      expect(res.body.user.role).toBe('MANUFACTURER');
      expect(res.body.user.password_hash).toBeUndefined(); // never expose password hash
      expect(res.body.token).toBeDefined();
    });

    test('should return 400 when required fields are missing', async () => {
      const res = await request(app).post('/auth/register').send({ email: 'alice@pharma.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required fields');
    });

    test('should return 400 for invalid role', async () => {
      const res = await request(app).post('/auth/register').send({
        ...validUser,
        role: 'SUPERHERO',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid role');
    });

    test('should return 409 for duplicate email registration', async () => {
      await request(app).post('/auth/register').send(validUser);
      const res = await request(app).post('/auth/register').send(validUser);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/auth/register').send({
        name: 'Bob Jones',
        email: 'bob@warehouse.com',
        password: 'Password123',
        role: 'WAREHOUSE',
      });
    });

    test('should login successfully with valid credentials and return JWT', async () => {
      const res = await request(app).post('/auth/login').send({
        email: 'bob@warehouse.com',
        password: 'Password123',
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Login successful');
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('bob@warehouse.com');
      expect(res.body.user.role).toBe('WAREHOUSE');
    });

    test('should reject invalid password with 401', async () => {
      const res = await request(app).post('/auth/login').send({
        email: 'bob@warehouse.com',
        password: 'WrongPassword',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid email or password');
    });

    test('should reject non-existent user with 401', async () => {
      const res = await request(app).post('/auth/login').send({
        email: 'nonexistent@test.com',
        password: 'Password123',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    test('should return authenticated user details when token is valid', async () => {
      const regRes = await request(app).post('/auth/register').send({
        name: 'Carol Pharmacy',
        email: 'carol@rx.com',
        password: 'Password123',
        role: 'PHARMACY',
      });
      const token = regRes.body.token;

      const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('carol@rx.com');
      expect(res.body.user.role).toBe('PHARMACY');
    });

    test('should return 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Authentication required');
    });
  });
});
