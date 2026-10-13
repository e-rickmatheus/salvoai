# Verificações realizadas · 12/10/2026

Windows, Node v24.15.0. `npm.cmd test`: **4 testes passaram, 0 falhas**.

1. URLs HTTP/HTTPS, recusa de credenciais/protocolos inválidos, lote com erros individuais, duplicatas normalizadas e preservação de parâmetros/fragmentos.
2. Banco em arquivo encerrado e reaberto mantendo notas, favoritos e múltiplas coleções/etiquetas; busca em título, descrição, notas e etiquetas sem distinção de acentos; cinco filtros combinados.
3. Exportação versão 1, restauração em outro banco, repetição sem duplicação, preservação de correções e recusa atômica de arquivo com item inválido.
4. API HTTP: assets, adição, edição, exportação, importação, exclusão, rejeição de Host externo, Origin externa e mutação sem JSON.

Também executados `node --check server.js` e `node --check public/app.js`.

## Navegador

QA em `http://127.0.0.1:3211`, banco **data/demo-qa.sqlite**, separado do acervo real **data/salvoai.sqlite**.

- Lote com um example.com de demonstração, uma duplicata e um texto inválido mostrou os três estados individuais.
- Detalhe editado e salvo com título DEMONSTRAÇÃO, autor, duas coleções, duas etiquetas, notas e favorito.
- Busca `composicao` encontrou `composição` nas notas; coleção Design e etiqueta tipografia combinadas mantiveram o resultado.
- Cartões e lista renderizaram o item. Viewport 390 × 844 mostrou navegação e filtros em layout móvel; largura medida do conteúdo 375 px, sem overflow horizontal.
- Nenhum erro de console observado.
- Captura desktop: [demonstração](screenshots/demo-desktop.png).

Não houve teste em celular físico nem autenticação multiusuário. Importação/exportação e persistência foram verificadas pelos testes de API/armazenamento; seletor de arquivo e download no navegador ainda não foram automatizados. Não afirmar esses testes específicos como realizados.

O runner original tentou criar um subprocesso bloqueado pelo sandbox Windows (EPERM); a configuração `--test-isolation=none` resolveu sem elevar permissões. O teste Host usa cliente `node:http` porque fetch reescrevia o cabeçalho; a proteção do servidor passou no teste direto.
