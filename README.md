# SALVOAI

Aplicativo de conteúdos salvos com versão local (SQLite e IA no computador) e integração online (PostgreSQL e contas Supabase). Requer **Node.js 24**, preferencialmente 24.15 ou superior. O `node:sqlite` nativo fornece SQLite na versão local.

## Publicar online

Veja [configuração na Vercel, banco e plano de migração](docs/CLOUD.md). O banco usa PostgreSQL padrão, a estrutura SQL está no repositório e há uma ferramenta de backup completo para trocar de fornecedor. Na versão online, cada conta acessa apenas o próprio acervo. Recursos de IA local continuam disponíveis na instalação do computador.

## Abrir no Windows

No PowerShell:

```powershell
Set-Location -LiteralPath 'D:\ESTUDOS\Projetos Vibe Coding\SALVOAI'
npm.cmd start
```

Em um clone novo, execute `npm.cmd ci` antes de iniciar. Abra **http://127.0.0.1:3210** no navegador. Mantenha o terminal aberto. Para encerrar, pressione `Ctrl+C`. Para reabrir, execute o mesmo comando.

Se a porta estiver ocupada, execute `$env:PORT='3212'` antes de iniciar e abra a nova porta. O arquivo `.env.example` documenta opções; esta versão lê variáveis do processo e **não carrega `.env` automaticamente**. Para alterar o banco: `$env:SALVOAI_DB='data/outro.sqlite'`. Remova a variável com `Remove-Item Env:SALVOAI_DB` para voltar ao acervo padrão.

## Testar o fluxo

1. Clique em Salvar links e cole um link HTTP/HTTPS completo. Não precisa haver extração de metadados para salvar.
2. Cole vários links, um por linha, incluindo um repetido e uma linha inválida. Cada linha recebe seu resultado. Linhas vazias são ignoradas.
3. Clique no título para editar origem, título, criador, descrição, tipo e notas. Adicione coleções e etiquetas pelo campo com sugestões e pressione Enter ou Adicionar. Cada nome aparece como uma seleção removível; vírgulas são permitidas no nome.
4. Associe duas coleções e duas etiquetas; marque favorito. Confira Caixa de entrada, Coleções e Favoritos.
5. Busque uma palavra das notas ou etiquetas. Abra Filtros e combine origem, criador, coleção, etiqueta e tipo. As seleções ativas aparecem como chips removíveis. Alterne cartões/lista e ordenação.
6. Pare e reinicie o servidor. Os itens devem continuar presentes.
7. Em Configurações, exporte JSON e importe o mesmo arquivo: deverá informar duplicatas e manter suas edições.
8. Para provar restauração em acervo vazio, encerre o servidor e inicie com `$env:SALVOAI_DB='data/restauracao-teste.sqlite'`. Importe o backup e confira os dados. Depois encerre, remova essa variável e inicie normalmente.

```powershell
npm.cmd test
```

Os testes usam bancos temporários separados: URLs, lote, persistência ao reabrir, notas e organização, busca real sem distinção de acentos, filtros combinados, exportação/importação idempotente e atômica, API, rejeição de origem/host externos e exclusão. A ausência de isolamento de processos no runner evita restrições de spawn do ambiente Windows; os testes ainda utilizam bancos independentes.

## Backup e restauração

**Backup portátil:** Configurações → Exportar. Copie o JSON para outro dispositivo ou disco. A exportação versão 1 contém todos os dados desta versão. Não inclui mídias: elas nunca são baixadas.

**Backup completo do SQLite:** encerre o servidor com Ctrl+C e copie a pasta `data` inteira. Nunca copie somente o `.sqlite` enquanto estiver em uso: pode haver transações nos arquivos `-wal` e `-shm`. Para restaurar, com servidor parado, preserve a pasta atual em outro local e coloque a cópia no caminho original. Reinicie e confira. JSON é a alternativa mais portável.

A importação valida o arquivo inteiro antes de alterar o banco e aplica uma transação. A mesma URL normalizada é ignorada se já existir; não sobrescreve correções. IDs são locais e novos IDs são atribuídos ao restaurar. Arquivos acima de 16 MB precisam ser divididos em documentos SALVOAI válidos; essa é uma proteção por requisição, sem cota total de itens. Backups contêm suas notas pessoais: cuide das cópias.

## Limites explícitos

- Servidor ligado somente a `127.0.0.1`, **sem autenticação externa**. Proteção de origem e Host não substitui login. Pessoas/processos com acesso ao seu computador podem acessar o acervo.
- Layout responsivo implementado; acesso físico pelo celular ainda depende da próxima etapa de autenticação + HTTPS e rede privada. Não mude para `0.0.0.0` nesta versão.
- Sem PWA, compartilhamento do sistema, extração de páginas, thumbnails remotos, players, download de vídeos, resumos, transcrições, OCR ou IA. Campos informam isso claramente. Não há resultados simulados.
- Duplicação conservadora: normaliza a URL com `URL`, mas preserva parâmetros, ordem e fragmento. URLs encurtadas e variações com rastreamento podem permanecer como itens distintos; não fazemos requisições para resolvê-las.
- Busca/filtros rodam no navegador sobre o acervo recebido do servidor. Sem paginação nesta versão; acervos muito grandes precisam de consulta paginada no servidor e índices de busca.
- Exclusão exige confirmação e é definitiva; backup permite recuperar.
- Coleções podem ser criadas e associadas a vários itens. Renomear/excluir coleções ainda é uma evolução.
- Custos atuais: disco local e computador. Nenhuma cobrança de fornecedor. IA futura precisa de seleção de tarefas, orçamento e aprovação antes de contratação.

Veja [briefing](docs/BRIEFING.md), [arquitetura](docs/ARCHITECTURE.md), [plano](docs/PLAN.md), [esboço](docs/DESIGN.md) e [investigação com fontes](docs/RESEARCH.md).

## Interface refinada

Busca em destaque, filtros em painel (inferior no celular), cartões textuais compactos e seleção explícita de Cartões/Lista. Coleções e etiquetas usam sugestões nativas e seleções removíveis. Detalhe lateral em telas largas, com estado do processamento recolhido e confirmação antes de descartar alterações. Ícones Lucide locais, com licença em public/icons/LICENSE; sem chamadas de CDN, sem framework novo nem dependência npm. Transições respeitam movimento reduzido.

## Modelos de interface

A versão anterior foi preservada como Modelo 1 em http://127.0.0.1:3210/modelo-1. Modelo 2 abre em http://127.0.0.1:3210/modelo-2 e na raiz. Ambos usam o mesmo acervo; detalhes em docs/modelos/README.md.

O Modelo 2 revisado usa navegação superior e oferece a visualização Por etiqueta (agrupamento manual pela primeira etiqueta). Os sete links de receitas enviados pelo usuário estão no banco real, visíveis em ambos os modelos; não são dados de demonstração. Vídeos permanecem como links, sem cópia da mídia.

## Revisão TECH e IA local

O Modelo 2 tem capas, categorias em níveis, ícones personalizados e filtros entre fontes. Processamento local: Gemma 3 1B, EmbeddingGemma, Whisper e RapidOCR. Recursos, verificação, instalação e limitações estão em [docs/umsalve/README.md](docs/umsalve/README.md). Há dependências npm para MCP, validação e leitura de entidades HTML; os ícones são servidos localmente. Modelo 1 permanece como snapshot.
