import type { PrismaClient } from '@quizmb/database';
import { publicUser } from '../auth/service.js';
export class UsersService {
  constructor(private db: PrismaClient) {}
  async updateName(id: string, name: string) {
    const user = await this.db.user.update({
      where: { id },
      data: { name },
      select: { id: true, name: true, email: true },
    });
    return { ...publicUser(user), avatarUrl: null };
  }
}
