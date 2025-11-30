export default {
  routes: [
    {
      method: 'GET',
      path: '/category',
      handler: 'category.find',
      config: {
        policies: [],
      },
    },
  ],
};
