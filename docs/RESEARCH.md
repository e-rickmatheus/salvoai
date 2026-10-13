# Investigação · REA e referência · 12/10/2026

## Disponibilidade observada neste ambiente

Pasta inicial vazia; catálogo de skills apresentado não contém REA; lista de ferramentas da sessão não expõe MCP REA. Node observado: v24.15.0 no Windows. Nenhuma investigação com ferramentas REA foi executada. Ausência na sessão não comprova ausência de instalação em todos os locais do computador.

## Documentação declarada pelo projeto REA

Fontes: [README](https://github.com/morluto/rea) e [instalação](https://github.com/morluto/rea/blob/main/docs/installation.md). Consultadas nesta sessão; texto do branch main pode diferir do pacote npm publicado.

O projeto descreve registro MCP e instalação de instruções com `npx rea-agents setup`, suporte ao cliente codex e reinício/reconexão após mudanças. Node 22 >=22.19, 24 >=24.11 ou 26+; Node observado satisfaz o ramo 24. Para websites descreve navegador da família Chrome; não precisamos dos engines nativos Hopper/Ghidra/IDA para este caso. Suporte Windows varia por engine e recurso; não presumir suporte universal.

Configuração a realizar em uma etapa própria:

```powershell
npm.cmd view rea-agents dist-tags.latest
npx.cmd rea-agents@latest doctor --client codex --json
npx.cmd rea-agents@latest setup --client codex --dry-run --json
```

Revisar os caminhos e mudanças exatos antes de aplicar o plano ao perfil do usuário; usar a versão publicada verificada, reiniciar/reconectar o Codex e confirmar ferramentas reais disponíveis. Estes comandos estão documentados, **não foram executados**. Nenhuma configuração global foi alterada e não foi instalado REA. Ler a documentação ou instalar só a skill não constitui conexão MCP.

## Salve: observação limitada à página pública

Fonte: [umsalve.com](https://umsalve.com). Página pública consultada por ferramenta web, sem login. O fornecedor apresenta organização de posts/links e capacidades de IA na comunicação pública. Isso é declaração de produto, não validação do backend. Não fizemos teste em conta autenticada, inspeção de endpoints ou comprovação de tecnologias internas.

Clerk, Convex, Apify, Gemini, OpenAI, RevenueCat e PostHog são contexto trazido pelo briefing, **não confirmado nesta sessão**. Nenhum deles foi adotado. Nenhum texto, marca ou ativo foi reutilizado. A arquitetura local deriva dos requisitos do SALVOAI e das ferramentas disponíveis, não de dedução do servidor do Salve.

## Migração: fontes oficiais e limites

Meta: [Download Your Information na Central de Contas](https://about.fb.com/news/2023/10/manage-your-information-across-apps/) descreve acesso/baixar informações de Facebook e Instagram. O conteúdo da [ajuda Instagram](https://help.instagram.com/181231772500920) não foi recuperado pela ferramenta nesta sessão. A notícia oficial não garante quais links salvos existirão no arquivo específico da conta; é necessário examinar o ZIP/JSON real e as categorias disponíveis antes de implementar adaptador. Não confundir publicações próprias, curtidas e salvos.

TikTok: [Data Portability API](https://developers.tiktok.com/docs/en/data-portability-api-get-started) foi consultada como fonte oficial para a integração futura. Há requisitos de elegibilidade, aplicação e aprovação; não assumir disponibilidade para conta brasileira. A [ajuda de solicitação de dados](https://support.tiktok.com/en/account-and-privacy/personalized-ads-and-data/requesting-your-data) não foi recuperada nesta sessão. Não há prova aqui de exportação completa de favoritos. Favoritos, curtidas e histórico deverão ser reconhecidos separadamente por schema real.

Primeira versão usa links por linha. Futuro adaptador: identificar versão e categoria do arquivo, validar schema, mapear apenas links realmente presentes, apresentar prévia e relatório de duplicatas/erros, preservar proveniência. Não automatizar contas nem pedir senhas.

## Hipóteses a validar

Metadados de redes sociais podem exigir autorização ou não estar disponíveis; um link salvo não garante player nem cópia de mídia. IA pode gerar custo por uso; fornecedor e valores ainda não foram escolhidos. Apenas observar frontend não permite concluir arquitetura inteira. Nenhuma dessas hipóteses habilita serviços ou conta como resultado real.
