import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  Prisma,
  SellerApplicationStatus,
  UserRole,
} from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { SubmitSellerApplicationDto } from './dto/submit-seller-application.dto.js';

const applicationInclude = {
  user: { select: { id: true, email: true, role: true } },
  reviewedBy: { select: { id: true, email: true } },
} satisfies Prisma.SellerApplicationInclude;

@Injectable()
export class SellerApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(user: AuthenticatedUser, dto: SubmitSellerApplicationDto) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const persistedUser = await transaction.user.findUnique({
          where: { id: user.id },
          select: { role: true, sellerProfile: { select: { id: true } } },
        });

        if (
          !persistedUser ||
          persistedUser.role !== UserRole.CUSTOMER ||
          persistedUser.sellerProfile
        ) {
          throw new ForbiddenException('Only Customers can apply as Sellers');
        }

        return transaction.sellerApplication.create({
          data: {
            userId: user.id,
            displayName: dto.displayName,
          },
          include: applicationInclude,
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A Seller application is already active');
      }

      throw error;
    }
  }

  list(status?: SellerApplicationStatus) {
    return this.prisma.sellerApplication.findMany({
      where: status ? { status } : undefined,
      include: applicationInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  async getById(id: string) {
    const application = await this.prisma.sellerApplication.findUnique({
      where: { id },
      include: applicationInclude,
    });

    if (!application) {
      throw new NotFoundException('Seller application not found');
    }

    return application;
  }

  async approve(id: string, reviewer: AuthenticatedUser) {
    return this.prisma.$transaction(async (transaction) => {
      await this.assertAdmin(transaction, reviewer.id);

      const application = await transaction.sellerApplication.findUnique({
        where: { id },
        select: { userId: true, displayName: true },
      });

      if (!application) {
        throw new NotFoundException('Seller application not found');
      }

      const reviewedAt = new Date();
      const transitioned = await transaction.sellerApplication.updateMany({
        where: { id, status: SellerApplicationStatus.PENDING },
        data: {
          status: SellerApplicationStatus.APPROVED,
          reviewedById: reviewer.id,
          reviewedAt,
          rejectionReason: null,
        },
      });

      if (transitioned.count !== 1) {
        throw new ConflictException('Seller application is not pending');
      }

      const promoted = await transaction.user.updateMany({
        where: { id: application.userId, role: UserRole.CUSTOMER },
        data: { role: UserRole.SELLER },
      });

      if (promoted.count !== 1) {
        throw new ConflictException('Applicant is not eligible for approval');
      }

      await transaction.sellerProfile.create({
        data: {
          userId: application.userId,
          displayName: application.displayName,
        },
      });

      return transaction.sellerApplication.findUniqueOrThrow({
        where: { id },
        include: applicationInclude,
      });
    });
  }

  async reject(id: string, reviewer: AuthenticatedUser, reason: string) {
    return this.prisma.$transaction(async (transaction) => {
      await this.assertAdmin(transaction, reviewer.id);

      const exists = await transaction.sellerApplication.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!exists) {
        throw new NotFoundException('Seller application not found');
      }

      const transitioned = await transaction.sellerApplication.updateMany({
        where: { id, status: SellerApplicationStatus.PENDING },
        data: {
          status: SellerApplicationStatus.REJECTED,
          reviewedById: reviewer.id,
          reviewedAt: new Date(),
          rejectionReason: reason,
        },
      });

      if (transitioned.count !== 1) {
        throw new ConflictException('Seller application is not pending');
      }

      return transaction.sellerApplication.findUniqueOrThrow({
        where: { id },
        include: applicationInclude,
      });
    });
  }

  private async assertAdmin(
    transaction: Prisma.TransactionClient,
    reviewerId: string,
  ): Promise<void> {
    const reviewer = await transaction.user.findUnique({
      where: { id: reviewerId },
      select: { role: true },
    });

    if (reviewer?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Access denied');
    }
  }
}
