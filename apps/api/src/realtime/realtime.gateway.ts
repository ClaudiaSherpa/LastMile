import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WS_EVENTS } from '@sherpa/shared';

/**
 * Socket.IO hub. Rooms:
 *  - `ops`            dispatcher map / tender / approvals feed
 *  - `driver:<id>`    tender offers + assignment for one driver
 *  - `delivery:<id>`  live tracking for a consignee link
 * Clients join rooms via the `join` message. REST endpoints remain the source of
 * truth + RBAC; the socket is a push channel.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger('Realtime');

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.debug(`socket connected ${client.id}`);
  }

  @SubscribeMessage(WS_EVENTS.JOIN)
  onJoin(client: Socket, payload: { room: string }) {
    if (payload?.room) {
      client.join(payload.room);
      return { joined: payload.room };
    }
    return { joined: null };
  }

  emitOps(event: string, payload: unknown) {
    this.server?.to('ops').emit(event, payload);
  }
  emitDriver(driverId: string, event: string, payload: unknown) {
    this.server?.to(`driver:${driverId}`).emit(event, payload);
  }
  emitDelivery(deliveryId: string, event: string, payload: unknown) {
    this.server?.to(`delivery:${deliveryId}`).emit(event, payload);
  }
  /** broadcast to every connected client (used sparingly, e.g. global KPIs) */
  emitAll(event: string, payload: unknown) {
    this.server?.emit(event, payload);
  }
}
