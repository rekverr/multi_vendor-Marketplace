import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { CatalogCacheService } from '../cache/catalog-cache.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CatalogCacheService,
  ) {}

  async create(dto: CreateCategoryDto) {
    try {
      const category = await this.prisma.category.create({
        data: { name: dto.name },
      });
      await this.cache.invalidateCategories();
      return category;
    } catch (error) {
      this.handleUniqueName(error);
    }
  }

  async list() {
    const cached = await this.cache.getCategories<unknown[]>();
    if (cached) return cached;

    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    await this.cache.setCategories(categories);
    return categories;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.assertExists(id);

    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: dto,
      });
      await this.cache.invalidateCategories();
      return category;
    } catch (error) {
      this.handleUniqueName(error);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.category.delete({ where: { id } });
      await this.cache.invalidateCategories();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Category cannot be deleted while Products reference it',
        );
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Category not found');
      }

      throw error;
    }
  }

  private async assertExists(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }

  private handleUniqueName(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Category name already exists');
    }

    throw error;
  }
}
