const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const Koa = require('koa');
const KoaBodyparser = require('koa-bodyparser');
const KoaMorgan = require('koa-morgan');
const path = require('path');
const { v4: uuid } = require('uuid');

const apiId = crypto.randomBytes(4).toString('hex');

function getHandler({ entry, handler }) {
  const { cwd } = process;
  const filePath = path.join(cwd(), entry);

  const module = require(filePath); // eslint-disable-line global-require
  assert(module, 'Failed to find module');

  const { [handler]: func } = module;
  assert(typeof func === 'function', `Expected module to export a function ${handler}`);
  return func;
}

function createLambdaEvent(request) {
  const { method, hostname, headers, ip, path: rawPath, query, querystring, body } = request;

  return {
    version: '2.0',
    routeKey: '$default',
    rawPath,
    rawQueryString: querystring,
    headers: { ...headers },
    queryStringParameters: { ...query },
    requestContext: {
      accountId: '123456789012',
      apiId,
      domainName: hostname,
      http: {
        method,
        path: rawPath,
        protocol: 'HTTP/1.1',
        sourceIp: ip,
        userAgent: request.get('User-Agent')
      },
      requestId: uuid(),
      routeKey: '$default',
      stage: '$default',
      timeEpoch: Date.now()
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  };
}
function createLambdaContext() {
  const streamId = crypto.randomBytes(16).toString('hex');

  return {
    callbackWaitsForEmptyEventLoop: false,
    functionVersion: '$LOCAL',
    functionName: 'local-function-name',
    memoryLimitInMB: '1024',
    logGroupName: '/aws/lambda/local-function-name',
    logStreamName: `[$LOCAL]${streamId}`,
    invokedFunctionArn: 'arn:aws:lambda:LOCAL:123456789012:function:local-function-name',
    awsRequestId: uuid(),
  };
}

function createApp(handler) {
  assert(typeof handler === 'function', 'Expected handler to be a function');

  const app = new Koa();

  app.use(KoaMorgan('dev'));
  app.use(KoaBodyparser());

  app.use(async ctx => {
    try {
      const event = createLambdaEvent(ctx.request);
      const context = createLambdaContext();

      const { statusCode, headers, isBase64Encoded, body } = await handler(event, context);

      ctx.status = statusCode || 404;
      ctx.set(headers);
      ctx.body = isBase64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body;
    } catch (err) {
      console.error(err);
      ctx.status = err.statusCode || err.status || 500;
      ctx.body = err.stack;
    }
  });

  return app.callback();
}

function createServer(app, { entry, handler, httpPort }) {
  const server = http.createServer(app);

  server.on('listening', () => {
    const { address, port } = server.address();
    const basename = path.basename(entry, path.extname(entry));
    console.log(`serverless-http-dev ${basename}.${handler} listening on http://${address}:${port}`);
  });

  server.on('error', err => {
    if (err.syscall === 'listen' && err.code === 'EACCES') {
      console.error(`Port ${httpPort} requires elevated privileges`);
    } else if (err.syscall === 'listen' && err.code === 'EADDRINUSE') {
      console.error(`Port ${httpPort} is already in use`);
    } else {
      throw err;
    }
  });

  return server;
}

module.exports = function serverlessHttpDev(args) {
  assert(args && args.entry && args.handler, 'Expected entry & handler to be a string');

  const handler = getHandler(args);
  const app = createApp(handler);
  const server = createServer(app, args);

  const { httpHost, httpPort } = args;
  server.listen(httpPort, httpHost);

  return () => server.close();
};
