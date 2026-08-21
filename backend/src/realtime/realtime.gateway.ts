import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import type { Server, Socket } from 'socket.io';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { RealtimeAccessService } from './realtime-access.service.js';
import { RealtimeAuthService } from './realtime-auth.service.js';

interface RealtimeSocketData {
  user?: AuthenticatedUser;
}

type RealtimeSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  RealtimeSocketData
>;

@WebSocketGateway({ namespace: '/realtime' })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly auth: RealtimeAuthService,
    private readonly access: RealtimeAccessService,
  ) {}

  async handleConnection(client: RealtimeSocket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) return;
    const user = await this.auth.authenticate(token);
    if (!user) {
      client.disconnect(true);
      return;
    }
    client.data.user = user;
  }

  @SubscribeMessage('subscribe:product')
  async subscribeProduct(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() body: { productId?: string },
  ) {
    const productId = this.requireUuid(body?.productId);
    if (!(await this.access.canReadProduct(productId))) throw this.notFound();
    await client.join(this.productRoom(productId));
    return this.subscribed(
      this.productRoom(productId),
      `/products/${productId}`,
    );
  }

  @SubscribeMessage('subscribe:auction')
  async subscribeAuction(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() body: { auctionId?: string },
  ) {
    const auctionId = this.requireUuid(body?.auctionId);
    if (!(await this.access.canReadAuction(auctionId))) throw this.notFound();
    await client.join(this.auctionRoom(auctionId));
    return this.subscribed(
      this.auctionRoom(auctionId),
      `/auctions/${auctionId}`,
    );
  }

  @SubscribeMessage('subscribe:order')
  async subscribeOrder(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() body: { orderId?: string },
  ) {
    const user = this.requireUser(client);
    const orderId = this.requireUuid(body?.orderId);
    if (!(await this.access.canReadOrder(user, orderId))) throw this.notFound();
    await client.join(this.orderRoom(orderId));
    return this.subscribed(this.orderRoom(orderId), `/orders/${orderId}`);
  }

  @SubscribeMessage('subscribe:seller-order')
  async subscribeSellerOrder(
    @ConnectedSocket() client: RealtimeSocket,
    @MessageBody() body: { sellerOrderId?: string },
  ) {
    const user = this.requireUser(client);
    const id = this.requireUuid(body?.sellerOrderId);
    const access = await this.access.canReadSellerOrder(user, id);
    if (!access) throw this.notFound();
    await client.join(this.sellerOrderRoom(id));
    const path =
      user.role === 'SELLER'
        ? `/seller/orders/${id}`
        : `/orders/${access.orderId}`;
    return this.subscribed(this.sellerOrderRoom(id), path);
  }

  emitProduct(productId: string, event: unknown): void {
    this.server
      .to(this.productRoom(productId))
      .emit('product.stock.updated', event);
  }

  emitAuction(auctionId: string, event: unknown): void {
    this.server
      .to(this.auctionRoom(auctionId))
      .emit('auction.bid.accepted', event);
  }

  emitOrder(orderId: string, event: unknown): void {
    this.server.to(this.orderRoom(orderId)).emit('order.status.updated', event);
  }

  emitSellerOrder(
    sellerOrderId: string,
    orderId: string,
    event: unknown,
  ): void {
    this.server
      .to(this.sellerOrderRoom(sellerOrderId))
      .emit('seller-order.status.updated', event);
    this.server
      .to(this.orderRoom(orderId))
      .emit('seller-order.status.updated', event);
  }

  private requireUser(client: RealtimeSocket): AuthenticatedUser {
    if (!client.data.user) throw new WsException('Authentication required');
    return client.data.user;
  }

  private requireUuid(value: string | undefined): string {
    if (!value || !isUUID(value, '4'))
      throw new WsException('Invalid resource id');
    return value;
  }

  private extractToken(client: RealtimeSocket): string | null {
    const authToken: unknown = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken) return authToken;
    const header = client.handshake.headers.authorization;
    if (!header) return null;
    const [scheme, token, extra] = header.split(' ');
    return scheme === 'Bearer' && token && !extra ? token : null;
  }

  private subscribed(room: string, path: string) {
    return { subscribed: true, room, resync: { method: 'GET', path } };
  }

  private notFound(): WsException {
    return new WsException('Resource not found');
  }

  private productRoom(id: string): string {
    return `product:${id}`;
  }
  private auctionRoom(id: string): string {
    return `auction:${id}`;
  }
  private orderRoom(id: string): string {
    return `order:${id}`;
  }
  private sellerOrderRoom(id: string): string {
    return `seller-order:${id}`;
  }
}
