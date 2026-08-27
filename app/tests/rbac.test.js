const roleMiddleware = require('../src/middleware/roleMiddleware');

describe('Role-Based Access Control (RBAC) Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  test('should allow ADMIN for any restricted role route', () => {
    mockReq.user = { id: 'admin-1', role: 'ADMIN' };
    const middleware = roleMiddleware('MANUFACTURER', 'DISTRIBUTOR');

    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  test('should allow user with matching role', () => {
    mockReq.user = { id: 'mfg-1', role: 'MANUFACTURER' };
    const middleware = roleMiddleware('MANUFACTURER');

    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  test('should reject user with forbidden role with 403', () => {
    mockReq.user = { id: 'pharm-1', role: 'PHARMACY' };
    const middleware = roleMiddleware('MANUFACTURER');

    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Access denied') }));
  });

  test('should reject unauthenticated request with 401', () => {
    mockReq.user = null;
    const middleware = roleMiddleware('MANUFACTURER');

    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });
});
