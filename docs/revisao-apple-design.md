# Revisão Apple Design — SALVOAI

Revisão implementada em 12/10/2026, priorizando o celular. Web app pessoal com banco e processamento locais. Posteriormente, o usuário aprovou sua lista revisada: 81 subcategorias foram cadastradas, mantendo as sete anteriores. Consulte `subcategorias-propostas.md`.

## Diagnóstico e direção

A navegação ocupava grande parte do topo no celular. Havia metadados com letras muito pequenas, estados de hover herdados que deixavam o item ativo claro demais, painéis de aparência inconsistente e faixas de filtros competindo com as capas. A captura `umsalve/apple-antes.png` registra a biblioteca antes da revisão, em largura de desktop.

Direção: grafite, azul discreto, superfícies e bordas suaves, capas como principal elemento visual. Tipografia do sistema/Inter quando disponível, sem baixar fontes ou símbolos licenciados pela Apple. Letras regulares e semibold, raios e espaçamentos consistentes. Controles e conteúdo têm hierarquias distintas.

## Mudanças

- Navegação inferior fixa no celular, com seis destinos, rótulos curtos e nomes completos acessíveis. Cabeçalho compacto, ajustes e tema; margens para safe areas.
- Coleções e etiquetas rápidas ficam no desktop. No celular, continuam disponíveis em Filtros e na navegação, reduzindo a ocupação inicial.
- Cartões com títulos, fontes e etiquetas mais legíveis, ícones brancos, rodapés alinhados e ações com 44 px no celular. Capas reais preservadas.
- Categorias em duas colunas no celular, com cards recolhidos uniformes. Expansão usa a largura completa no celular; no desktop mantém a grade. Ícones editáveis e catálogo de 188 opções preservados.
- Coleções existentes aparecem antes do formulário de criação. Removido o atalho de criação de categoria dessa tela, pois há um destino próprio para categorias.
- Diálogos, campos, abas de leitura, chat e painéis recebem o mesmo sistema visual. Foco visível, reduced motion e contraste aumentado têm estilos próprios.
- Troca de destino retorna ao início da página. Os caminhos e dados existentes foram preservados.

## Arquivos principais

- `public/premium.css`: camada visual mobile first e adaptação ao desktop.
- `public/index.html`: inclusão da camada visual, safe area e cor do navegador.
- `public/app.js`: rótulos adaptados, navegação, ação principal e apresentação das coleções.
- `server.js`: entrega do CSS adicional.
- `test/app.test.js`: verificação de que o novo asset é servido.

## Verificação

Inspeção visual em 320×740, 390×844 e 1280×900. Página sem overflow horizontal nesses tamanhos. Em 320 px, os dois controles de filtro e a ordenação permanecem na mesma linha. Navegação inferior e 21 ações dos cartões, 27 controles ao todo, medidos com pelo menos 44 px de largura e altura no celular.

Verificados: abrir/fechar filtros, filtrar pela etiqueta maracujá (dois resultados), limpar filtros, busca textual, cartões/lista, leitura de detalhe, coleções, categorias recolhidas/expandidas e abertura do cadastro/banco de ícones. Foco de teclado visível ao passar da busca para Por tema. Não foram excluídos nem adicionados itens ou categorias no banco real durante a revisão.

Contraste calculado nos pares dos tokens usados para texto/superfície, secundário/superfície e texto/botão primário:

| Tema | Texto | Secundário | Primário |
| --- | ---: | ---: | ---: |
| Escuro | 15,98:1 | 8,20:1 | 11,03:1 |
| Claro | 15,13:1 | 5,96:1 | 11,12:1 |

13 testes de regressão passaram. Sintaxe JavaScript conferida. Isso não representa uma auditoria completa WCAG ou prova da qualidade das respostas de IA.

Capturas finais: `umsalve/apple-premium-mobile.png` e `umsalve/apple-premium-desktop.png`.

## Referências oficiais consultadas

As páginas requerem JavaScript; seu conteúdo foi lido no navegador após a extração web retornar somente esse aviso.

- [Typography](https://developer.apple.com/design/human-interface-guidelines/typography): legibilidade e hierarquia com poucas famílias e pesos consistentes.
- [Layout](https://developer.apple.com/design/human-interface-guidelines/layout): priorização, alinhamento, divulgação progressiva, adaptação e safe areas.
- [Color](https://developer.apple.com/design/human-interface-guidelines/color): cor com parcimônia, temas claro/escuro e significados consistentes.
- [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility): contraste, controles confortáveis, alternativas e foco do teclado.

## Limites

Verificação em navegador com viewport simulado, sem teste em aparelho físico, teclado virtual de iOS/Android ou leitor de tela real. Medidas nativas da Apple foram usadas como referência de qualidade e adaptadas à web. A revisão não muda o processamento de IA, disponibilidade das capas externas ou recursos nativos ainda ausentes.
