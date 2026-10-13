// Lista aprovada pelo usuário em 12/10/2026. Aplicada uma vez por banco.
const groups={
  'Comida':[['Café da manhã','coffee'],['Refeições rápidas','timer']],
  'Inteligência Artificial':[['Automações','wand-sparkles'],['Agentes','bot'],['Imagens e vídeos','video'],['Áudio e voz','mic']],
  'Jogos':[['RPG','swords'],['Estratégia','crown'],['Ação e aventura','compass'],['Simulação','gamepad-2'],['Dicas e builds','wrench']],
  'Beleza':[['Skincare','droplets'],['Maquiagem','brush'],['Cabelos','scissors'],['Cuidados pessoais','heart'],['Skin Food','leaf']],
  'Carreira e estudos':[['Cursos','graduation-cap'],['Concursos','notebook-pen'],['Idiomas','languages'],['Produtividade','timer'],['Carreira','briefcase-business']],
  'Casa e decoração':[['Organização','folders'],['Decoração','sofa'],['Dicas de Limpeza','sparkles'],['Jardinagem','sprout'],['Produtos','shopping-bag']],
  'Dicas':[['Dia a dia','sun'],['Tutoriais','book-open'],['Truques','wand-sparkles'],['Soluções práticas','wrench']],
  'Filmes e séries':[['Filmes','film'],['Séries','clapperboard'],['Documentários','camera'],['Animes','sparkles'],['Para assistir','bookmark']],
  'Finanças':[['Organização financeira','wallet'],['Investimentos','chart-no-axes-combined'],['Economia','piggy-bank'],['Renda extra','coins']],
  'Humor':[['Memes','smile'],['Esquetes','clapperboard'],['Stand-up','mic'],['Situações engraçadas','messages-square']],
  'Livro':[['Ficção','book-open'],['Não ficção','book-marked'],['Desenvolvimento pessoal','sprout'],['Para ler','bookmark']],
  'Lugar':[['Viagens','plane'],['Natureza','trees'],['Passeios','footprints'],['Hospedagem','hotel'],['Pontos Turisticos','map-pin']],
  'Moda':[['Looks','shirt'],['Roupas','shirt'],['Calçados','footprints'],['Acessórios','glasses'],['Dicas','lightbulb']],
  'Música':[['Playlists','music'],['Artistas','mic'],['Instrumentos','guitar'],['Produção musical','headphones']],
  'Outros':[['Referências','book-marked'],['Inspirações','lightbulb'],['Para revisar','bookmark']],
  'Produto':[['Lista de desejos','heart'],['Avaliações','star'],['Comparativos','scale'],['Ofertas','tag']],
  'Restaurante':[['Cafés','coffee'],['Bares','beer'],['Restaurantes','store'],['Para conhecer','map-pin']],
  'Tech':[['Aplicativos','smartphone'],['Hardware','cpu'],['Programação','code-xml'],['Segurança digital','shield']],
  'Treino':[['Musculação','dumbbell'],['Em casa','house'],['Corrida','footprints'],['Mobilidade','accessibility'],['Cardio','heart-pulse']]
};
export const approvedCategories=Object.fromEntries(Object.entries(groups).flatMap(([parent,children])=>children.map(([name,icon])=>[parent+'/'+name,icon])));
