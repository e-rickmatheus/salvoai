# SALVOAI: acervo visual e organização por tema

Referência inspecionada no navegador em 12/10/2026, na conta que o usuário abriu. A análise foi de comportamento e UI; REA foi consultado como referência, mas não instalado nem conectado. Não houve inspeção de binários ou acesso ao backend privado do umsalve.

## Auditoria da referência

1. Grade de salvos: capas grandes permitem reconhecimento visual rápido; título e origem complementam a imagem. Conferida com seis conteúdos de temas diferentes. Evidência: `05-novos-salvos.png`.
2. Detalhe: abrir original, nota e abas Resumo, Legenda, Transcrição e Texto na tela. O conteúdo visual completo exibiu bloqueio Pro; não foi acessado. Evidências: `02-detalhe.png`, `04-texto-visual.png`.
3. Ações do item: conclusão, Ver depois, pasta, copiar link, copiar Markdown e exclusão. O menu foi observado, sem modificar ou excluir os itens. Evidência: `03-acoes.png`.
4. Categorias: receitas corretamente identificadas; um jogo classificado como Produto, um aplicativo como Dica e um conteúdo em Outro. O usuário enviou a imagem do catálogo e confirmou o comportamento. Isso fundamenta a classificação editável e a categoria Jogos no SALVOAI.

Focos de melhoria: categorias próprias em níveis, correção manual preservada, filtros entre fontes e reconhecimento por capa. A auditoria não certifica acessibilidade: houve inspeção visual/DOM, sem leitor de tela ou teste em celular físico. O processamento dos itens e a precisão de todos os resultados do umsalve não foram auditados.

## Fontes públicas e limites da comparação

