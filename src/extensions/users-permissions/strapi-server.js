const user = await strapi.query('plugin::users-permissions.user').findOne({ where: query, populate: ["role"] });
