import { Context } from 'koa';
import { errors } from '@strapi/utils';
const { UnauthorizedError, ForbiddenError } = errors;


export default async (ctx: Context) => {
    const { user } = ctx.state; // текущий пользователь
    if (!user) {
        throw new UnauthorizedError('You must be authenticated');
    }

    const articleId = ctx.params.id;
    const article = await strapi.db.query('api::article.article').findOne({
        where: { id: articleId },
        populate: { author: true },
    });


    // Если редактор — разрешаем
    if (user.role?.name === 'Editor') {
        return true;
    }

    // Если обычный authenticated — разрешаем только если владелец
    if (article.author?.id === user.id) {
        return true;
    }

    throw new ForbiddenError('You cannot modify this article');
};
