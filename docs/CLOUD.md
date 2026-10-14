# SALVOAI online: configuração e portabilidade

## Arquitetura

Vercel executa `api/index.js`, que exporta uma função HTTP padrão. `vercel.json` inclui os arquivos públicos e encaminha as rotas para essa entrada. O ambiente usa Node.js 24. O mesmo código de API atende a versão local com SQLite e a versão online com PostgreSQL; o contrato de armazenamento é `all`, `batch`, `update`, `remove`, coleções, categorias, importação e exportação.

O banco usa SQL PostgreSQL comum e JSONB. A estrutura está em `db/schema.sql`; as tabelas têm prefixo `salvoai_`. Nenhuma extensão exclusiva do Supabase é usada. O acervo não usa o SDK, Realtime, Storage ou as funções do Supabase. Capas ficam no banco e acompanham o backup. Cada registro pertence ao ID da conta autenticada, obtido do serviço de autenticação no servidor, nunca de um campo enviado pelo navegador.

Supabase Auth é a única integração específica do fornecedor, concentrada em `lib/cloud-auth.js`. O navegador conversa apenas com o servidor SALVOAI. Sessões usam cookies HttpOnly, Secure e SameSite=Lax. Não se guardam senhas em tabelas do app. RLS está habilitado sem políticas públicas: os papéis públicos do Supabase não acessam as tabelas; o servidor usa sua conexão PostgreSQL privada e filtra sempre pelo dono.

Cada requisição ao banco usa uma transação e um bloqueio por conta. Importações ou alterações que falham são revertidas. Uma resposta de sucesso só é enviada após o commit. Essa estratégia prioriza consistência no acervo pessoal; para tráfego elevado, deve ser substituída por operações mais granulares e paginação. Não há promessa de capacidade para dezenas de milhares de usuários simultâneos.

## Configurar Supabase e Vercel

1. Crie o projeto Supabase no plano Free. Nenhum upgrade é necessário para esta integração.
2. No Supabase, em Connect → Direct → Transaction pooler, copie a URI com porta 6543. Substitua `[YOUR-PASSWORD]` pela senha do banco. Caracteres especiais na senha precisam de codificação URI. Acrescente `?sslmode=verify-full` para conexão criptografada com verificação do certificado. Use a URI do pooler, sem instalar IPv4 pago.
3. Em Vercel → projeto salvoai → Settings → Environment Variables, configure **Production**:

| Variável | Valor |
| --- | --- |
| `SALVOAI_PUBLIC_URL` | `https://salvoai-ebon.vercel.app` |
| `DATABASE_URL` | URI PostgreSQL privada, como variável Secret |
| `SUPABASE_URL` | `https://lworwtnkrqqyrfjaboxs.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publishable do painel Supabase; `SUPABASE_ANON_KEY` também é aceita |

A chave publishable não é a senha nem a chave service_role. Nunca coloque DATABASE_URL ou chaves privadas no Git, em URLs públicas ou no código do navegador. Alterou a senha do banco? Atualize DATABASE_URL e faça novo deployment.

4. Em Supabase → Authentication → URL Configuration, defina Site URL como o domínio de produção e adicione `https://salvoai-ebon.vercel.app/auth/callback` aos Redirect URLs.
5. Mantenha confirmação de e-mail habilitada. O envio padrão do Supabase tem limites e restrições; para cadastros de outras pessoas, configure SMTP próprio ou um provedor de login. O limite de usuários incluídos no plano não equivale à cota de envio de e-mails. Não desative confirmação apenas para contornar essas restrições.
6. Publique o commit em main ou faça Redeploy após alterar variáveis. O servidor cria as tabelas na primeira requisição autenticada; `db/schema.sql` também pode ser aplicado previamente pelo SQL Editor.
7. Crie sua conta no SALVOAI, confirme o e-mail e entre. Salve um link, recarregue a página e confira a persistência. Teste uma segunda conta para conferir que os acervos estão separados.

