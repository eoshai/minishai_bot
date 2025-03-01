const express = require('express');
const cors = require('cors');
const path = require('path');
const youtubeDl = require('youtube-dl-exec');
const { spawn } = require('child_process');

const app = express();
const port = 5432;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const router = express.Router();

app.use('/', router);

function isValidYoutubeUrl(url) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    return youtubeRegex.test(url);
}

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Rota não encontrada'
    });
});

// Nova rota para pesquisar vídeos no YouTube
router.get('/api/search-video', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Por favor, forneça um termo de busca.'
            });
        }

        console.log('🔎 Buscando no YouTube:', query);

        const response = await youtubeDl(`ytsearch1:${query}`, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true
        });

        const video = response?.entries?.[0];
        if (!video) {
            return res.status(404).json({
                success: false,
                message: 'Nenhum resultado encontrado.'
            });
        }

        res.json({
            success: true,
            data: {
                url: video.webpage_url,
                title: video.title,
                uploader: video.uploader,
                duration: `${Math.floor(video.duration / 60)}m ${video.duration % 60}s`,
                view_count: video.view_count,
                like_count: video.like_count,
                categories: video.categories ? video.categories.join(', ') : 'N/A',
                thumbnail: video.thumbnail
            }
        });

    } catch (error) {
        console.error('Erro ao buscar vídeo no YouTube:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar vídeo no YouTube.',
            details: error.message
        });
    }
});


router.post('/api/video-info', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url || !isValidYoutubeUrl(url)) {
            return res.status(400).json({ 
                success: false, 
                message: 'URL inválida' 
            });
        }

        const videoInfo = await youtubeDl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: true
        });

        const videoData = {
            title: videoInfo.title || 'N/A',
            description: videoInfo.description || 'N/A',
            uploader: videoInfo.uploader || 'N/A',
            duration: videoInfo.duration ? `${Math.floor(videoInfo.duration / 60)}m ${videoInfo.duration % 60}s` : 'N/A',
            view_count: videoInfo.view_count || 'N/A',
            like_count: videoInfo.like_count || 'N/A',
            webpage_url: videoInfo.webpage_url || 'N/A',
            categories: videoInfo.categories ? videoInfo.categories.join(', ') : 'N/A',
            thumbnail: videoInfo.thumbnail || 'N/A'
        };

        res.json({
            success: true,
            data: videoData
        });

    } catch (error) {
        console.error('Erro ao obter informações do vídeo:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao processar informações do vídeo',
            details: error.message
        });
    }
});

router.get('/api/download-audio', async (req, res) => {
    try {
        const { url, quality } = req.query;

        if (!url || !isValidYoutubeUrl(url)) {
            return res.status(400).json({ 
                success: false, 
                message: 'URL inválida' 
            });
        }

        // Obtendo informações do vídeo
        const videoInfo = await youtubeDl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: true
        });

        // Configurando o processo de download só do áudio
        const downloadProcess = youtubeDl.exec(url, {
            format: 'bestaudio[ext=mp3]/bestaudio',
            output: '-'
        });

        // Configurando headers para download de áudio
        res.header('Content-Disposition', `attachment; filename="${videoInfo.title.replace(/[^a-zA-Z0-9]/g, "_")}.mp3"`);
        res.header('Content-Type', 'audio/mpeg');

        // Stream do áudio diretamente para o cliente
        downloadProcess.stdout.pipe(res);

        downloadProcess.stderr.on('data', (data) => {
            console.error('Data:', data.toString());
        });

        downloadProcess.on('error', (error) => {
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'Erro ao baixar o áudio'
                });
            }
        });

    } catch (error) {
        console.error('Erro ao processar o download:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false, 
                message: 'Erro ao processar o download',
                details: error.message
            });
        }
    }
});

module.exports = router;

app.listen(port, () => {
    console.log(`🟥 | API do Youtube rodando em http://localhost:${port}`);
});