const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const ngoRepository = require('../repositories/ngoRepository');

class AuthService {
  toUserDto(user, ngoProfile = null) {
    if (!user) return null;
    const dto = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      enabled: Boolean(user.enabled),
      createdAt: user.created_at
    };
    if (ngoProfile) {
      dto.ngoProfile = {
        id: ngoProfile.id,
        organisationName: ngoProfile.organisation_name,
        registrationNumber: ngoProfile.registration_number,
        address: ngoProfile.address,
        verificationStatus: ngoProfile.verification_status,
        reviewedAt: ngoProfile.reviewed_at
      };
    }
    return dto;
  }

  async register({ name, email, password, role, ngoData = {} }) {
    // 1. Role validation - Strict guard against public ADMIN registration
    const allowedPublicRoles = ['DONOR', 'NGO', 'VOLUNTEER'];
    const sanitizedRole = (role || '').toUpperCase().trim();

    if (!allowedPublicRoles.includes(sanitizedRole)) {
      const error = new Error('Public registration is permitted only for DONOR, NGO, or VOLUNTEER roles.');
      error.statusCode = 400;
      throw error;
    }

    // 2. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      const error = new Error('A valid email address is required.');
      error.statusCode = 400;
      throw error;
    }

    // 3. Password length validation
    if (!password || password.length < 6) {
      const error = new Error('Password must be at least 6 characters long.');
      error.statusCode = 400;
      throw error;
    }

    // 4. Duplicate email check
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      const error = new Error('An account with this email address already exists.');
      error.statusCode = 409;
      throw error;
    }

    // 5. NGO specific fields check
    if (sanitizedRole === 'NGO') {
      if (!ngoData.organisationName || !ngoData.organisationName.trim()) {
        const error = new Error('NGO organisation name is required.');
        error.statusCode = 400;
        throw error;
      }
      if (!ngoData.registrationNumber || !ngoData.registrationNumber.trim()) {
        const error = new Error('NGO official registration number is required.');
        error.statusCode = 400;
        throw error;
      }
      if (!ngoData.address || !ngoData.address.trim()) {
        const error = new Error('NGO operational address is required.');
        error.statusCode = 400;
        throw error;
      }
    }

    // 6. Hash password with BCrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 7. Create User
    const user = await userRepository.create({
      name,
      email,
      passwordHash,
      role: sanitizedRole,
      enabled: 1
    });

    // 8. If NGO, create NGO profile with PENDING status
    let ngoProfile = null;
    if (sanitizedRole === 'NGO') {
      ngoProfile = await ngoRepository.create({
        userId: user.id,
        organisationName: ngoData.organisationName,
        registrationNumber: ngoData.registrationNumber,
        address: ngoData.address
      });
    }

    return this.toUserDto(user, ngoProfile);
  }

  async login(email, password) {
    if (!email || !password) {
      const error = new Error('Email and password are required.');
      error.statusCode = 400;
      throw error;
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    if (!user.enabled) {
      const error = new Error('This account has been disabled by an administrator. Please contact support.');
      error.statusCode = 403;
      throw error;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    let ngoProfile = null;
    if (user.role === 'NGO') {
      ngoProfile = await ngoRepository.findByUserId(user.id);
    }

    return this.toUserDto(user, ngoProfile);
  }

  async getCurrentUser(userId) {
    const user = await userRepository.findById(userId);
    if (!user) return null;

    let ngoProfile = null;
    if (user.role === 'NGO') {
      ngoProfile = await ngoRepository.findByUserId(user.id);
    }

    return this.toUserDto(user, ngoProfile);
  }
}

module.exports = new AuthService();
