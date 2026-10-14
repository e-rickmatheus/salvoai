# Backup automático no Google Drive

Cada conta conecta seu próprio Google uma vez em Configurações. Após alterações no acervo, o servidor envia uma versão JSON compactada para a pasta privada SALVOAI — Backups. Uma rotina diária tenta novamente as cópias pendentes. A interface mostra a última cópia confirmada, erros e versões disponíveis para restaurar. A restauração acrescenta itens ausentes e preserva as edições atuais.

## Ativação pelo proprietário

1. Crie um projeto Google Cloud exclusivo para SALVOAI e habilite Google Drive API.
2. Configure Google Auth Platform para público externo. Use os escopos openid, email e https://www.googleapis.com/auth/drive.file. O aplicativo só acessa arquivos autorizados/criados por ele. Configure o domínio e o endereço público do aplicativo.
3. Crie um cliente OAuth do tipo Aplicativo da Web com redirecionamento exato https://salvoai-ebon.vercel.app/api/drive/callback.
4. Salve GOOGLE_DRIVE_CLIENT_ID e GOOGLE_DRIVE_CLIENT_SECRET nas variáveis privadas Production da Vercel. Gere CRON_SECRET aleatório com pelo menos 32 bytes e salve-o como segredo. Opcionalmente configure DRIVE_TOKEN_ENCRYPTION_KEY (32 bytes em base64) e preserve essa chave. Nunca publique segredos no Git ou chat.
5. Publique novamente. Conecte o Google pelo SALVOAI e confira a data da primeira cópia e o arquivo na pasta do Drive.
6. Para uso contínuo, publique a configuração OAuth em produção. Em Testing, autorizações com Drive normalmente expiram em sete dias. Siga as exigências de consentimento do Google para seu público.

## Proteção e limites

O salvamento do acervo e a indicação de backup pendente são confirmados juntos no PostgreSQL. Uma falha do Drive não desfaz seus dados. Tokens são criptografados no servidor, separados por usuário e excluídos das exportações. Os arquivos no Drive contêm links, notas, capas, categorias, coleções e preferências; não contêm senhas de login. Mantenha a pasta privada. O conteúdo usa a proteção da conta Google e não criptografia com senha própria.

As versões são preservadas sem exclusão automática e consomem seu espaço no Drive. Sem espaço ou com autorização revogada, a interface informa a pendência. Backups têm limite de 64 MB descompactados; importação manual pelo navegador tem limite de 4 MB. Arquivos maiores devem ser restaurados pela opção Drive ou baixados diretamente da pasta.

O agendamento tenta até 20 contas pendentes por execução e está definido para 03:00 UTC, meia-noite em São Paulo. Amplie a frequência/capacidade conforme crescimento e plano da hospedagem. Nenhum sistema garante perda zero: acompanhe a data confirmada. Se o banco estiver pausado, novas cópias não podem ser geradas; versões já enviadas continuam no Google.

## Portabilidade

O arquivo .json.gz abre com ferramentas comuns de descompactação e contém o mesmo JSON da exportação do SALVOAI. Pode ser importado em outra instalação. Após trocar banco ou autenticação, configure os novos serviços, entre com a conta correta e reconecte o Google. Conexões OAuth não fazem parte do backup de conteúdo. Preserve cópias administrativas separadas para migração de todas as contas e autenticação.

Fontes: [escopos Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [expiração OAuth](https://developers.google.com/identity/protocols/oauth2#expiration), [limites Drive](https://developers.google.com/workspace/drive/api/guides/limits), [agendamento Vercel](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
