import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Ommaviy jonli hisob gateway'i (namespace: /live).
 * Mijozlar match:{id} xonasiga qo'shiladi; server score:update yuboradi.
 * Faqat o'qish — hech qanday mutatsiya socket orqali qabul qilinmaydi,
 * shuning uchun autentifikatsiya talab qilinmaydi (legacy semantikasi).
 */
@WebSocketGateway({
  namespace: '/live',
  cors: { origin: true, credentials: false },
})
export class LiveGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('join')
  join(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { matchId?: string; tournamentId?: string },
  ) {
    if (body?.matchId) void socket.join(`match:${body.matchId}`);
    if (body?.tournamentId) void socket.join(`tournament:${body.tournamentId}`);
    return { ok: true };
  }

  @SubscribeMessage('leave')
  leave(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { matchId?: string; tournamentId?: string },
  ) {
    if (body?.matchId) void socket.leave(`match:${body.matchId}`);
    if (body?.tournamentId)
      void socket.leave(`tournament:${body.tournamentId}`);
    return { ok: true };
  }

  /**
   * MatchesService dan chaqiriladi — yangilangan o'yinni tarqatish.
   * Ikkala xona bitta chaqiruvda: socket.io takrorlanuvchi yetkazishni
   * o'zi filtrlaydi (ilgari ikki alohida emit ikki marta yuborardi).
   */
  emitScoreUpdate(matchId: string, tournamentId: string, payload: unknown) {
    this.server
      .to([`match:${matchId}`, `tournament:${tournamentId}`])
      .emit('score:update', payload);
  }
}
