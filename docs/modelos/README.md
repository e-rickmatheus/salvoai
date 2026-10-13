# Modelos de interface SALVOAI

## Acesso

Com `npm.cmd start`:

- Modelo 1: http://127.0.0.1:3210/modelo-1
- Modelo 2: http://127.0.0.1:3210/modelo-2
- A raiz http://127.0.0.1:3210 abre o Modelo 2.

O Modelo 2 oferece um seletor no topo para abrir o Modelo 1. Para voltar, use o botão Voltar do navegador ou a URL do Modelo 2. São **duas interfaces do mesmo acervo**: salvar, editar e excluir em uma delas aparece na outra. Não houve cópia ou migração do banco real.

## Preservação do Modelo 1

Snapshot dos arquivos index.html, app.js e styles.css em `public/models/modelo-1/`, com hashes SHA-256 em snapshot.json. Os arquivos permanecem iguais à versão aprovada antes deste pedido. O servidor adapta os caminhos dos assets e o título da aba ao servi-los na rota Modelo 1; não modifica o snapshot. Ícones, API e busca são recursos comuns.

Modelo 2 fica em `public/index.html`, `public/app.js` e `public/styles.css`. O CSS usa a base preservada e uma camada própria de tokens/estilos. Nenhuma dependência npm nova, fonte Apple incorporada, asset Apple ou serviço externo.

## Apple-Design: pesquisa e decisões

Produto web pessoal para guardar e reencontrar links, executado no Windows. Princípios Apple adaptados à web, sem prometer componentes nativos ou reprodução exata de Liquid Glass.

Fontes oficiais consultadas em 12/10/2026:

- [Typography](https://developer.apple.com/design/human-interface-guidelines/typography): hierarquia consistente, fontes legíveis e pesos moderados. Modelo 2 usa fontes do sistema, título destacado, metadados secundários e tamanhos relativos; não baixa San Francisco.
- [Materials](https://developer.apple.com/design/human-interface-guidelines/materials): diferenciar camada funcional de conteúdo e usar materiais com moderação. Transparência suave restrita à navegação/barra de ferramentas; cartões e formulários mantêm fundos opacos. Há fallback sólido e regra para preferência de transparência reduzida.
- [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility): contraste, controles confortáveis, mais de uma pista para estados e acesso por teclado. Mantidos rótulos, aria-current/pressed, dialog nativo HTML e confirmações internas. Movimento reduzido respeitado, e cores de contraste elevado/forced-colors consideradas no CSS.

A ferramenta web retornou somente a exigência de JavaScript para as HIG; o conteúdo foi então lido renderizado no navegador oficial. Não foi necessário obter recursos Apple licenciados. Medidas nativas em pt não são apresentadas como equivalentes automáticos a pixels web.

## Achados e mudanças

Baseline capturado antes da alteração: [Modelo 1](modelo-1-baseline.png). Biblioteca vazia visualmente clara, com pouca hierarquia entre ferramentas e conteúdo. Navegação sem contagens ou acesso direto às coleções. Esses foram os focos da segunda direção.

Modelo 2 revisado: navegação superior, conteúdo em largura ampla, captura de links integrada à biblioteca vazia, coleções em faixa horizontal e etiquetas com contagens. Há visualizações Cartões, Lista e Por etiqueta. A última agrupa pela primeira etiqueta de cada item, uma organização manual, sem detecção semântica de similaridade. O verde original, fontes de sistema e ícones Lucide foram mantidos. Modelo 1 permanece preservado.

## Verificação

`npm.cmd test`: 5 testes passaram, incluindo API das duas rotas e integridade do snapshot do Modelo 1. `node --check public/app.js` passou. A suíte também cobre persistência, busca, deduplicação, importação/exportação e proteção das rotas.

No banco separado de demonstração: acesso rápido à coleção, filtro combinado com etiqueta e busca nas notas, lista/cartões, detalhe editável, Escape com confirmação interna e manutenção do rascunho ao continuar editando, lote com duplicata e URL inválida. Nenhum item novo foi acrescentado ao acervo real.

Capturas do Modelo 2 inspecionadas: [desktop](modelo-2-desktop.png), [móvel](modelo-2-mobile.png). Viewports efetivamente medidos de 1280 px e 390 px; sem transbordamento horizontal. Navegação inferior para Coleções e retorno à Biblioteca conferidos. Filtros abriram e fecharam no viewport móvel.

Contrastes calculados das combinações principais: texto secundário/fundo 5,69:1; verde/branco 9,42:1; texto do sidebar/fundo 5,77:1; legenda/branco 5,92:1. Estes cálculos não certificam a aplicação inteira.

Não houve teste em celular físico, leitor de tela ou certificação WCAG completa. Ampliação de texto e todas as preferências de contraste/transparência ainda precisam de auditoria dedicada. Layout responsivo não libera o acesso pela rede; autenticação continua sendo uma etapa futura.

## Revisão da composição e conteúdos enviados

Após o usuário apontar pouca diferença entre os modelos, a composição do Modelo 2 foi refeita. A estrutura lateral foi removida; a navegação passou para o topo; o primeiro conteúdo pode ser salvo direto no estado vazio; a biblioteca ganhou largura e faixas de coleções/etiquetas. O CSS anterior foi substituído por uma camada nova sobre a base preservada.

Em seguida, os sete links enviados pelo usuário foram salvos no acervo real compartilhado. Não são os itens fictícios usados no QA. URLs e parâmetros xstg, q, t e img_index foram preservados. Coleções: Receitas e Brigadeiros. Etiquetas principais: clássico (2), maracujá (2), técnica (1), a conferir (2).

Metadados foram preenchidos manualmente após consulta às páginas públicas: TudoGostoso; Como fazer um brigadeiro perfeito / Patrícia Goedert Oficial; Brigadeiro / Receitas Nestlé; duas publicações de @pablofigueiredoc com brigadeiro de maracujá. Os dois TikToks não puderam ser conferidos; perfil/tipo vieram dos caminhos das URLs, com limitação explícita nas notas. A consulta da busca por maracujá na URL não foi tratada como prova do conteúdo do post.

Não houve download de vídeos, player incorporado, transcrição, resumo de IA ou comparação automática de ingredientes. Os registros continuam armazenando links e metadados manuais.

Verificação adicional: captura integrada com link válido e linha inválida em data/modelo2-revisao-qa.sqlite; edição de título, coleções, etiquetas e notas; busca nas notas; faixa de coleções; modo Por etiqueta com os sete itens reais e grupos 2/2/2/1; etiqueta maracujá exibindo dois registros distintos; mesmo conjunto no Modelo 1; filtros móveis. A navegação móvel foi ajustada após detectar rótulos apertados. Os testes de API/persistência e de integridade do Modelo 1 continuaram passando.

Capturas atuais: modelo-1-receitas.png, modelo-2-receitas.png e modelo-2-por-etiqueta.png. Capturas anteriores nesta pasta são histórico da primeira direção, não o resultado desta revisão.
