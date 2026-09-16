import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  userId: string;
  role: string;
}

let io: Server;

export const initAdminSocket = (server: HttpServer) => {
  // Initialize Socket.io attached to the Express HTTP Server
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST']
    }
  });

  // Dedicated namespace for administrative live logs
  const adminNamespace = io.of('/admin/live-logs');

  // Socket.io Middleware for strict JWT verification
  adminNamespace.use((socket: Socket, next) => {
    try {
      // Extract token from auth payload or standard headers
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication error: Missing token'));
      }

      // Verify and decode the JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as JwtPayload;

      // Strict role enforcement
      if (decoded.role !== 'ADMIN') {
        return next(new Error('Authentication error: Insufficient privileges, ADMIN role required'));
      }

      // Attach the verified admin to the socket instance for downstream usage
      (socket as any).user = decoded;
      
      next();
    } catch (error) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  // Connection handler
  adminNamespace.on('connection', (socket) => {
    console.log(`[Socket.io Admin] Connected: ${(socket as any).user.userId} (${socket.id})`);
    
    // Optional feature: allow admin clients to subscribe to specific API routes
    socket.on('subscribe', (endpointPath: string) => {
      socket.join(`route:${endpointPath}`);
    });

    socket.on('unsubscribe', (endpointPath: string) => {
      socket.leave(`route:${endpointPath}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io Admin] Disconnected: ${socket.id}`);
    });
  });

  return io;
};

/**
 * Utility function to broadcast live payloads to the admin dashboard.
 * @param logData - The JSON payload representing the API request/response.
 * @param endpointPath - Optional: If provided, targets only admins subscribed to this path.
 */
export const broadcastAdminLog = (logData: any, endpointPath?: string) => {
  if (!io) {
    console.warn('[Socket.io Admin] Warning: Socket server is not initialized.');
    return;
  }

  const adminNamespace = io.of('/admin/live-logs');

  if (endpointPath) {
    // Target specific room (e.g. tracking only /api/v1/payments)
    adminNamespace.to(`route:${endpointPath}`).emit('new-api-log', logData);
  } else {
    // Broadcast to the global "Firehose"
    adminNamespace.emit('new-api-log', logData);
  }
};