- [Salve](https://umsalve.com/pt): anuncia resumo, transcrição, texto nas imagens, busca, chat, pastas e extensão.
- [Privacidade](https://umsalve.com/pt/privacy): identifica Google Gemini e OpenAI, Convex, Apify, Clerk e processamento temporário de mídia. Não especifica modelos ou versões da IA.
- [MCP](https://umsalve.com/pt/mcp): conector de leitura, exclusivo Pro no produto original.
- [REA](https://github.com/morluto/rea): ferramentas de investigação e evidências; sua instalação registra MCP e instruções e exige reiniciar o agente. O navegador já permitiu observar os fluxos necessários.

Não é uma cópia do serviço ou desbloqueio da assinatura do umsalve. SALVOAI implementa seus próprios recursos pessoais, sem cotas de assinatura. Plataformas podem limitar o acesso público; o processamento local não garante acesso a todo post.

## Implementado

- Modelo 2 com tema escuro/claro, navegação lateral, capas reais, cartões/lista/grupos por etiqueta. Modelo 1 preservado por hashes, conectado ao mesmo banco.
- Categorias e subcategorias por caminho, filtros que incluem descendentes, Jogos, categorias da referência e catálogo de 188 ícones Lucide locais. Coleções independentes permitem sobrepor assuntos e projetos.
- Palavra-chave em títulos, descrições, notas, etiquetas, legendas, resumos, transcrições e texto visual. Busca Por tema com EmbeddingGemma, ordenada por significado.
- Metadados públicos e capas armazenadas localmente, com upload manual de capa. Receita publicada em JSON-LD separa ingredientes e preparo sem inventar esses campos.
- Favoritos, Ver depois, conclusão, notas, edição, relacionados por etiquetas/categoria, cópia de Markdown e backup JSON com campos derivados e ícones.
- Fila local de processamento, metadados, transcrição Whisper, OCR em capa ou duas amostras do vídeo, resumo e sugestão de categoria. A classificação é híbrida: temas explícitos nos metadados usam regras; a IA sugere os casos restantes. A origem da sugestão fica registrada. Outros quando não houver categoria válida. Categorias já atribuídas são preservadas; alterações manuais ficam identificadas no banco.
- Consulta ao acervo com Qwen 2.5 3B quando instalado, Gemma como alternativa e fontes clicáveis. Recuperação semântica quando disponível, palavras como alternativa. Respostas podem conter erros e são exibidas como texto. O teste composto sobre ingredientes encontrou as duas fontes corretas, mas apresentou afirmações inconsistentes; a qualidade do chat ainda precisa de ajustes.
- Conector MCP local por stdio: buscar, listar salvos, ler um item e listar coleções/categorias. Testado com cliente SDK em banco separado. Ainda não registrado em um cliente do usuário.

## IA local e instalação

Neste computador, runtimes, modelos e ambiente Python ficam em `data/`, ignorados pelo Git. Ollama v0.40.3 portátil foi obtido da release oficial. Gemma 3 4B foi baixado, mas a leitura visual ficou lenta no hardware disponível. O perfil padrão usa **Gemma 3 1B para texto**, **EmbeddingGemma para busca**, **Whisper base int8 para áudio** e **RapidOCR para texto visual**. O 4B continua disponível para experimentação futura.

Fontes: [Ollama Windows](https://docs.ollama.com/windows), [Gemma](https://ollama.com/library/gemma3), [EmbeddingGemma](https://ollama.com/library/embeddinggemma), [faster-whisper](https://github.com/SYSTRAN/faster-whisper), [yt-dlp](https://github.com/yt-dlp/yt-dlp), [RapidOCR](https://github.com/RapidAI/RapidOCR).

Ollama fica em `127.0.0.1:11434`, sem cloud habilitada neste lançamento. Executar na pasta do projeto:

```powershell
./scripts/start-local-ai.ps1
npm.cmd start
```

Dependências Python: `scripts/requirements-ai.txt`, ambiente `data/runtime/python`. FFmpeg e Node são utilizados pelo extrator. O primeiro processamento de áudio pode baixar o modelo Whisper. Vídeos públicos são temporários e removidos ao concluir ou falhar; nesta versão, o worker limita a 20 minutos e 100 MB. Não usa cookies de contas nem supera bloqueios da fonte.

Os conteúdos públicos e seus provedores são consultados pela rede. Inferência ocorre localmente. OCR amostra imagens, não lê todos os frames; reconhecimento pode perder acentos e texto pequeno. A descrição visual completa do vídeo não é equivalente à implementação do umsalve.

## Conector local preparado

```json
{"command":"node","args":["D:/ESTUDOS/Projetos Vibe Coding/SALVOAI/scripts/mcp-server.js"]}
```

Cliente externo ainda precisa ser configurado pelo usuário. O conector não escreve, exclui ou compartilha itens. Seu cliente de IA pode tratar os resultados conforme as próprias configurações.

## Recursos que ainda não são equivalentes completos

Aplicativo nativo e compartilhamento iOS/Android, extensão instalada nos posts, sincronização entre dispositivos, contas/pastas compartilhadas e histórico persistente de chat não foram implementados. Exigem etapas próprias de produto e autenticação. A interface atual não mostra botões que simulem essas funções.

## Conteúdos e verificação

Os sete links enviados estão no banco real, em Comida/Sobremesas, coleções Receitas e Brigadeiros. Cinco capas foram obtidas: dois YouTubes, dois Instagrams e TudoGostoso. Dois TikToks falharam por indisponibilidade pública e permanecem a conferir. Os exemplos adicionados ao umsalve foram apenas inspecionados, sem importação automática ao SALVOAI.

Backup antes da revisão: `data/backups/antes-tech-e-ia.json`. Banco QA separado: `data/tech-qa.sqlite`. Testes verificam categorias em níveis, ícones, busca em textos derivados, backup, invalidação após alterar URL, coleta pública protegida, parser de receita, API, MCP e integridade do Modelo 1.

Verificação de execução: receita JSON-LD e OCR no TudoGostoso; transcrição real do vídeo da Nestlé; resumos locais nos dois itens; busca semântica com EmbeddingGemma e resposta do chat com fontes. O modelo 1B é limitado e respondeu de forma incompleta em consultas compostas; não foi estabelecida equivalência de qualidade com Gemini/OpenAI. A seleção de fontes foi ajustada para usar também os temas explícitos nos títulos e etiquetas.

## Revisão do Modelo 2 — fontes e categorias

Fontes usam ícones oficiais brancos de Instagram, TikTok, Facebook e YouTube, com globo para Site. Categoria e subcategoria ocupam uma ou duas etiquetas no canto superior esquerdo da capa. A navegação contém apenas o acesso Categorias; a lista, a busca, as subcategorias e o banco de ícones aparecem na tela principal. Verificados layout desktop e celular, abertura do cadastro e filtro por categoria. Modelo 1 permanece preservado.