Não conecte previews de branches de pessoas desconhecidas ao banco de produção. Esta configuração aceita apenas o domínio de produção; previews exigem endereço, autenticação e banco separados.

## Recursos disponíveis

Online: contas, links, edição, favoritos, ver depois, conclusão, coleções, categorias em níveis, filtros, busca por palavras, capas enviadas manualmente e backup JSON. Não há sincronização automática com o SQLite local. Os dados locais não são publicados sem ação do usuário: exporte pela instalação local e importe na sua conta online se desejar.

Ollama, Whisper, OCR e extração automática continuam na instalação local. A hospedagem não tenta conectar ao localhost da Vercel ou iniciar executáveis Windows. Esses controles ficam indisponíveis online. Uma integração de IA remota será uma etapa própria, com orçamento e provedor definidos.

Limites atuais na Vercel: arquivos JSON de até 4 MB por importação, resposta de até 4 MB, capas de até 2 MB enviadas pela interface. Backups maiores devem usar a ferramenta administrativa abaixo. O acervo completo ainda é carregado no navegador; para bibliotecas grandes, adicione paginação e busca no servidor. Capas no banco consomem a quota de armazenamento PostgreSQL; migração para armazenamento de objetos é uma evolução possível.

## Trocar o banco mantendo as contas

1. Suspenda gravações durante a cópia final. Faça backup e mantenha o banco antigo disponível até validar a mudança.
2. Defina a conexão de origem em um arquivo privado `.env.local`, ignorado pelo Git. Exporte todas as contas:

```powershell
node --env-file=.env.local scripts/cloud-backup.mjs export data/backups/cloud.json
```

3. Troque a variável privada para a conexão do novo PostgreSQL e importe em um destino vazio antes de direcionar o aplicativo a ele:

```powershell
node --env-file=.env.local scripts/cloud-backup.mjs import data/backups/cloud.json
```

A ferramenta preserva IDs dos itens, IDs dos donos, categorias, ícones, preferências, capas e textos. Ela recusa sobrescrever um destino com dados e restaura tudo em uma transação. O arquivo administrativo contém dados de todas as contas: mantenha-o privado. PostgreSQL `pg_dump`/`pg_restore` também são alternativas convencionais.

4. Atualize DATABASE_URL na Vercel, publique novamente e valide leitura, escrita, backups e isolamento em duas contas. O login pode continuar no Supabase com o banco de conteúdo em outro fornecedor.

## Trocar também a autenticação

Migrar conteúdo não migra automaticamente as contas do Supabase Auth. Antes de remover o provedor antigo, exporte as contas de acordo com a documentação do provedor e verifique a compatibilidade dos hashes de senha com o destino. Se não houver compatibilidade, será necessário um fluxo seguro de redefinição de senha. Não existe garantia de portabilidade automática de senhas.

Implemente o novo adaptador em `lib/cloud-auth.js`, preservando o contrato de usuário validado e sessão. Preserve os IDs antigos das contas quando o destino permitir. Se os IDs mudarem, prepare um mapa validado `ID antigo → ID novo` e atualize a coluna `owner` nas cinco tabelas em uma transação, antes de permitir acessos. Não remapeie contas apenas por um e-mail fornecido pelo navegador. Rode os testes de isolamento e a validação em duas contas antes de desligar o serviço antigo.

## Verificação

`npm test` verifica a versão local e a integração PostgreSQL usando um motor PostgreSQL real embarcado para testes (PGlite): persistência entre requisições, contas separadas, rollback de importações, bloqueio de origem externa, login obrigatório, cookies seguros e resposta após confirmação da gravação. A validação em produção ainda exige as variáveis privadas e uma conta real.

Referências oficiais: [Vercel Node.js](https://vercel.com/docs/functions/runtimes/node-js), [Supabase PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase Auth](https://supabase.com/docs/guides/auth/passwords), [Preços Supabase](https://supabase.com/pricing).
