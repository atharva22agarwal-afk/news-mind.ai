class AuthService {
  constructor() {
    this.sessions = new Map(); // In-memory sessions (use Redis in production)
  }

  // Generate unique user ID
  generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Create or get user session
  getOrCreateUser(email, name) {
    // Check if user exists
    let user = Array.from(this.sessions.values()).find(u => u.email === email);
    
    if (!user) {
      // Create new user
      user = {
        id: this.generateUserId(),
        email: email,
        name: name,
        createdAt: new Date()
      };
      this.sessions.set(user.id, user);
    }
    
    return user;
  }

  // Get user by ID
  getUserById(userId) {
    return this.sessions.get(userId);
  }
}

module.exports = new AuthService();