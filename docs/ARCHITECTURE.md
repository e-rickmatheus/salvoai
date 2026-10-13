# Arquitetura inicial

## Decisão

Node.js 24.15 + módulos ES nativos + SQLite + HTML/CSS/JavaScript. Sem build, compilador, serviço externo ou dependência npm. Node instalado e SQLite nativo verificados no Windows. Uma aplicação/um processo, fácil de executar e mover. `DatabaseSync` é adequado à carga pessoal inicial; bloqueia o event loop em consultas, o que exige revisão com carga maior.

Interface (`public/`) → API HTTP (`server.js`) → importação/validação e armazenamento (`lib/store.js`) → SQLite (`data/`). Busca reutilizável (`lib/query.js`) testada separadamente. Não há acesso direto ao banco pelo frontend.

## Dados

Tabela items: UUID local, owner, URL canônica, documento JSON validado. Restrição UNIQUE(owner, canonical) garante deduplicação no banco. Tabela collections: owner + nome, incluindo coleções vazias. Etiquetas e associações são arrays muitos-para-muitos no documento; uma futura migração pode normalizar as associações. Schema SQLite user_version=1, exportação format=salvoai/version=1.

Campos: originalUrl, canonicalUrl, savedAt, title, author, platform, description, type, notes, favorite, collections, tags. Nesta versão os campos editáveis são exclusivamente manuais. `automatic` será reservado a resultados automáticos; nunca substituir o manual silenciosamente. `structured` reservará schema tipado para futuros conteúdos específicos. Esses dois campos permanecem vazios nesta versão; o importador não aceita resultados arbitrários como processamento executável. Novas versões deverão migrar e validar seus esquemas antes de exportar derivados reais.

`processing` contém status not_configured, stored link, summary null, transcript null. Não indica uma tentativa inexistente como sucesso. Futuro modelo: job com owner/item, tipo, estado, tentativas, versão do provedor/modelo, custos, proveniência e resultados. Adapters independentes para extração/transcrição/OCR/IA. Receitas específicas estão fora desta entrega.

## Segurança

Loopback fixo; validação Host/Origin; JSON nas mutações; CSP sem inline scripts; escape de todos os campos importados na UI; somente HTTP/HTTPS sem credenciais; sem requests de extração nem download de mídias, portanto sem superfície SSRF de extração nesta versão. Importação validada, transacional, sem execução de conteúdo. Limite de 16 MB por requisição e 100 mil caracteres por campo para conter abuso/memória, sem cota total de itens.

Local owner é identidade fixa, **não login nem isolamento multiusuário implementado**. Antes de rede: autenticação, sessões protegidas, CSRF adequado, proprietário obtido da sessão em toda query, testes de autorização e restauração isolada. Não confiar em owner do JSON.

Antes de extração: validar DNS/IP públicos (IPv4/IPv6), bloquear loopback, redes privadas/link-local/reservadas, fixar conexão ao destino validado para evitar rebinding, revalidar cada redirecionamento, limitar redirecionamentos, tempo e bytes. Conteúdo remoto é dado não confiável; pipeline de IA não pode autorizar ferramentas nem ler segredos.

## Portabilidade, acesso móvel e escala

Servidor local hoje; banco proprietário do usuário. Exportação estruturada independente de fornecedor. Futuro acesso móvel por servidor privado com autenticação e HTTPS, sem depender de ferramenta paga específica. PWA será avaliada depois, incluindo comportamento por navegador/OS e restrições de compartilhamento. Não há promessa de compartilhamento universal.

Sem cotas comerciais; limites práticos são armazenamento, memória, payload e processamento. Futuro SQLite FTS/consulta paginada para grandes acervos, seleção explícita de processamento e relatório de custos antes de IA. Não transformar em microsserviços.
