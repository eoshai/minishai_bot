const { default: makeWASocket, useMultiFileAuthState, downloadMediaMessage, prepareWAMessageMedia } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const { writeFile, unlink } = require('fs/promises');
const { Sticker } = require('wa-sticker-formatter');
const ytdl = require('ytdl-core');
const axios = require('axios');
const fs = require('fs'); // Para manipular arquivos
const path = require('path');
const api = require('./api/youtube');
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./api/youtube');
const apiTiktok = require('./api/tiktok');
const apiInstagram = require('./api/instagram');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI('AIzaSyBTbb6O8k1MCmYwFL0dkp5qelB__t83UPI');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

const Jimp = require('jimp');

const blacklistPath = path.join(__dirname, '../src/json/blacklist.json');
const blacklist = JSON.parse(fs.readFileSync(blacklistPath, 'utf8'));

const addToBlacklist = (numero, motivo) => {
    if (blacklist[numero]) {
      return '*❌ | Esse número já está na blacklist.*';
    }
  
    blacklist[numero] = { motivo: motivo };
    fs.writeFileSync('./blacklist.json', JSON.stringify(blacklist, null, 2));
    return `*✅ | O número ${numero} foi adicionado à blacklist com o motivo: ${motivo}*`;
};

const checkBlacklist = (numero) => {
    if (blacklist[numero]) {
      return `*❌ | Você está na blacklist. Motivo: ${blacklist[numero].motivo}*`;
    }
    return null; // Não está na blacklist
};

// Função para verificar se o usuário é admin
const isUserAdmin = (sender, groupMetadata) => {
    return groupMetadata.participants.some(
      (participant) => participant.id === sender && participant.isAdmin
    );
};
  
// Função para verificar se o bot é admin
const isBotAdmin = (groupMetadata) => {
    return groupMetadata.participants.some(
      (participant) => participant.id === socket.info.wid && participant.isAdmin
    );
};

// Caminho da imagem local
const imgLogoPath = path.join(__dirname, 'src', 'images', 'MiniShai.jpg');
const imgIP = path.join(__dirname, 'src', 'images', 'ip-api.jpg');

// Função para redimensionar a imagem
const reSize = async (buffer, ukur1, ukur2) => {
  return new Promise(async (resolve, reject) => {
    var baper = await Jimp.read(buffer);
    var ab = await baper
      .resize(ukur1, ukur2)
      .getBufferAsync(Jimp.MIME_JPEG);
    resolve(ab);
  });
};

const loadLogo = async () => {
    try {
      const buffer = fs.readFileSync(imgLogoPath);  // Lê o arquivo de imagem
      const logo = await reSize(buffer, 280, 200);  // Redimensiona a imagem
      return logo;  // Retorna a imagem redimensionada
    } catch (error) {
      console.error('Erro ao carregar ou redimensionar a logo:', error);
      throw error;
    }
};

let antiLinkEnabled = false;
const cooldowns = new Map();

const app = express();
const port = 3000;

// Inicia a API
app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);

app.listen(port, () => {
    console.log(`Server rodando em: http://localhost:${port}`);
});

