import { factories } from '@strapi/strapi';
import { NotFoundError, UnauthorizedError } from '@strapi/utils/dist/errors';
import slugify from 'slugify';

export interface PaginationQuery {
  pagination?: {
    page?: string | number;
    pageSize?: string | number;
  };
  filters?: Record<string, unknown>;
  sort?: unknown;
  populate?: unknown;
}

export interface Category {
  id?: number,
  name?: string,
  slug?: string,
}

export default factories.createCoreController('api::article.article', ({ strapi }) => ({
  async find(ctx) {
    const raw = ctx.query as Record<string, unknown>;

    const page = Math.max(1, Number((raw.pagination as any)?.page ?? raw.page ?? 1));
    const pageSize = Math.max(1, Number((raw.pagination as any)?.pageSize ?? raw.pageSize ?? 10));
    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    const filters = (raw.filters as Record<string, unknown>) ?? {};

    const sortParam = raw.sort ? (Array.isArray(raw.sort) ? raw.sort.map(String) : [String(raw.sort)]) : undefined;
    const order = sortParam ? sortParam.map(s => {
      const [field, dir] = String(s).split(':');
      return { [field]: dir === 'desc' ? 'desc' : 'asc' };
    }) : undefined;

    const populate = {
      author: true,
      category: true,
      coverImage: true,
    };

    const articles = await strapi.db.query('api::article.article').findMany({
      where: filters,
      orderBy: order,
      populate,
      limit,
      offset,
    });

    const total = await strapi.db.query('api::article.article').count({ where: filters });

    const safeArticles = (articles || []).map((a: any) => {
      const author = a?.author
        ? {
          id: a.author.id,
          username: a.author.username,
          email: a.author.email,
        }
        : null;

      return {
        ...a,
        author,
      };
    });

    const pageCount = Math.ceil(total / limit);

    return {
      data: safeArticles,
      meta: {
        pagination: {
          page,
          pageSize: limit,
          total,
          pageCount,
        },
      },
    };
  },

  async create(ctx) {
    const { user } = ctx.state;
    if (!user) {
      throw new UnauthorizedError('You must be authenticated');
    }

    const { data } = ctx.request.body;
    data.author = user.id;

    if (data.content) {
      const words = data.content.trim().split(/\s+/).length;
      const wordsPerMinute = 200;
      data.readingTime = Math.ceil(words / wordsPerMinute);
    }

    data.views = 0;
    data.isEdited = false;

    if (!data.slug) {
      data.slug = slugify(data.title, { lower: true, strict: true });
    }

    const article = await strapi.entityService.create('api::article.article', { data });

    strapi.log.info(`Article ${article.id} - ${article.title} created by ${user.id}`);

    return { data: article };
  },

  async findOne(ctx) {
    const { id } = ctx.params;

    const article = await strapi.entityService.findOne('api::article.article', id, {
      populate: {
        author: {
          fields: ['id', 'username', 'email'],
        },
        category: true,
        coverImage: true,
      },
    });

    if (!article) {
      throw new NotFoundError('Article not found');
    }

    await strapi.entityService.update('api::article.article', id, {
      data: {
        views: Number(article.views) + 1,
      },
    });

    return { data: article };
  },

  async update(ctx) {
    const { user } = ctx.state;
    if (!user) {
      throw new UnauthorizedError('You must be authenticated to update an article');
    }

    const { id } = ctx.params;
    const { data } = ctx.request.body;

    const existing = await strapi.entityService.findOne('api::article.article', id, {
      populate: { author: { fields: ['id'] } },
    });

    if (!existing) {
      throw new NotFoundError('Article not found');
    }

    if (typeof data.title === 'string' && data.title !== existing.title) {
      if (!data.slug) {
        data.slug = slugify(data.title, { lower: true, strict: true });
      }
    }

    if (typeof data.content === 'string' && data.content !== existing.content) {
      const words = data.content.trim().split(/\s+/).filter(Boolean).length;
      const wordsPerMinute = 200;
      data.readingTime = Math.max(1, Math.ceil(words / wordsPerMinute));
    }

    data.isEdited = true;

    const updated = await strapi.entityService.update('api::article.article', id, {
      data,
      //populate для возвращения клиенту изменёнй новости
      populate: {
        author: { fields: ['id', 'username', 'email'] },
        category: true,
        coverImage: true,
      },
    });
    strapi.log.info(`Article ${id} edited by ${user}`);

    return { data: updated };
  },

  async delete(ctx) {
    const { id } = ctx.params;
    const deleted = await strapi.entityService.delete('api::article.article', id);
    if (!deleted) {
      strapi.log.info(`can not delete article ${id}. Article not found`);
      return ctx.notFound(`Article ${id} not found`);
    }
    strapi.log.info(`Article ${id} deleted`);
    return await { data: deleted };
  }
}));
