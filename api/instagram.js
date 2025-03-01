import fastify from 'fastify';

import { fetchPostJson } from './src/index.js'

const app = fastify();

const PORT = process.env.PORT || 3002

app.get('/', async (request, reply) => {
    reply.send('/download/?url=Link-do-video-instagram');
});

app.get('/download/', async (request, reply) => {
    const { url } = request.query;

    console.log("--> GET /download", url, new Date().toLocaleString())

    if (!url) reply.send({
        error: 'Forneça uma URL de vídeo do Instagram!',
    })
    let resultado = await fetchPostJson(url)
    reply.send({ ...resultado });
});

const start = async () => {
    try {
        app.listen({ host: '0.0.0.0', port: PORT });
        console.log('🟧 | API do Instagram rodando em http://localhost:3002');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();