async function miniShai1() {
    const { state, saveCreds } = await useMultiFileAuthState('imsession');

    const socket = makeWASocket({
        printQRInTerminal: true,
        auth: state,
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', ({ connection }) => {
        if (connection === 'close') miniShai1();
    });

    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        console.log('✅ | Mensagem recebida:', JSON.stringify(message, null, 2));
    
        await handleAntiLink(socket, message);
    
        try {
            const textMessage = message.message?.conversation || message.message?.extendedTextMessage?.text;
            if (!textMessage) return console.log('❌ | Mensagem sem texto.');
            
            const sender = message.key.remoteJid;
            const blacklistMsg = checkBlacklist(sender);

            if (blacklistMsg) {
                // Responde o usuário com a mensagem de blacklist
                return socket.sendMessage(message.key.remoteJid, { text: blacklistMsg });
            }

            const command = textMessage.trim().toLowerCase();

            const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            if (textMessage.startsWith('#')) {
                if (await verificarCooldown(socket, message)) return;
            }

            if (/^#\s*(suicídio|suicidio)/i.test(textMessage)) {
                try {
                    const chat = await socket.groupMetadata(message.key.remoteJid);
                    const participants = chat.participants;
                    const botNumber = socket.user.id.split(':')[0] + '@s.whatsapp.net';
            
                    // Verificar se é um grupo
                    if (!message.key.remoteJid.endsWith('@g.us')) {
                        return socket.sendMessage(message.key.remoteJid, { text: '*❌ | Este comando só pode ser usado em grupos!*',
                            contextInfo: {
                              isForwarded: true,
                              forwardingScore: 9999,
                            } 
                        });
                    }
            
                    // Verificar se o bot é admin no grupo
                    const botAdmin = participants.find(p => p.id === botNumber && p.admin);
                    if (!botAdmin) {
                        return socket.sendMessage(message.key.remoteJid, { text: '*❌ | Eu preciso ser administrador para processar esse comando!*',
                            contextInfo: {
                              isForwarded: true,
                              forwardingScore: 9999,
                            } 
                        });
                    }
            
                    // Verificar se o usuário é dono do grupo (não pode usar o comando)
                    const groupOwner = chat.owner;
                    if (message.key.participant === groupOwner) {
                        return socket.sendMessage(message.key.remoteJid, { text: '*❌ | Donos de grupos não podem usar esse comando!*',
                            contextInfo: {
                              isForwarded: true,
                              forwardingScore: 9999,
                            } 
                        });
                    }
            
                    // Resposta ao comando com a mensagem original do usuário
                    const userName = message.key.participant.split('@')[0];
                    await socket.sendMessage(message.key.remoteJid, {
                        text: `Não @${userName}, não se mate 😭💔`,
                        mentions: [message.key.participant]
                    });
            
                    // Expulsar o usuário do grupo
                    await socket.groupParticipantsUpdate(message.key.remoteJid, [message.key.participant], 'remove');
            
                    // Resposta após a expulsão
                    await socket.sendMessage(message.key.remoteJid, {
                        text: `Ah, menos um pra eu me preocupar 😪`,
                    });
                    
                } catch (err) {
                    console.error('❌ | Erro ao processar comando suicídio:', err);
                }
            }            
            
    
            if (textMessage.startsWith('#ytmp3 ')) {
                console.log('✅ Comando #ytmp3 detectado.');
              
                await socket.sendMessage(sender, {
                    react: { text: "🎧", key: message.key }
                });
              
                await socket.sendPresenceUpdate("composing", sender);
                await new Promise(resolve => setTimeout(resolve, 1000));
              
                const query = textMessage.substring(7).trim();
                console.log('✅ Query extraída:', query);
              
                if (!query) {
                    await socket.sendMessage(sender, { text: '❌ Por favor, forneça um link do YouTube ou o nome da música/vídeo!',
                        extendedTextMessage: {
                        text: `𝕾𝖆𝖙𝖔𝖗𝖚 𝕸𝖚𝖑𝖙𝖎 𝕯𝖊𝖛𝖎𝖈𝖊`,
                        title: `TM`,
                        jpegThumbnail: path.join(__dirname, 'MiniShai.jpg'),
                      }, 
                    });
                    return;
                }
              
                try {
                    let videoUrl = '';
                    let videoTitle = '';
              
                    if (query.startsWith('http')) {
                        videoUrl = query;
                        console.log('✅ Link detectado:', videoUrl);
                    } else {
                        await socket.sendMessage(sender, {
                            text: '*🔎 | Realizando busca no YouTube...*',
                            contextInfo: {
                              isForwarded: true,
                              forwardingScore: 9999,
                            }
                          });                          
              
                        const searchResponse = await axios.get(`http://localhost:5432/api/search-video?query=${encodeURIComponent(query)}`);
                        const searchData = searchResponse.data;
              
                        if (!searchData.success || !searchData.data || !searchData.data.url) {
                            await socket.sendMessage(sender, { text: '*❌ Nenhum resultado encontrado para a busca!*',
                                contextInfo: { 
                                    isForwarded: true, 
                                    forwardingScore: 9999
                                } });
                            return;
                        }
              
                        videoUrl = searchData.data.url;
                        videoTitle = searchData.data.title;
                        await socket.sendMessage(sender, { 
                            text: `*✅ | Vídeo/música encontrado(a):*\n> ${videoTitle}`,
                            contextInfo: { 
                                isForwarded: true, 
                                forwardingScore: 9999
                            }
                        });
                    }
              
                    await socket.sendMessage(sender, { text: '*🔎 | Obtendo informações do vídeo...*',
                        contextInfo: { 
                            isForwarded: true, 
                            forwardingScore: 9999
                        } });
              
                    const response = await axios.post('http://localhost:5432/api/video-info', { url: videoUrl });
                    const data = response.data.data;
              
                    if (!data) {
                        await socket.sendMessage(sender, { text: "❌ Não foi possível obter as informações do vídeo." });
                        return;
                    }
              
                    console.log('✅ Informações do vídeo recebidas:', data);
              
                    const thumbnailResponse = await axios.get(data.thumbnail, { responseType: 'arraybuffer' });
                    const thumbnailBuffer = Buffer.from(thumbnailResponse.data);
              
                    const formatNumber = (num) => {
                        if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
                        if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
                        return num.toString();
                    };
              
                    const formattedViews = formatNumber(data.view_count);
                    const formattedLikes = formatNumber(data.like_count);
              
const message = `> 🌟 *MP3 Youtube 🎶* 🌟
───────────────────
> 📺 *Canal:* ${data.uploader}
> 🎵 *Título:* ${data.title}
> 📝 *Descrição:* ${data.description.slice(0, 100)}...
> 🎼 *Categorias:* ${data.categories}
> ⏳ *Duração:* ${data.duration}
> 👀 *Visualizações:* ${formattedViews}
> 👍 *Likes:* ${formattedLikes}
> 🔗 *Link:* ${data.webpage_url}
───────────────────
> 🎧 *MP3:*
> *🎙️ Aguarde um pouco, estou baixando sua música...*`;
              
await socket.sendMessage(sender, { 
    image: thumbnailBuffer, 
    caption: message,
    contextInfo: { 
        isForwarded: true, 
        forwardingScore: 9999
    }
});

              
                    await socket.sendPresenceUpdate("recording", sender);
              
                    const audioUrl = `http://localhost:5432/api/download-audio?url=${encodeURIComponent(videoUrl)}`;
                    const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });
                    const audioBuffer = Buffer.from(audioResponse.data);
              
                    await socket.sendMessage(sender, {
                        audio: audioBuffer,
                        mimetype: 'audio/mpeg',
                        ptt: false
                    });
              
                    await socket.sendPresenceUpdate("available", sender);
              
                } catch (error) {
                    console.error('❌ Erro ao processar o comando #ytmp3:', error);
                    await socket.sendMessage(sender, { text: "❌ Ocorreu um erro ao processar o vídeo.",
                        contextInfo: { 
                            isForwarded: true, 
                            forwardingScore: 9999
                        }
                    });
                }                             

            } else if (textMessage.startsWith('#gemini ')) {
                const vipsPath = path.join(__dirname, '../src/json/vips.json');
                const vips = JSON.parse(fs.readFileSync(vipsPath));
                const userNumber = message.key.remoteJid.split('@')[0];

                if (!vips.includes(userNumber)) {
                    await socket.sendMessage(message.key.remoteJid, { text: '*❌ Apenas usuários VIPs podem usar este comando.*' });
                    return;
                }

                const query = textMessage.slice(8).trim(); // Remove '#gemini ' e pega o resto
                if (!query) {
                  await socket.sendMessage(message.key.remoteJid, { text: '*⚠️ Por favor, forneça uma **query** após o comando.*' });
                  return;
                }

                const result = await model.generateContent(query);

                const response = result.response.text();

                await socket.sendMessage(message.key.remoteJid, { text: `> ${response}` });
                
            } else if (textMessage.startsWith('#tikmp4 ')) {
                console.log('✅ Comando #tiktokmp4 detectado.');
            
                await socket.sendMessage(sender, {
                    react: { text: "🎬", key: message.key }
                });
            
                await socket.sendPresenceUpdate("composing", sender);
                await new Promise(resolve => setTimeout(resolve, 1000));
            
                const query = textMessage.substring(8).trim();  // Obtém o link
                console.log('✅ Link extraído:', query);
            
                if (!query || !query.startsWith('http')) {
                    await socket.sendMessage(sender, { text: '*❌ Por favor, forneça um link válido do TikTok!*' });
                    return;
                }
            
                try {
                    // Verifica se o link contém "photo" (não é permitido foto)
                    if (query.includes('photo')) {
                        await socket.sendMessage(sender, { text: '*❌ Só é possível baixar vídeos do TikTok. Este link é de uma foto.*' });
                        return;
                    }
            
                    // Faz a requisição para a API
                    const response = await fetch(`http://localhost:3001/tiktok/api.php?url=${encodeURIComponent(query)}`);
            
                    if (!response.ok) {
                        console.error('❌ Erro ao acessar a API:', response.status, response.statusText);
                        await socket.sendMessage(sender, { text: `*❌ Não foi possível acessar a API (Status: ${response.status})*` });
                        return;
                    }
            
                    const textResponse = await response.text();  // Obtém a resposta como texto
                    console.log('✅ Resposta da API:', textResponse);  // Imprime a resposta para depuração
            
                    const data = JSON.parse(textResponse);  // Agora tenta converter para JSON
            
                    if (!data || !data.video || data.video.length === 0) {
                        await socket.sendMessage(sender, { text: '*❌ Não foi possível encontrar o vídeo do TikTok no link fornecido.*' });
                        return;
                    }
            
                    const videoUrl = data.video[0];  // URL do vídeo MP4
                    console.log('✅ URL do vídeo:', videoUrl);
            
                    // Faz o download do vídeo
                    const videoResponse = await fetch(videoUrl);
            
                    // Converte a resposta para um Buffer
                    const arrayBuffer = await videoResponse.arrayBuffer();
                    const videoBuffer = Buffer.from(arrayBuffer);
            
                    // Envia o vídeo para o usuário
                    await socket.sendMessage(sender, {
                        video: videoBuffer,
                        mimetype: 'video/mp4',
                        caption: '*✅ | Aqui está o seu vídeo!*'
                    });
            
                } catch (error) {
                    console.error('❌ Erro ao processar o comando #tiktokmp4:', error);
                    await socket.sendMessage(sender, { text: '*❌ Ocorreu um erro ao tentar baixar o vídeo.*' });
                }
                
            } else if (textMessage.startsWith('#instamp4 ')) {
                console.log('✅ Comando #instamp4 detectado.');
            
                await socket.sendMessage(sender, {
                    react: { text: "🎥", key: message.key }
                });
            
                await socket.sendPresenceUpdate("composing", sender);
                await new Promise(resolve => setTimeout(resolve, 1000));
            
                const query = textMessage.substring(10).trim();  // Obtém o link
                console.log('✅ Link extraído:', query);
            
                if (!query || !query.startsWith('http')) {
                    await socket.sendMessage(sender, { text: '❌ Por favor, forneça um link válido do Instagram!' });
                    return;
                }
            
                try {
                    // Faz a requisição para a API
                    const response = await fetch(`http://127.0.0.1:3002/download/?url=${encodeURIComponent(query)}`);
            
                    if (!response.ok) {
                        console.error('❌ Erro ao acessar a API:', response.status, response.statusText);
                        await socket.sendMessage(sender, { text: `❌ Não foi possível acessar a API (Status: ${response.status})` });
                        return;
                    }
            
                    const data = await response.json();  // Agora tenta converter para JSON
            
                    // Se a resposta da API for erro (não for um vídeo)
                    if (data.statusCode === 500 && data.error === "Internal Server Error" && data.message === "This post is not a video") {
                        await socket.sendMessage(sender, { text: '❌ O link fornecido não é um vídeo do Instagram.' });
                        return;
                    }
            
                    // Se a resposta for um vídeo (Reels ou post com vídeo)
                    if (data.filename && data.videoUrl) {
                        const videoUrl = data.videoUrl;  // URL do vídeo
                        console.log('✅ URL do vídeo:', videoUrl);
            
                        // Faz o download do vídeo
                        const videoResponse = await fetch(videoUrl);
            
                        // Verificar se a resposta foi bem-sucedida
                        if (!videoResponse.ok) {
                            console.error('❌ Erro ao acessar o vídeo:', videoResponse.status, videoResponse.statusText);
                            await socket.sendMessage(sender, { text: '❌ Não foi possível acessar o vídeo.' });
                            return;
                        }
            
                        // Converte a resposta para um Buffer
                        const arrayBuffer = await videoResponse.arrayBuffer();
                        const videoBuffer = Buffer.from(arrayBuffer);
                        console.log('✅ Buffer de vídeo criado, tamanho:', videoBuffer.length);  // Log para verificar o buffer
            
                        // Agora vamos enviar a mensagem com o vídeo
                        await socket.sendMessage(sender, {
                            video: videoBuffer,
                            mimetype: 'video/mp4',
                            caption: '*✅ | Aqui está o seu vídeo!*',
                            ptt: false  // Isso é importante para garantir que seja tratado como um vídeo
                        });
            
                        console.log('✅ Vídeo enviado com sucesso!');
                    } else {
                        await socket.sendMessage(sender, { text: '❌ Não foi possível encontrar um vídeo no link fornecido.' });
                    }
            
                } catch (error) {
                    console.error('❌ Erro ao processar o comando #instamp4:', error);
                    await socket.sendMessage(sender, { text: '❌ Ocorreu um erro ao tentar baixar o vídeo.' });
                }           
                
            } else if (textMessage.startsWith('#tiktokmp3 ')) {
                console.log('✅ Comando #tiktokmp3 detectado.');
            
                await socket.sendMessage(sender, {
                    react: { text: "🎶", key: message.key }
                });
            
                await socket.sendPresenceUpdate("composing", sender);
                await new Promise(resolve => setTimeout(resolve, 1000));
            
                const query = textMessage.substring(11).trim();  // Obtém o link
                console.log('✅ Link extraído:', query);
            
                if (!query || !query.startsWith('http')) {
                    await socket.sendMessage(sender, { text: '❌ Por favor, forneça um link válido do TikTok!' });
                    return;
                }
            
                try {
                    // Verifica se o link contém "photo" (não é permitido foto)
                    if (query.includes('photo')) {
                        await socket.sendMessage(sender, { text: '❌ Só é possível baixar vídeos do TikTok. Este link é de uma foto.' });
                        return;
                    }
            
                    // Faz a requisição para a API
                    const response = await fetch(`http://localhost:3001/tiktok/api.php?url=${encodeURIComponent(query)}`);
            
                    if (!response.ok) {
                        console.error('❌ Erro ao acessar a API:', response.status, response.statusText);
                        await socket.sendMessage(sender, { text: `❌ Não foi possível acessar a API (Status: ${response.status})` });
                        return;
                    }
            
                    const textResponse = await response.text();  // Obtém a resposta como texto
                    console.log('✅ Resposta da API:', textResponse);  // Imprime a resposta para depuração
            
                    const data = JSON.parse(textResponse);  // Agora tenta converter para JSON
            
                    if (!data || !data.audio || data.audio.length === 0) {
                        await socket.sendMessage(sender, { text: '❌ Não foi possível encontrar o áudio do TikTok no link fornecido.' });
                        return;
                    }
            
                    const audioUrl = data.audio[0];  // URL do áudio MP3
                    console.log('✅ URL do áudio:', audioUrl);
            
                    // Faz o download do áudio
                    const audioResponse = await fetch(audioUrl);
            
                    // Verificar se a resposta foi bem-sucedida
                    if (!audioResponse.ok) {
                        console.error('❌ Erro ao acessar o áudio:', audioResponse.status, audioResponse.statusText);
                        await socket.sendMessage(sender, { text: '❌ Não foi possível acessar o áudio.' });
                        return;
                    }
            
                    // Converte a resposta para um Buffer
                    const arrayBuffer = await audioResponse.arrayBuffer();
                    const audioBuffer = Buffer.from(arrayBuffer);
                    console.log('✅ Buffer de áudio criado, tamanho:', audioBuffer.length);  // Log para verificar o buffer
            
                    // Agora vamos enviar a mensagem de forma explícita
                    await socket.sendMessage(sender, {
                        audio: audioBuffer,
                        mimetype: 'audio/mp3',
                        caption: 'Aqui está o áudio do TikTok!',
                        ptt: false  // Isso é importante, pois estamos enviando um arquivo de áudio, não um áudio de voz
                    });
            
                    console.log('✅ Áudio enviado com sucesso!');
            
                } catch (error) {
                    console.error('❌ Erro ao processar o comando #tiktokmp3:', error);
                    await socket.sendMessage(sender, { text: '❌ Ocorreu um erro ao tentar baixar o áudio.' });
                }                          
                
            } else if (command === '#x9' && quotedMessage) {
                const viewOnceMessage = quotedMessage?.viewOnceMessageV2?.message || quotedMessage?.viewOnceMessage?.message;
                if (viewOnceMessage) {
                    if (viewOnceMessage.videoMessage) {
                        const videoMessage = viewOnceMessage.videoMessage;
                        await socket.sendMessage(sender, {
                            video: { url: videoMessage.url },
                            caption: (videoMessage.caption || '') + '\n\nRevelando Visualização única..'
                        });
                    } else if (viewOnceMessage.imageMessage) {
                        const imageMessage = viewOnceMessage.imageMessage;
                        await socket.sendMessage(sender, {
                            image: { url: imageMessage.url },
                            caption: (imageMessage.caption || '') + '\n\nRevelando Visualização única..'
                        });
                    } else {
                        await socket.sendMessage(sender, { text: '❌ Não foi possível revelar a mensagem.' });
                    }
                } else {
                    await socket.sendMessage(sender, { text: '❌ A mensagem respondida não é de visualização única.' });
                }

            } else if (command === '#menu') {
                const hearts = ["❤️", "🧡", "💛", "💚", "💙", "💜", "🤎", "🖤", "🤍", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"];
                const randomHeart = hearts[Math.floor(Math.random() * hearts.length)];

                await socket.sendMessage(sender, {
                    react: {
                        text: randomHeart, // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo

                const userNick = message.pushName || '🔒 Não identificado 🔒';
                const now = new Date();
                const date = now.toLocaleDateString('pt-BR');
                const time = now.toLocaleTimeString('pt-BR');
                const menuMessage = `⟅ 𝑾𝑬𝑳𝑪𝑶𝑴𝑬\n\n『𝑰𝑵𝑭𝑶』\n\n> ╭──────────\n> │ 🏷️ 𝑵𝒊𝒄𝒌: ${userNick}\n> │ 📅 𝑫𝒂𝒕𝒂: ${date}\n> │ ⏰ 𝑯𝒐𝒓𝒂: ${time}\n> ╰──────────\n\n『𝑴𝑬𝑵𝑼』\n\n> 🖼️ #s - Criar sticker\n> 🎧 #ytmp3 [link] - Baixar áudio do YouTube\n> 🎧 #instamp3 [link] - Baixar áudio de vídeo do Instagram | *EM BREVE*\n> 🎧 #tiktokmp3 [link] - Baixar áudio de vídeo do Tiktok | *EM BREVE*\n> 🎥 #ytmp4 [link] - Baixar vídeo do YouTube | *EM BREVE*\n> 🎥 #tikmp4 [link] - Baixar vídeo do Tiktok\n> 🎥 #instamp4 [link] - Baixar vídeo do Instagram\n> ✏️ #changeDesc [texto] - Alterar descrição do grupo\n> ☠️ #gulag - Sorteia 2 membros aleatórios (em um grupo) para o GULAG\n> 🦵 #ban @user - Banir membro\n> 🔒 #lock - Bloquear grupo\n> 🔓 #unlock - Desbloquear grupo\n> 📮 #inviteLink - Obter link do grupo\n> 📸 #hd - Melhorar imagem\n> 👀 #hidetag [mensagem] - Mensagem oculta\n> 🌐 #antilink - Ativar/desativar antilink\n> 🎭 #antifake - Bloquear números internacionais\n> 📈 #promote @user - Tornar membro administrador\n> 📉 #demote @user - Remover administrador\n> 🏠 #cep [CEP] - Consultar endereço\n> 👤 #perfil - Consulta o seu perfil`;
                try {
                    const logo = await loadLogo();
                    await socket.sendMessage(sender, {
                        text: menuMessage,
                        contextInfo: {
                          forwardingScore: 508,
                          isForwarded: true,
                          externalAdReply: {
                            title: `『 𝐌𝐈𝐍𝐈𝐒𝐇𝐀𝐈 𝐁𝐎𝐓 🤖 `,
                            body: `🛠️ by gabriel shai 🛠️`,
                            previewType: "PHOTO",
                            thumbnailUrl: ``,
                            thumbnail: logo,
                            sourceUrl: "",
                          },
                        },
                      });

                  } catch (error) {
                      console.error('Erro ao enviar a logo:', error);
                  }

            
            
            } else if (textMessage === ('#ytmp4')) {
                await socket.sendMessage(sender, {
                    react: {
                        text: "🎥", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000));

                const url = textMessage.split(' ')[1];
                const result = await ytDownload(url, 'video');
                await socket.sendMessage(message.key.remoteJid, { text: `🎬 ${result.title}\n🔗 ${result.link}` });

            } else if (textMessage.startsWith('#cnpj ')) {
                await socket.sendMessage(sender, {
                    react: {
                        text: "💼", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000));

                const cnpj = textMessage.replace('#cnpj ', '').trim().replace(/\D/g, '');

                if (cnpj.length !== 14) {
                    await socket.sendMessage(message.key.remoteJid, { text: '*❌ CNPJ inválido! Certifique-se de digitar corretamente.*' });
                    return;
                }

                try {
                    const response = await axios.get(`https://receitaws.com.br/v1/cnpj/${cnpj}`);
                    const data = response.data;
              
                    if (data.status === 'ERROR') {
                      await socket.sendMessage(message.key.remoteJid, { text: '*❌ CNPJ inválido ou não encontrado!*' });
                      return;
                    }
              
                    const atividadesSecundarias = data.atividades_secundarias.map((atv) => `> ${atv.text}`).join('\n');
                    const socios = data.qsa.map((socio) => `> ${socio.nome} (${socio.qual})`).join('\n');
              
                    const audioPath = path.join(__dirname, 'src', 'audios', 'cnpjAUDIO.ogg');

                    await socket.sendMessage(message.key.remoteJid, {
                        audio: fs.readFileSync(audioPath),
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt: true
                    });

                    await new Promise(resolve => setTimeout(resolve, 3000));

                    const cnpjInfo = `
┏──━━◤ 𝘙𝘌𝘊𝘌𝘐𝘛𝘈 𝘍𝘌𝘋𝘌𝘙𝘈𝘓 | 𝘊𝘕𝘗𝘑 ◢━━──┓
╟┓
║┢ 🔢 *𝘊𝘕𝘗𝘑*: ${data.cnpj}
║╽
║┢ ✏ *𝘕𝘖𝘔𝘌*: ${data.nome}
║╽
║┢ 🎭 *𝘕𝘖𝘔𝘌 𝘍𝘈𝘕𝘛𝘈𝘚𝘐𝘈*: ${data.fantasia || 'Sem nome fantasia registrado 🙅‍♂️'}
║╽
║┢ 🗺 *𝘈𝘉𝘌𝘙𝘛𝘜𝘙𝘈*: ${data.abertura}
║╽
║┢ 🔨 *𝘛𝘐𝘗𝘖*: ${data.tipo}
║╽
║┢ 📄 *𝘗𝘖𝘙𝘛𝘌*: ${data.porte}
║╽
║┢ 👨‍⚖ *𝘕𝘈𝘛𝘜𝘙𝘌𝘡𝘈 𝘑𝘜𝘙𝘐𝘋𝘐𝘊𝘈*: ${data.natureza_juridica}
║╽
║┢ 🥈 *𝘈𝘛𝘐𝘝𝘐𝘋𝘈𝘋𝘌𝘚 𝘚𝘌𝘊𝘜𝘕𝘋𝘈𝘙𝘐𝘈𝘚*:
${atividadesSecundarias || 'Sem atividades secundárias registradas 🙅‍♂️'}
║╽
║┢ 👑 *𝘚𝘖𝘊𝘐𝘖𝘚 / 𝘈𝘋𝘔𝘐𝘕𝘐𝘚𝘛𝘙𝘈𝘋𝘖𝘙𝘌𝘚*:
${socios || 'Sem sócios registrados 🙅‍♂️'}
║╽
║┢ 🏡 *𝘌𝘕𝘋𝘌𝘙𝘌𝘊𝘖*: ${data.logradouro}, ${data.numero}, ${data.bairro}, ${data.municipio} - ${data.uf}
║╽
║┢ 📩 *𝘌𝘔𝘈𝘐𝘓*: ${data.email || 'Sem e-mail registrado 🙅‍♂️'}
║╽
║┢ 📞 *𝘛𝘌𝘓𝘌𝘍𝘖𝘕𝘌*: ${data.telefone || 'Sem telefone registrado 🙅‍♂️'}
║╽
║┢ 🛡 *𝘚𝘛𝘈𝘛𝘜𝘚*: ${data.situacao}
║╽
║┢ 💸 *𝘊𝘈𝘗𝘐𝘛𝘈𝘓 𝘚𝘖𝘊𝘐𝘈𝘓*: R$ ${parseFloat(data.capital_social).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
╙┷━━━━━━━───━━━━━━━┛
`;
              
                    const receitaImage = path.join(__dirname, 'src', 'images', 'receita-federal.jpg');
                    await socket.sendMessage(message.key.remoteJid, {
                    image: receitaImage,
                    caption: cnpjInfo,
                    contextInfo: { 
                        isForwarded: true, 
                        forwardingScore: 9999
                    }
                    });
                    
                  } catch (error) {
                    console.error('Erro ao consultar CNPJ:', error);
                    await socket.sendMessage(message.key.remoteJid, { text: '*❌ Erro ao consultar o CNPJ. Tente novamente mais tarde.*' });
                  }

                } else if (textMessage.startsWith('#ip ')) {
                    await socket.sendMessage(sender, {
                        react: {
                            text: "🌐",
                            key: message.key
                        }
                    });
                    await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                
                    const ip = textMessage.replace('#ip ', '').trim();
                
                    try {
                        const response = await axios.get(`http://ip-api.com/json/${ip}`);
                        const data = response.data;
                
                        if (data.status === 'fail') {
                            await socket.sendMessage(message.key.remoteJid, { text: '*❌ IP inválido ou não encontrado!*' });
                            return;
                        }

                        const audioPath = path.join(__dirname, 'src', 'audios', 'ip.ogg');

                        await socket.sendMessage(message.key.remoteJid, {
                            audio: fs.readFileSync(audioPath),
                            mimetype: 'audio/ogg; codecs=opus',
                            ptt: true
                        });

                        await new Promise(resolve => setTimeout(resolve, 3000));
                
                        const mapsLink = `https://www.google.com/maps?q=${data.lat},${data.lon}`;
                
const ipInfo = `
┏──━━◤ 𝘐𝘗-𝘈𝘗𝘐 ◢━━──┓
╟┓
║┢ 🔢 *𝘐𝘗*: ${data.query}
║╽
║┢ 🌍 *𝘗𝘈𝘐𝘚*: ${data.country} (${data.countryCode})
║╽
║┢ 🚦 *𝘙𝘌𝘎𝘐𝘈𝘖 / 𝘌𝘚𝘛𝘈𝘋𝘖*: ${data.regionName} (${data.region})
║╽
║┢ 🗺 *𝘊𝘐𝘋𝘈𝘋𝘌*: ${data.city}
║╽
║┢ 🧷 *𝘊𝘌𝘗 / 𝘡𝘐𝘗*: ${data.zip || 'Não disponível'}
║╽
║┢ 📍 *𝘓𝘈𝘛𝘐𝘛𝘜𝘋𝘌*: ${data.lat}
║╽
║┢ 📍 *𝘓𝘖𝘕𝘎𝘐𝘛𝘜𝘋𝘌*: ${data.lon}
║╽
║┢ ⌚ *𝘍𝘜𝘚𝘖-𝘏𝘖𝘙𝘈𝘙𝘐𝘖*: ${data.timezone}
║╽
║┢ 👨‍💼 *𝘗𝘙𝘖𝘝𝘌𝘋𝘖𝘙*: ${data.isp}
║╽
║┢ 📍 *𝘝𝘐𝘚𝘜𝘈𝘓𝘐𝘡𝘈𝘙 𝘕𝘖 𝘔𝘈𝘗𝘈*: ${mapsLink}
╙┷━━━━━━━───━━━━━━━┛
`;
                
                        const logoIP = await loadLogoIP()
                        await socket.sendMessage(message.key.remoteJid, {
                            text: ipInfo,
                            contextInfo: {
                              forwardingScore: 508,
                              isForwarded: true,
                              externalAdReply: {
                                title: `『 𝙸𝙿-𝙰𝙿𝙸 📍 `,
                                body: `🛠️ by gabriel shai 🛠️`,
                                previewType: "PHOTO",
                                thumbnailUrl: ``,
                                thumbnail: logoIP,
                                sourceUrl: "",
                              },
                            },
                        }
                    );
                
                    } catch (error) {
                        console.error('Erro ao consultar IP:', error);
                        await socket.sendMessage(message.key.remoteJid, { text: '*❌ Erro ao consultar o IP. Tente novamente mais tarde.*' });
                    }               

            } else if (textMessage === '#gulag') {
                try {
                    await socket.sendMessage(sender, {
                        react: {
                            text: "☠️",
                            key: message.key
                        }
                    });
                    await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                    await new Promise(resolve => setTimeout(resolve, 1000));
            
                    const chat = await socket.groupMetadata(message.key.remoteJid);
                    const participants = chat.participants;
                    const botNumber = socket.user.id.split(':')[0] + '@s.whatsapp.net';
            
                    if (!message.key.remoteJid.endsWith('@g.us')) {
                        return socket.sendMessage(message.key.remoteJid, { text: 'Este comando só pode ser usado em grupos!' });
                    }
            
                    const isAdmin = participants.find(p => p.id === message.key.participant && p.admin);
                    if (!isAdmin) {
                        return socket.sendMessage(message.key.remoteJid, { text: 'Você precisa ser um administrador para usar este comando!' });
                    }
            
                    const botAdmin = participants.find(p => p.id === botNumber && p.admin);
                    if (!botAdmin) {
                        return socket.sendMessage(message.key.remoteJid, { text: 'Eu preciso ser administrador para iniciar o GULAG!' });
                    }
            
                    const groupOwner = chat.owner; // ID do dono do grupo
                    const humanParticipants = participants.filter(p => p.id !== botNumber && p.id !== groupOwner && !p.id.includes(':'));

                    if (humanParticipants.length < 2) {
                        return socket.sendMessage(message.key.remoteJid, { text: 'Preciso de pelo menos dois membros no grupo para iniciar o GULAG!' });
                    }
            
                    const shuffled = humanParticipants.sort(() => 0.5 - Math.random());
                    const [user1, user2] = shuffled;
            
                    const imagePath = path.join(__dirname, 'src', 'images', 'GULAG.jpg');
                    const audioPath = path.join(__dirname, 'src', 'audios', 'MUSICAGULAG.ogg');
            
                    const gulagMessage = `☠ GULAG INICIADO! ☠\n\nA     da morte girou... e os escolhidos para o exílio sombrio são:\n\n🔻 @${user1.id.split('@')[0]} – Seu destino foi selado.\n🔻 @${user2.id.split('@')[0]} – Não há escapatória.\n\n⏳ Suas almas serão levadas para o frio e implacável GULAG... 😈`;
            
                    await socket.sendMessage(message.key.remoteJid, {
                        image: fs.readFileSync(imagePath),
                        caption: gulagMessage,
                        mentions: [user1.id, user2.id]
                    });
            
                    await socket.sendMessage(message.key.remoteJid, {
                        audio: fs.readFileSync(audioPath),
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt: true
                    });                    
            
                    setTimeout(async () => {
                        await socket.groupParticipantsUpdate(message.key.remoteJid, [user1.id], 'remove');
                        await socket.sendMessage(message.key.remoteJid, {
                            text: `⚰ @${user1.id.split('@')[0]} já sente o frio do GULAG...`,
                            mentions: [user1.id]
                        });
                    }, 30000);
            
                    setTimeout(async () => {
                        await socket.groupParticipantsUpdate(message.key.remoteJid, [user2.id], 'remove');
                        await socket.sendMessage(message.key.remoteJid, {
                            text: `⚰ O GULAG RECLAMOU SUAS ALMAS! ⚰\n\nAs trevas agora pertencem a @${user1.id.split('@')[0]} e @${user2.id.split('@')[0]}\nSeus gritos ecoam pelos corredores vazios do além. 🕯\n\nQue isso sirva de aviso para os que ainda respiram neste grupo! ☠`,
                            mentions: [user1.id, user2.id]
                        });
                    }, 60000);
                } catch (err) {
                    console.error('❌ | Erro ao processar o GULAG:', err);
                }
            
            } else if (textMessage === '#perfil') {
                await socket.sendMessage(sender, {
                    react: {
                        text: "👤",
                        key: message.key
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000));

                await handlePerfilCommand(socket, message);

            } else if (textMessage === '#roleta') {
                await socket.sendMessage(sender, {
                    react: {
                        text: "💀",
                        key: message.key
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000));

                const chat = await socket.groupMetadata(message.key.remoteJid);
                const participants = chat.participants;

                const botNumber = socket.user.id.split(':')[0] + '@s.whatsapp.net';

                if (!message.key.remoteJid.endsWith('@g.us')) {
                    return socket.sendMessage(message.key.remoteJid, { text: 'Este comando só pode ser usado em grupos!' });
                }
        
                const isAdmin = participants.find(p => p.id === message.key.participant && p.admin);
                if (!isAdmin) {
                    return socket.sendMessage(message.key.remoteJid, { text: 'Você precisa ser um administrador para usar este comando!' });
                }
        
                const botAdmin = participants.find(p => p.id === botNumber && p.admin);
                if (!botAdmin) {
                    return socket.sendMessage(message.key.remoteJid, { text: 'Eu preciso ser administrador para iniciar o GULAG!' });
                }
        
                const groupOwner = chat.owner; // ID do dono do grupo

                const eligibleMembers = participants.filter(member => member.id !== botNumber && member.id !== groupOwner);

                if (eligibleMembers.length === 0) {
                  await socket.sendMessage(message.key.remoteJid, { text: '*❌ | Não há membros elegíveis para a roleta.*' });
                  return;
                }
              
                // Escolhe um membro aleatório
                const randomMember = eligibleMembers[Math.floor(Math.random() * eligibleMembers.length)];
                const mentionedJid = [randomMember.id];

                await socket.sendMessage(message.key.remoteJid, { 
                    text: `Entre os sorteados do grupo *${chat.subject}*, @${randomMember.id.split('@')[0]}... hoje não é seu dia de sorte... 😬`, 
                    mentions: mentionedJid 
                });                
                await socket.sendMessage(message.key.remoteJid, { text: 'Suas últimas palavras...' });

                setTimeout(async () => {
                    await socket.groupParticipantsUpdate(remoteJid, [randomMember.id], 'remove');
                    await socket.sendMessage(remoteJid, { text: `@${randomMember.id.split('@')[0]} foi expulso. 😵`, mentions: mentionedJid });
                  }, 15000);

            
            } else if (textMessage.startsWith('#changeDesc ')) {
                await socket.sendMessage(sender, {
                    react: {
                        text: "✏️", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo

                await handleChangeDescCommand(socket, message);

            } else if (textMessage.startsWith('#pin')) {
                await socket.sendMessage(sender, {
                    react: {
                        text: "📍", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo

                await handlePinCommand(socket, message, command)
                                
            
            } else if (textMessage === '#s' && message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
                await socket.sendMessage(sender, {
                    react: {
                        text: "✅", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
                
                await handleImageMessage(socket, message);
            
            
            
            } else if (textMessage.startsWith('#ban ')) {
                await socket.sendMessage(sender, {
                    react: {
                        text: "🛠️", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo

                await handleBanCommand(socket, message);

            } else if (textMessage === ('#select')) {
                await socket.sendMessage(sender, {
                    react: {
                        text: "✅", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo

                await sendListMessage(socket, sender);
            
            
            } else if (textMessage === '#lock') {
                await socket.sendMessage(sender, {
                    react: {
                        text: "🔒", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
                
                await handleLockCommand(socket, message);
            
            } else if (textMessage === '#livre') {
                await socket.sendMessage(sender, {
                    react: {
                        text: "✅", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
                
                await handleLivreCommand(socket, message);

            } else if (textMessage === '#restrito') {
                await socket.sendMessage(sender, {
                    react: {
                        text: "✅", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
                
                await handleRestritoCommand(socket, message);
            
            } else if (textMessage === 'reset') {
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
                
                await resetMessage(socket, message);

            } else if (textMessage === 'thumbnail') {
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
                
                await sendMessageWithNoThumbnail(socket, sender);
            
            
            
            
            } else if (textMessage === '#unlock') {
                await socket.sendMessage(sender, {
                    react: {
                        text: "🔓", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
                
                await handleUnlockCommand(socket, message);



            } else if (textMessage.startsWith('#inviteLink')) {
                await socket.sendMessage(sender, {
                    react: {
                        text: "🫂", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
                
                await handleInviteLinkCommand(socket, message);
            
            
            
            } else if (textMessage === '#hd') {
                await socket.sendMessage(sender, {
                    react: {
                        text: "📸", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
                
                await handleHDCommand(socket, message);





            } else if (textMessage && textMessage.startsWith('#hidetag ')) {
                await socket.sendMessage(sender, {
                    react: {
                        text: "👀", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
                
                await handleHideTagCommand(socket, message);
            
            
            
            } else if (textMessage.startsWith('#antilink')) {
                await socket.sendMessage(sender, {
                    react: {
                        text: "✅", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
                
                await toggleAntiLink(socket, message);
            
            
            
            } else if (textMessage.startsWith('#antifake')) {
                await socket.sendMessage(sender, {
                    react: {
                        text: "✅", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
                
                await handleAntiFake(socket, message);
            
            
            
            
            } else if (textMessage.startsWith('#promote ')) {
                await socket.sendMessage(sender, {
                    react: {
                        text: "✅", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
                
                await handlePromote(socket, message);
            
            
            
            
            
            } else if (textMessage.startsWith('#demote ')) {
                await socket.sendMessage(sender, {
                    react: {
                        text: "✅", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
                
                await handleDemote(socket, message);
            
            
            
            
            
            } else if (textMessage.startsWith('#cep ')) {
                await socket.sendMessage(sender, {
                    react: {
                        text: "🏠", // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
                
                await handleCep(socket, message);
            
            
            
            
            } else if (textMessage === '#menuAntigo') {
                const hearts = ["❤️", "🧡", "💛", "💚", "💙", "💜", "🤎", "🖤", "🤍", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"];
                const randomHeart = hearts[Math.floor(Math.random() * hearts.length)];

                await socket.sendMessage(sender, {
                    react: {
                        text: randomHeart, // Emoji de reação
                        key: message.key // Mensagem a ser reagida
                    }
                });
                await socket.sendPresenceUpdate("composing", message.key.remoteJid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo
                
                await handleMenuAntigo(socket, message);
            } else {
                console.log('❌ | Tipo de mensagem não tratado:', message.message);
            }
            await socket.sendPresenceUpdate("available", message.key.remoteJid);
        } catch (error) {
            console.error('❌ | Erro ao processar mensagem:', error);
        }
    });
}

async function handleMenuAntigo(socket, message) {
    try {
        await socket.sendPresenceUpdate("composing", message.key.remoteJid);
        await new Promise(resolve => setTimeout(resolve, 1000));

        const userNick = message.pushName || '🔒 Não identificado 🔒';
        const now = new Date();
        const date = now.toLocaleDateString('pt-BR');
        const time = now.toLocaleTimeString('pt-BR');
        const menuMessage = `⟅ 𝑾𝑬𝑳𝑪𝑶𝑴𝑬\n\n『𝑰𝑵𝑭𝑶』\n\n> ╭──────────\n> │ 🏷️ 𝑵𝒊𝒄𝒌: ${userNick}\n> │ 📅 𝑫𝒂𝒕𝒂: ${date}\n> │ ⏰ 𝑯𝒐𝒓𝒂: ${time}\n> ╰──────────\n\n『𝑴𝑬𝑵𝑼』\n\n🖼️ #s - Criar sticker\n🎧 #ytmp3 [link] - Baixar áudio do YouTube\n🎥 #ytmp4 [link] - Baixar vídeo do YouTube | *EM BREVE*\n✏️ #changeDesc [texto] - Alterar descrição do grupo\n🦵 #ban @user - Banir membro\n🔒 #lock - Bloquear grupo\n🔓 #unlock - Desbloquear grupo\n🛡️ #restrito - Apenas administradores poderão mudar as configurações do grupo\n👦 #livre - Todos os membros poderão mudar as configurações do grupo\n📮 #inviteLink - Obter link do grupo\n📸 #hd - Melhorar imagem\n👀 #hidetag [mensagem] - Mensagem oculta\n🌐 #antilink - Ativar/desativar antilink\n🎭 #antifake - Bloquear números internacionais\n📈 #promote @user - Tornar membro administrador\n📉 #demote @user - Remover administrador\n🏠 #cep [CEP] - Consultar endereço\n👤 #perfil - Consulta o seu perfil\n\n『 𝐌𝐈𝐍𝐈𝐒𝐇𝐀𝐈 𝐁𝐎𝐓 🤖 』\nby gabriel shai`;

        const imageBuffer = fs.readFileSync(path.join(__dirname, 'MiniShai.png'));

        await socket.sendMessage(message.key.remoteJid, {
            image: imageBuffer,
            caption: menuMessage,
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999,
                externalAdReply: {
                    title: `𝕾𝖆𝖙𝖔𝖗𝖚 𝕸𝖚𝖑𝖙𝖎 𝕯𝖊𝖛𝖎𝖈𝖊`,
                    body: `Obrigado por usar o meu bot!!\n\nMeu dono agradece!!`,
                    previewType: "PHOTO",
                    thumbnailUrl: ``,
                    thumbnail: ``,
                    sourceUrl: "",
                  },
            }
        });

        await socket.sendPresenceUpdate("available", message.key.remoteJid);
    } catch (error) {
        console.error('❌ | Erro ao processar o menu:', error);
    }
}


async function verificarCooldown(socket, message) {
    const userJid = message.key.participant || message.key.remoteJid;
    
    if (cooldowns.has(userJid)) {
        const tempoRestante = (cooldowns.get(userJid) - Date.now()) / 1000;
        if (tempoRestante > 0) {
            await socket.sendMessage(message.key.remoteJid, { 
                text: `🛑 Para evitar spam, aguarde ${tempoRestante.toFixed(1)}s @${userJid.split('@')[0]} 🤖 📵`,
                contextInfo: { 
                    isForwarded: true, 
                    forwardingScore: 9999
                }, 
                mentions: [userJid] 
            });
            return true;
        }
    }
    
    cooldowns.set(userJid, Date.now() + 5000); // Define o cooldown de 5s
    setTimeout(() => cooldowns.delete(userJid), 5000); // Remove após 5s
    
    return false;
}

// Função para lidar com o comando #hidetag
async function handleHideTagCommand(socket, message) {
    try {
        const groupId = message.key.remoteJid;
        
        // Verificar se a mensagem foi enviada em um grupo
        if (!groupId.endsWith('@g.us')) {
            return socket.sendMessage(groupId, { 
                text: '❌ | Este comando só pode ser usado em grupos.',
                contextInfo: { 
                    isForwarded: true, 
                    forwardingScore: 9999
                }
            });
        }

        const metadata = await socket.groupMetadata(groupId);
        const participants = metadata.participants;

        // Obter a mensagem que vem após o comando #hidetag
        const textMessage = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const textoo = textMessage?.split(' ').slice(1).join(' '); // Pegando tudo após o comando

        // Criar uma lista de IDs dos participantes
        const userIds = participants.map(p => p.id);

        // Enviar uma mensagem mencionando todos os participantes sem expor os números
        await socket.sendMessage(groupId, { 
            text: textoo, // Aqui substituímos pela descrição depois do comando
            mentions: userIds,
        });

        // Resposta informando que as menções foram feitas, mas sem revelar números
        console.log('✅ | Comando #hidetag executado com sucesso.');
    } catch (error) {
        console.error('❌ | Erro ao processar o comando #hidetag:', error);
        await socket.sendMessage(groupId, { 
            text: '❌ | Erro ao processar o comando #hidetag.',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    }
}

async function handleRestritoCommand(socket, message) {
    const groupId = message.key.remoteJid;
    if (!groupId.endsWith('@g.us')) {
        return socket.sendMessage(groupId, { 
            text: '*❌ | Este comando só pode ser usado em grupos.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    }

    const metadata = await socket.groupMetadata(groupId);
    const participants = metadata.participants;

    const sender = message.key.participant;
    const botId = socket.user.id.split(':')[0] + '@s.whatsapp.net';

    const isSenderAdmin = participants.find(p => p.id === sender)?.admin;
    const isBotAdmin = participants.find(p => p.id === botId)?.admin;

    if (!isSenderAdmin) {
        return socket.sendMessage(groupId, { 
            text: '*❌ | Você precisa ser administrador para usar este comando.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    }

    if (!isBotAdmin) {
        return socket.sendMessage(groupId, { 
            text: '*❌ | O bot precisa ser administrador para realizar esta ação.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    }

    try {
        await socket.groupSettingUpdate(jid, 'locked')

        await socket.sendMessage(groupId, { 
            text: '*✅ | O grupo está no status Restrito, ou seja: Apenas administradores podem mudar configurações do grupo.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    } catch (error) {
        console.error('❌ | Erro ao alterar o status do grupo:', error);
        await socket.sendMessage(groupId, { 
            text: '*❌ | Erro ao alterar o status do grupo.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    }
}

async function handleLivreCommand(socket, message) {
    const groupId = message.key.remoteJid;
    if (!groupId.endsWith('@g.us')) {
        return socket.sendMessage(groupId, { 
            text: '*❌ | Este comando só pode ser usado em grupos.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    }

    const metadata = await socket.groupMetadata(groupId);
    const participants = metadata.participants;

    const sender = message.key.participant;
    const botId = socket.user.id.split(':')[0] + '@s.whatsapp.net';

    const isSenderAdmin = participants.find(p => p.id === sender)?.admin;
    const isBotAdmin = participants.find(p => p.id === botId)?.admin;

    if (!isSenderAdmin) {
        return socket.sendMessage(groupId, { 
            text: '*❌ | Você precisa ser administrador para usar este comando.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    }

    if (!isBotAdmin) {
        return socket.sendMessage(groupId, { 
            text: '*❌ | O bot precisa ser administrador para realizar esta ação.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    }

    try {
        await socket.groupSettingUpdate(groupId, 'unlocked')

        await socket.sendMessage(groupId, { 
            text: '*✅ | O grupo está no status Livre, ou seja: Todos os membros podem alterar configurações do grupo.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    } catch (error) {
        console.error('❌ | Erro ao alterar o status do grupo:', error);
        await socket.sendMessage(groupId, { 
            text: '*❌ | Erro ao alterar o status do grupo.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    }
}

async function handleUnlockCommand(socket, message) {
    const groupId = message.key.remoteJid;
    if (!groupId.endsWith('@g.us')) {
        return socket.sendMessage(groupId, { 
            text: '*❌ | Este comando só pode ser usado em grupos.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    }

    const metadata = await socket.groupMetadata(groupId);
    const participants = metadata.participants;

    const sender = message.key.participant;
    const botId = socket.user.id.split(':')[0] + '@s.whatsapp.net';

    const isSenderAdmin = participants.find(p => p.id === sender)?.admin;
    const isBotAdmin = participants.find(p => p.id === botId)?.admin;

    if (!isSenderAdmin) {
        return socket.sendMessage(groupId, { 
            text: '*❌ | Você precisa ser administrador para usar este comando.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    }

    if (!isBotAdmin) {
        return socket.sendMessage(groupId, { 
            text: '*❌ | O bot precisa ser administrador para realizar esta ação.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    }

    try {
        await socket.groupSettingUpdate(groupId, 'not_announcement');

        await socket.sendMessage(groupId, { 
            text: '*✅ | O grupo foi desbloqueado, agora todos os membros podem enviar mensagens.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    } catch (error) {
        console.error('❌ | Erro ao desbloquear o grupo:', error);
        await socket.sendMessage(groupId, { 
            text: '*❌ | Erro ao desbloquear o grupo.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    }
}

async function handleLockCommand(socket, message) {
    const groupId = message.key.remoteJid;
    if (!groupId.endsWith('@g.us')) {
        return socket.sendMessage(groupId, { 
            text: '*❌ | Este comando só pode ser usado em grupos.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    }

    const metadata = await socket.groupMetadata(groupId);
    const participants = metadata.participants;

    const sender = message.key.participant;
    const botId = socket.user.id.split(':')[0] + '@s.whatsapp.net';

    const isSenderAdmin = participants.find(p => p.id === sender)?.admin;
    const isBotAdmin = participants.find(p => p.id === botId)?.admin;

    if (!isSenderAdmin) {
        return socket.sendMessage(groupId, { 
            text: '*❌ | Você precisa ser administrador para usar este comando.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    }

    if (!isBotAdmin) {
        return socket.sendMessage(groupId, { 
            text: '*❌ | O bot precisa ser administrador para realizar esta ação.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    }

    try {
        await socket.groupSettingUpdate(groupId, 'announcement');
        await socket.sendMessage(groupId, { 
            text: '*✅ | O grupo foi trancado, apenas administradores podem enviar mensagens agora.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            }
         });
    } catch (error) {
        console.error('❌ | Erro ao trancar o grupo:', error);
        await socket.sendMessage(groupId, { text: '*❌ | Erro ao trancar o grupo.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } 
        });
    }
}

async function resetMessage(socket, message) {
    const groupId = message.key.remoteJid;
    return socket.sendMessage(groupId, { 
        text: '*_Reiniciando Sistemas_...* 🐕🤖',
        contextInfo: { 
            isForwarded: true, 
            forwardingScore: 9999
        } 
    });
}

async function handleAntiLink(socket, message) {
    const groupId = message.key.remoteJid;
    if (!groupId.endsWith('@g.us')) return;
    
    const textMessage = message.message?.conversation || message.message?.extendedTextMessage?.text || "";
    if (!antiLinkEnabled || !textMessage) return; // Só verifica se o antilink estiver ativado e a mensagem não for vazia
    
    if (textMessage.includes('http') || textMessage.includes('www.')) {
        await socket.sendMessage(groupId, { text: '❌ | Links não são permitidos neste grupo! Mensagem deletada.',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } });
        await socket.sendMessage(groupId, { delete: message.key });
    }
}

async function toggleAntiLink(socket, message) {
    const groupId = message.key.remoteJid;
    if (!groupId.endsWith('@g.us')) return;
    
    antiLinkEnabled = !antiLinkEnabled;
    await socket.sendMessage(groupId, { text: `🔒 | Proteção contra links ${antiLinkEnabled ? 'ativada' : 'desativada'}.`,
        contextInfo: { 
            isForwarded: true, 
            forwardingScore: 9999
        } });
}

async function handleAntiFake(socket, message) {
    const groupId = message.key.remoteJid;
    if (!groupId.endsWith('@g.us')) return;
    
    const metadata = await socket.groupMetadata(groupId);
    const participants = metadata.participants || [];
    
    let foundFake = false;
    for (const participant of participants) {
        if (!participant.id.startsWith('55')) { // Apenas números do Brasil permitidos
            foundFake = true;
            await socket.sendMessage(groupId, { text: `🚫 | Número internacional detectado: @${participant.id.split('@')[0]}`, mentions: [participant.id],
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } });
        }
    }
    
    if (!foundFake) {
        await socket.sendMessage(groupId, { text: '✅ | Nenhum número internacional foi encontrado no grupo.',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } });
    }
}


async function handlePromote(socket, message) {
    const groupId = message.key.remoteJid;
    if (!groupId.endsWith('@g.us')) return;
    
    const metadata = await socket.groupMetadata(groupId);
    const participants = metadata.participants || [];
    
    const sender = message.key.participant;
    const botId = socket.user.id.split(':')[0] + '@s.whatsapp.net';
    const groupOwner = metadata.owner;

    const isSenderAdmin = participants.find(p => p.id === sender)?.admin;
    const isBotAdmin = participants.find(p => p.id === botId)?.admin;

    if (!isSenderAdmin) {
        return socket.sendMessage(groupId, { text: '*❌ | Você precisa ser administrador para usar este comando.*',
            contextInfo: { 
                isForwarded: true, 
                forwardingScore: 9999
            } });
    }

    if (!isBotAdmin) {
        return socket.sendMessage(groupId, { text: '*❌ | O bot precisa ser administrador para realizar esta ação.*' });
    }

    const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentionedJids.length === 0) return;

    for (const jid of mentionedJids) {
        if (jid === sender) {
            return socket.sendMessage(groupId, { text: '*❌ | Você não pode se promover.*' });
        }
        if (jid === groupOwner) {
            return socket.sendMessage(groupId, { text: '*❌ | Você não pode promover o dono do grupo.*' });
        }
    }
    
    await socket.groupParticipantsUpdate(groupId, mentionedJids, 'promote');
    await socket.sendMessage(groupId, { text: `*✅ | Usuário promovido:* @${mentionedJids[0].split('@')[0]}`, mentions: mentionedJids,
    contextInfo: { 
        isForwarded: true, 
        forwardingScore: 9999
    } });
}

async function handleDemote(socket, message) {
    const groupId = message.key.remoteJid;
    if (!groupId.endsWith('@g.us')) return;
    
    const metadata = await socket.groupMetadata(groupId);
    const participants = metadata.participants || [];
    
    const sender = message.key.participant;
    const botId = socket.user.id.split(':')[0] + '@s.whatsapp.net';
    const groupOwner = metadata.owner;

    const isSenderAdmin = participants.find(p => p.id === sender)?.admin;
    const isBotAdmin = participants.find(p => p.id === botId)?.admin;

    if (!isSenderAdmin) {
        return socket.sendMessage(groupId, { text: '*❌ | Você precisa ser administrador para usar este comando.*' });
    }

    if (!isBotAdmin) {
        return socket.sendMessage(groupId, { text: '*❌ | O bot precisa ser administrador para realizar esta ação.*' });
    }

    const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentionedJids.length === 0) return;

    for (const jid of mentionedJids) {
        if (jid === sender) {
            return socket.sendMessage(groupId, { text: '*❌ | Você não pode se rebaixar.*' });
        }
        if (jid === botId) {
            return socket.sendMessage(groupId, { text: '*❌ | Você não pode rebaixar o bot.*' });
        }
        if (jid === groupOwner) {
            return socket.sendMessage(groupId, { text: '*❌ | Você não pode rebaixar o dono do grupo.*' });
        }
    }
    
    await socket.groupParticipantsUpdate(groupId, mentionedJids, 'demote');
    await socket.sendMessage(groupId, { text: `*✅ | Usuário rebaixado:* @${mentionedJids[0].split('@')[0]}`, mentions: mentionedJids,
    contextInfo: { 
        isForwarded: true, 
        forwardingScore: 9999
    } });
}

async function handleCep(socket, message) {
    const groupId = message.key.remoteJid;
    const textMessage = message.message?.conversation || message.message?.extendedTextMessage?.text;
    const cep = textMessage.split(' ')[1];
    
    if (!cep) {
        return socket.sendMessage(groupId, { text: '❌ | Você precisa fornecer um CEP válido.' });
    }

    try {
        const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
        const data = response.data;
        if (data.erro) throw new Error('CEP inválido');
        
        const result = `┏──━━◤ 𝘋𝘈𝘛𝘈𝘊𝘌𝘗 ◢━━──┓\n`
            + `╟┓\n`
            + `║┢ *🔢 𝘊𝘌𝘗:* ${data.cep}\n`
            + `║╽\n`
            + `║┢ *✏️ 𝘓𝘖𝘎𝘙𝘈𝘋𝘖𝘜𝘙𝘖:* ${data.logradouro}\n`
            + `║╽\n`
            + `║┢ *🚦 𝘉𝘈𝘐𝘙𝘙𝘖:* ${data.bairro}\n`
            + `║╽\n`
            + `║┢ *🗺️ 𝘊𝘐𝘋𝘈𝘋𝘌:* ${data.localidade}\n`
            + `║╽\n`
            + `║┢ *📍 𝘌𝘚𝘛𝘈𝘋𝘖:* ${data.uf}\n`
            + `║╽\n`
            + `║┢ *📞 𝘋𝘋𝘋:* 🇧🇷 +55${data.ddd}\n`
            + `╙┷━━━━━━━───━━━━━━━┛`;
        
        const viaCep = path.join(__dirname, 'src', 'images', 'viacep.png');

        await socket.sendMessage(groupId, {
            image: viaCep,
            caption: result,
            contextInfo: {
                forwardingScore: 9999,
                isForwarded: true,
            }
        });
    } catch (error) {
        await socket.sendMessage(groupId, { text: '❌ | CEP inválido ou erro ao buscar informações.' });
    }
}

async function handleImageMessage(socket, message) {
    const groupId = message.key.remoteJid;

    try {
        console.log("🔄 | Baixando imagem...");

        const buffer = await downloadMediaMessage(message, 'buffer', {}, {
            reuploadRequest: socket.updateMediaMessage
        });

        if (!buffer) {
            console.error("❌ | Erro: Buffer de imagem vazio.");
            return;
        }

        const outputFilePath = `${message.key.id}_output.jpg`;
        await writeFile(outputFilePath, buffer);
        console.log(`✅ | Imagem salva em: ${outputFilePath}`);

        const resizedImage = await sharp(outputFilePath).resize(512, 512).webp().toBuffer();
        console.log("📏 | Imagem convertida para WebP.");

        const userNumber = (message.key.participant || message.key.remoteJid || 'Bot').split('@')[0];

        const sticker = new Sticker(resizedImage, {
            pack: userNumber,
            author: 'MiniShai 🤖',
            type: 'default',
            categories: ['🤖'],
            quality: 100,
        });

        console.log("📤 | Enviando sticker...");
        await socket.sendMessage(groupId, await sticker.toMessage());
        console.log("✅ | Sticker enviado com sucesso!");

        await unlink(outputFilePath);
    } catch (error) {
        console.error('❌ | Erro ao processar imagem:', error);
    }
}


async function ytDownload(url, type) {
    try {
        if (!ytdl.validateURL(url)) throw new Error('URL inválida do YouTube.');

        const info = await ytdl.getInfo(url);
        let format;

        if (type === 'audio') {
            format = ytdl.filterFormats(info.formats, 'audioonly')[0];
            if (!format) throw new Error('Formato de áudio não encontrado.');
        } else if (type === 'video') {
            format = info.formats.find(f => f.hasVideo && f.hasAudio && f.container === 'mp4');
            if (!format) throw new Error('Formato de vídeo não encontrado.');
        }

        return {
            title: info.videoDetails.title,
            link: format.url,
        };
    } catch (error) {
        console.error(`❌ | Erro ao baixar ${type}:`, error.message);
        return { title: `Erro ao baixar ${type}`, link: 'N/A' };
    }
}

async function sendMessageWithNoThumbnail(socket, sender) {
    // Dados para a mensagem
    const messageData = {
        extendedTextMessage: {
            text: 'https://green-api.com.br/docs/video', // Link do texto
            title: 'Como desenvolver Bot WhatsApp', // Título
            description: 'Os documentos da Green API mostram como você pode desenvolver o Bot WhatsApp', // Descrição
        }
    };

    try {
        // Envia a mensagem sem thumbnail
        await socket.sendMessage(sender, messageData);
        
        console.log('✅ | Mensagem enviada com sucesso!');
    } catch (error) {
        console.error('❌ | Erro ao enviar mensagem:', error);
    }
}

async function handleBanCommand(socket, message) {
    const groupId = message.key.remoteJid;
    if (!groupId.endsWith('@g.us')) {
        return socket.sendMessage(groupId, { text: '*❌ | Este comando só pode ser usado em grupos.*' });
    }

    const metadata = await socket.groupMetadata(groupId);
    const participants = metadata.participants || [];
    
    const sender = message.key.participant;
    const botId = socket.user.id.split(':')[0] + '@s.whatsapp.net';
    const groupOwner = metadata.owner;

    const isSenderAdmin = participants.find(p => p.id === sender)?.admin;
    const isBotAdmin = participants.find(p => p.id === botId)?.admin;

    if (!isSenderAdmin) {
        return socket.sendMessage(groupId, { text: '*❌ | Você precisa ser administrador para usar este comando.*' });
    }

    if (!isBotAdmin) {
        return socket.sendMessage(groupId, { text: '*❌ | O bot precisa ser administrador para realizar esta ação.*' });
    }

    let mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedParticipant = message.message?.extendedTextMessage?.contextInfo?.participant;

    if (quotedMessage && quotedParticipant) {
        mentionedJids = [quotedParticipant];
    }

    if (mentionedJids.length === 0) {
        return socket.sendMessage(groupId, { text: '*❌ | Você deve mencionar ou responder ao usuário que deseja banir.*' });
    }

    for (const user of mentionedJids) {
        if (user === botId) {
            return socket.sendMessage(groupId, { text: '*❌ | Eu não posso me banir.*' });
        }

        if (user === sender) {
            return socket.sendMessage(groupId, { text: '*❌ | Você não pode se banir.*' });
        }

        if (user === groupOwner) {
            return socket.sendMessage(groupId, { text: '*❌ | Você não pode banir o dono do grupo.*' });
        }

        if (participants.some(p => p.id === user)) {
            try {
                await socket.groupParticipantsUpdate(groupId, [user], 'remove');
                await socket.sendMessage(groupId, { text: `*✅ | Usuário removido:* @${user.split('@')[0]}`, mentions: [user] });
            } catch (error) {
                console.error('*❌ | Erro ao banir usuário:*', error);
                await socket.sendMessage(groupId, { text: `*❌ | Erro ao remover* @${user.split('@')[0]}`, mentions: [user] });
            }
        } else {
            await socket.sendMessage(groupId, { text: `*❌ | Usuário* @${user.split('@')[0]} *não encontrado no grupo.*`, mentions: [user] });
        }
    }
}

// Função para lidar com o comando #hd e transformar a imagem para HD
async function handleHDCommand(socket, message) {
    try {
        let imageMessage = null;

        // Se o usuário respondeu a uma imagem
        if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
            imageMessage = message.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage;
        } 
        // Se o usuário enviou diretamente uma imagem
        else if (message.message?.imageMessage) {
            imageMessage = message.message.imageMessage;
        }

        if (!imageMessage) {
            return socket.sendMessage(message.key.remoteJid, { text: '❌ | Nenhuma imagem encontrada. Envie ou responda a uma imagem para usar o comando.' });
        }

        // Baixando a imagem
        const imageBuffer = await downloadMediaMessage(
            { message: { imageMessage }, key: message.key },
            'buffer'
        );

        if (!imageBuffer) {
            return socket.sendMessage(message.key.remoteJid, { text: '❌ | Erro ao baixar a imagem.' });
        }

        // Melhorar a qualidade da imagem usando sharp
        const enhancedImageBuffer = await sharp(imageBuffer)
            .resize({ width: 2000 }) // Aumenta o tamanho para uma resolução mais alta
            .toFormat('jpeg')
            .toBuffer();

        // Enviando a imagem de volta em HD sem compressão
        await socket.sendMessage(message.key.remoteJid, { 
            image: enhancedImageBuffer, 
            mimetype: 'image/jpeg', 
            caption: '✅ | Aqui está sua imagem em HD!' 
        });

    } catch (error) {
        console.error('❌ | Erro ao processar imagem em HD:', error);
        await socket.sendMessage(message.key.remoteJid, { text: '❌ | Ocorreu um erro ao processar a imagem.' });
    }
}

async function sendListMessage(sock, jid) {
    const buttonMessage = {
        text: "Escolha uma opção:",
        footer: "Clique no botão abaixo para confirmar.",
        buttons: [
            { buttonId: "confirmar", buttonText: { displayText: "✅ Confirmar" }, type: 1 }
        ],
        headerType: 1
    };

    await sock.sendMessage(jid, buttonMessage);
}

async function handleInviteLinkCommand(socket, message) {
    const groupId = message.key.remoteJid;
    
    // Verificar se a mensagem foi enviada em um grupo
    if (!groupId.endsWith('@g.us')) {
        return socket.sendMessage(groupId, { text: '❌ | Este comando só pode ser usado em grupos.' });
    }

    const metadata = await socket.groupMetadata(groupId);
    const participants = metadata.participants;

    const sender = message.key.participant;
    const botId = socket.user.id.split(':')[0] + '@s.whatsapp.net';

    // Verificar se o remetente é administrador do grupo
    const isBotAdmin = participants.find(p => p.id === botId)?.admin;

    if (!isBotAdmin) {
        return socket.sendMessage(groupId, { text: '❌ | O bot precisa ser administrador para realizar esta ação.' });
    }

    try {
        // Obter o link de convite do grupo
        const inviteLink = await socket.groupInviteCode(groupId);
        const inviteUrl = `https://chat.whatsapp.com/${inviteLink}`;

        await socket.sendMessage(groupId, { text: `✅ | Link de convite para o grupo: ${inviteUrl}` });
    } catch (error) {
        console.error('❌ | Erro ao obter o link de convite:', error);
        await socket.sendMessage(groupId, { text: '❌ | Erro ao obter o link de convite do grupo.' });
    }
}

async function handlePinCommand(socket, message, command) {
    const groupId = message.key.remoteJid;

    // Verifica se a mensagem é uma resposta válida
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    if (!contextInfo?.stanzaId) {
        await socket.sendMessage(groupId, { text: '❌ | Por favor, responda a uma mensagem para fixá-la.' });
        return;
    }

    // Captura o argumento do tempo
    const args = command.split(' ').slice(1);
    const timeArg = args[0]?.trim().toLowerCase();

    if (!timeArg) {
        await socket.sendMessage(groupId, { text: '⏳ | Você precisa especificar o tempo: *24h*, *7d* ou *30d*.' });
        return;
    }

    const timeMap = {
        '24h': 86400,
        '7d': 604800,
        '30d': 2592000
    };

    const duration = timeMap[timeArg];

    if (!duration) {
        await socket.sendMessage(groupId, { text: '❌ | Tempo inválido! Use: *24h*, *7d* ou *30d*.' });
        return;
    }

    const repliedMessageKey = contextInfo.stanzaId;

    try {
        await socket.sendMessage(groupId, {
            pin: {
                type: 1, // 1 para fixar, 0 para desfixar
                time: duration,
                key: {
                    id: repliedMessageKey,
                    remoteJid: groupId,
                    fromMe: false // Garante que a mensagem fixada pode ser de outro usuário
                }
            }
        });

        await socket.sendMessage(groupId, { text: `📌 | Mensagem fixada por *${timeArg}* com sucesso!` });
    } catch (error) {
        console.error('❌ | Erro ao fixar mensagem:', error);
        await socket.sendMessage(groupId, { text: '❌ | Ocorreu um erro ao fixar a mensagem.' });
    }
}

async function handleChangeDescCommand(socket, message) {
    const groupId = message.key.remoteJid;
    
    // Verificar se a mensagem foi enviada em um grupo
    if (!groupId.endsWith('@g.us')) {
        return socket.sendMessage(groupId, { text: '*❌ | Este comando só pode ser usado em grupos.*' });
    }

    const metadata = await socket.groupMetadata(groupId);
    const participants = metadata.participants;

    const sender = message.key.participant;
    const botId = socket.user.id.split(':')[0] + '@s.whatsapp.net';

    // Verificar se o remetente é administrador do grupo
    const isSenderAdmin = participants.find(p => p.id === sender)?.admin;
    const isBotAdmin = participants.find(p => p.id === botId)?.admin;

    if (!isSenderAdmin) {
        return socket.sendMessage(groupId, { text: '*❌ | Você precisa ser administrador para usar este comando.*' });
    }

    if (!isBotAdmin) {
        return socket.sendMessage(groupId, { text: '*❌ | O bot precisa ser administrador para realizar esta ação.*' });
    }

    // Obter o texto da nova descrição
    const textMessage = message.message?.conversation || message.message?.extendedTextMessage?.text;
    const args = textMessage?.split(' '); // Separar a mensagem em palavras
    const newDesc = args?.slice(1).join(' '); // Pegar tudo após o primeiro elemento (o comando)

    if (!newDesc) {
        return socket.sendMessage(groupId, { text: '*❌ | Você precisa fornecer uma nova descrição para o grupo.*' });
    }

    try {
        // Atualizar a descrição do grupo
        await socket.groupUpdateDescription(groupId, newDesc);
        await socket.sendMessage(groupId, { text: `*✅ | A descrição do grupo foi atualizada para: ${newDesc}*` });
    } catch (error) {
        console.error('❌ | Erro ao mudar a descrição do grupo:', error);
        await socket.sendMessage(groupId, { text: '*❌ | Erro ao atualizar a descrição do grupo.*' });
    }
}

async function handlePerfilCommand(socket, message) {
    const groupId = message.key.remoteJid;
    const senderJid = message.key.participant || message.key.remoteJid;

    try {
        // Buscar informações de quem usou o comando
        const contact = await socket.fetchStatus(senderJid).catch(() => null);
        const name = message.pushName || 'Desconhecido';
        const number = senderJid.split('@')[0];

        // Buscar bio/status
        let bio;
        try {
            const status = await socket.fetchStatus(senderJid);
            bio = status?.status || '🔒 | Bloqueada';
        } catch (err) {
            bio = '🔒 | Bloqueada';
        }

        // Buscar foto de perfil
        let imageBuffer;
        try {
            const profilePictureUrl = await socket.profilePictureUrl(senderJid, 'image');
            const response = await axios.get(profilePictureUrl, { responseType: 'arraybuffer' });
            imageBuffer = Buffer.from(response.data, 'binary');
        } catch (err) {
            imageBuffer = fs.readFileSync(path.join(__dirname, 'src', 'images', 'SemFotoDePerfil.png'));
        }

        // Montar mensagem
        const perfilMessage = `
╓─━⎓⎔⎓⎔⎓⎔⎓⎔⎓⎔⎓⎔⎓⎔⎓⎔⎓━─┒
┢╕ㅤㅤㅤㅤㅤ📦 𝙂𝙀𝙍𝘼𝙇 📦
╽╟ • ɴᴏᴍᴇ: ${name}
╽╟ • ɴúᴍᴇʀᴏ: wa.me/${number}
╽╟ • ʙɪᴏ: ${bio}
┕╨⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋┚

╓─━═╾╼═╾╼═╾╼═╾╼═╾╼═╾╼═━─┒
┢╕ㅤㅤㅤ📊 𝘾𝙊𝙉𝙏𝘼𝘿𝙊𝙍𝙀𝙎 (𝙀𝙈 𝘽𝙍𝙀𝙑𝙀) 📊
╽╟ • ❪🗒ฺ࣭࣪͘ꕸ▸ ᴍᴇɴꜱᴀɢᴇɴꜱ
┢┸ • ❪🗄ฺ࣭࣪͘ꕸ▸ ᴄᴏᴍᴀɴᴅᴏꜱ
┢╕
╽╟ • ❪📬ฺ࣭࣪͘ꕸ▸ ʟᴇᴠᴇʟ
╽╟ • ❪🗳ฺ࣭࣪͘ꕸ▸ xᴩ
╽╟ • ❪💎ฺ࣭࣪͘ꕸ▸ ʀᴀɴᴋ
┢┸ • ❪📥ฺ࣭࣪͘ꕸ▸ ᴩᴀᴛᴇɴᴛᴇ
┕⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋⚋┚
        `;

        // Enviar mensagem com a foto de perfil
        await socket.sendMessage(groupId, {
            image: imageBuffer,
            caption: perfilMessage
        });

    } catch (error) {
        console.error('❌ | Erro ao buscar informações do perfil:', error);
        await socket.sendMessage(groupId, { text: '❌ | Ocorreu um erro ao buscar o seu perfil.' });
    }
}

miniShai1();    