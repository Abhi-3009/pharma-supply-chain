const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const config = require('../config/env');
const logger = require('../utils/logger');

const VALID_ROLES = ['ADMIN', 'MANUFACTURER', 'DISTRIBUTOR', 'WAREHOUSE', 'PHARMACY'];

class AuthService {
  /**
   * Register a new user with hashed password
   */
  async register({ name, email, password, role }) {
    if (!name || !email || !password || !role) {
      const err = new Error('Missing required fields: name, email, password, role');
      err.statusCode = 400;
      throw err;
    }

    const normalizedRole = role.toUpperCase();
    if (!VALID_ROLES.includes(normalizedRole)) {
      const err = new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    if (password.length < 6) {
      const err = new Error('Password must be at least 6 characters long');
      err.statusCode = 400;
      throw err;
    }

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      const err = new Error(`User with email '${email}' already exists`);
      err.statusCode = 409;
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await userRepository.create({
      name,
      email,
      passwordHash,
      role: normalizedRole,
    });

    logger.info('User registered successfully', { userId: user.id, email: user.email, role: user.role });

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
      },
      token,
    };
  }

  /**
   * Login user and issue JWT
   */
  async login({ email, password }) {
    if (!email || !password) {
      const err = new Error('Missing required fields: email, password');
      err.statusCode = 400;
      throw err;
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    const token = this.generateToken(user);

    logger.info('User logged in successfully', { userId: user.id, email: user.email, role: user.role });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    };
  }

  /**
   * Generate signed JWT
   */
  generateToken(user) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
    return jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    return jwt.verify(token, config.JWT_SECRET);
  }
}

module.exports = new AuthService();
