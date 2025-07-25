import Fastify from 'fastify';

const fastify = Fastify({
  logger: true
});

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    const host = process.env.HOST || 'localhost';

    await fastify.listen({ port, host });
    console.log(`Server listening on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();