# Minishai Bot

**Minishai Bot** é um bot de WhatsApp desenvolvido com a biblioteca [Baileys](https://github.com/adiwajshing/Baileys), com funcionalidades personalizadas para automação em grupos de WhatsApp, como comandos para envio de mídias, controle de permissões e muito mais!

## Funcionalidades

- **Comandos para grupos**: Gerenciamento de grupos, como banimento de usuários, fixação de mensagens, promoção e rebaixamento de membros, etc.
- **Downloads de mídias**: Baixar vídeos e áudios do YouTube, TikTok, Instagram, entre outros.
- **Comandos personalizados**: Funções como roleta, gulag, e visualização de CNPJ.
- **Proteção e segurança**: Anti-link, controle de permissões, e comandos para proteger o bot e o dono do grupo.

## Requisitos

- [Node.js](https://nodejs.org) (versão >= 14)
- [Baileys](https://github.com/WhiskeySockets/Baileys)
- Dependências do projeto (instaladas com `npm install`)

## Instalação

### 1. Clone o repositório:

```bash
git clone https://github.com/SEU_USUARIO/minishai_bot.git
cd minishai_bot
```

### 2. Instale as dependências:

```bash
npm install
```

### 3. Configure o arquivo de autenticação:

- Certifique-se de configurar a autenticação com o WhatsApp usando o método multifile, como indicado na documentação do Baileys.
- Insira as credenciais do WhatsApp para autenticação inicial no bot.

### 4. Rodando o bot:

Após a configuração, basta rodar o bot com o comando:

```bash
npm start
```

O bot será iniciado e estará pronto para ser usado em grupos de WhatsApp.

## Comandos Disponíveis

- **#ytmp3 [link]**: Baixa o áudio de um vídeo do YouTube em MP3.
- **#tiktokmp4 [link]**: Baixa um vídeo do TikTok.
- **#tiktokmp3 [link]**: Baixa o áudio de um vídeo do TikTok.
- **#cnpj [CNPJ]**: Mostra informações de uma empresa com base no CNPJ.
- **#roleta**: Escolhe um membro aleatório de um grupo para 'expulsão' (modo humor).
- **#gulag**: Envia dois membros aleatórios para o 'gulag' (expulsão após um tempo).
- **#antilink**: Ativa/desativa o sistema anti-link.
- **#s**: Cria stickers a partir de imagens.
- **#changeDesc [texto]**: Altera a descrição do grupo.
- **Dentre diversos outros.**

## Como Contribuir

1. Faça o fork do repositório.
2. Crie uma branch para suas mudanças (`git checkout -b feature/nome-da-sua-feature`).
3. Faça as alterações e commit (`git commit -am 'Adiciona nova funcionalidade'`).
4. Envie para o seu repositório forked (`git push origin feature/nome-da-sua-feature`).
5. Abra um pull request.

## Licença

Este projeto está licenciado sob a [MIT License](LICENSE).

## Agradecimentos

- [Baileys](https://github.com/WhiskeySockets/Baileys) pela excelente biblioteca para WhatsApp.
- [Youtube-dl](https://github.com/ytdl-org/youtube-dl) para o download de vídeos e áudios.
- [Snapinst API](https://www.snapinst.com) para o download de vídeos do Instagram.
```
