const Koa = require('koa');
const serverless = require('serverless-http');

const app = new Koa();

app.use(ctx => {
  ctx.status = 200;
  ctx.body = { hello: 'world' };
});

module.exports = {
  app,
  http: serverless(app.callback()),
};
