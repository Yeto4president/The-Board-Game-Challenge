let gameOfMonthData = null;
let currentGameId = null;

// Fonction pour rafraîchir le token
async function refreshToken() {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Aucun token disponible.');
  }

  const response = await fetch('http://localhost:3000/api/refresh-token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Erreur lors du rafraîchissement du token.');
  }

  const data = await response.json();
  localStorage.setItem('token', data.token);
  return data.token;
}

// Fonction pour effectuer une requête avec gestion de l'expiration du token
async function fetchWithToken(url, options = {}) {
  let token = localStorage.getItem('token');
  if (!token) {
    return fetch(url, options); // Pas de token, requête publique
  }

  options.headers = options.headers || {};
  if (!options.body || !(options.body instanceof FormData)) {
    options.headers['Authorization'] = `Bearer ${token}`;
  } else {
    // FormData gère lui-même les headers pour multipart/form-data
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(url, options);

  // Vérifier si la réponse est OK avant de lire le corps
  if (!response.ok) {
    let errorBody;
    try {
      errorBody = await response.json(); // Tenter de lire comme JSON
    } catch (jsonError) {
      // Si ce n'est pas du JSON, lire comme texte
      errorBody = { message: await response.text() };
    }

    // Gestion des erreurs 401 (token expiré)
    if (response.status === 401 && errorBody.message === 'jwt expired') {
      try {
        token = await refreshToken();
        options.headers['Authorization'] = `Bearer ${token}`;
        response = await fetch(url, options); // Réessayer la requête
      } catch (error) {
        localStorage.removeItem('token');
        window.location.href = 'accounte.html'; // Rediriger vers la page de connexion
        return;
      }
    } else {
      const error = new Error(errorBody.message || `Erreur HTTP: ${response.status}`);
      error.response = errorBody;
      error.status = response.status;
      throw error;
    }
  }

  // Si la requête a réussi après réessai ou directement, lire le corps comme JSON
  return response.json();
}

async function fetchGameOfMonth() {
  try {
    const token = localStorage.getItem('token');
    let game;
    if (token) {
      const decoded = parseJwt(token);
      const idUtilisateur = decoded?.id;
      if (!idUtilisateur) {
        throw new Error('ID utilisateur non trouvé dans le token.');
      }
      try {
        game = await fetchWithToken(`http://localhost:3000/api/game-of-month/${idUtilisateur}`);
      } catch (error) {
        console.warn('Erreur avec l\'utilisateur connecté, utilisation de la version aléatoire:', error);
        const response = await fetch('http://localhost:3000/api/game-of-month/random');
        if (!response.ok) throw new Error('Erreur lors de la récupération du jeu du mois');
        game = await response.json();
      }
    } else {
      const response = await fetch('http://localhost:3000/api/game-of-month/random');
      if (!response.ok) throw new Error('Erreur lors de la récupération du jeu du mois');
      game = await response.json();
    }
    console.log('Jeu du mois récupéré:', game);
    gameOfMonthData = game;
    displayGameOfMonth(game);
  } catch (error) {
    console.error('Erreur:', error);
    displayGameOfMonth(null); // Afficher l'erreur
  }
}

async function fetchGames() {
  try {
    console.log('Tentative de récupération des jeux...');
    const response = await fetch('http://localhost:3000/api/jeux');
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur lors de la récupération des jeux: ${response.status} - ${errorText}`);
    }
    const games = await response.json();
    console.log('Jeux récupérés:', games);
    displayGames(games);
    setupSearch(games);
    populateVoteSelect(games);
  } catch (error) {
    console.error('Erreur:', error);
    const gamesErrorElement = document.getElementById('gamesError');
    if (gamesErrorElement) {
      gamesErrorElement.textContent = 'Erreur lors du chargement des jeux: ' + error.message;
    }
  }
}

function displayGameOfMonth(game) {
  const gameOfMonthImage = document.getElementById('gameOfMonthImage');
  const gameOfMonthName = document.getElementById('gameOfMonthName');
  const gameOfMonthError = document.getElementById('gameOfMonthError');
  const gameOfMonthDetails = document.getElementById('gameOfMonthDetails');

  if (!gameOfMonthImage || !gameOfMonthName || !gameOfMonthError || !gameOfMonthDetails) {
    console.log('Éléments du jeu du mois non trouvés dans le DOM, probablement pas sur la page d\'accueil.');
    return;
  }

  if (game && game.Nom_jeux) {
    gameOfMonthImage.src = game.image_url || '/img/default.jpg';
    gameOfMonthName.textContent = game.Nom_jeux;
    gameOfMonthError.style.display = 'none';
    gameOfMonthDetails.style.display = 'inline-block';
    gameOfMonthDetails.onclick = () => showGameModal(game);
  } else {
    gameOfMonthImage.src = '/img/default.jpg';
    gameOfMonthName.textContent = '';
    gameOfMonthError.style.display = 'block';
    gameOfMonthDetails.style.display = 'none';
  }
}

function displayGames(games) {
  const gamesGrid = document.getElementById('gamesGrid');
  if (!gamesGrid) {
    console.log('Élément #gamesGrid non trouvé dans le DOM, probablement pas sur la page d\'accueil.');
    return;
  }
  gamesGrid.innerHTML = '';
  const halfLength = Math.ceil(games.length / 2);
  const initialGames = games.slice(0, halfLength);

  initialGames.forEach(game => {
    const noteMoyenne = parseFloat(game.note_moyenne) || 0;
    const gameCard = document.createElement('div');
    gameCard.className = 'game-card';
    gameCard.innerHTML = `
      <img src="${game.image_url || '/img/default.jpg'}" alt="${game.Nom_jeux}" style="max-width: 150px;">
      <h3>${game.Nom_jeux}</h3>
    `;
    gameCard.addEventListener('click', () => {
      console.log('Clic sur:', game.Nom_jeux, 'avec ID:', game.ID_jeux);
      showGameModal(game);
    });
    gamesGrid.appendChild(gameCard);
  });
}

// Nouvelle fonction pour récupérer les commentaires validés
async function fetchComments(gameId) {
  try {
    const response = await fetchWithToken(`http://localhost:3000/api/comments/${gameId}`);
    console.log('Commentaires récupérés:', response);
    return response;
  } catch (error) {
    console.error('Erreur lors de la récupération des commentaires:', error);
    return [];
  }
}

// Nouvelle fonction pour afficher les commentaires
function displayComments(comments, commentsContainer) {
  if (!commentsContainer) return;
  commentsContainer.innerHTML = '';
  if (comments.length === 0) {
    commentsContainer.innerHTML = '<p>Aucun commentaire validé pour ce jeu.</p>';
    return;
  }

  comments.forEach(comment => {
    const commentElement = document.createElement('div');
    commentElement.className = 'comment';
    commentElement.innerHTML = `
      <p><strong>${comment.pseudo}</strong> (${new Date(comment.createdAt).toLocaleDateString()}):</p>
      <p>${comment.contenu}</p>
      <hr>
    `;
    commentsContainer.appendChild(commentElement);
  });
}

function showGameModal(game) {
  const modal = document.getElementById('gameModal');
  if (!modal) {
    console.log('Élément #gameModal non trouvé dans le DOM, probablement pas sur la page d\'accueil.');
    return;
  }
  const modalTitle = document.getElementById('modalTitle');
  const modalDescription = document.getElementById('modalDescription');
  const noDescription = document.getElementById('noDescription');
  const modalGenre = document.getElementById('modalGenre');
  const modalPlayers = document.getElementById('modalPlayers');
  const modalDuration = document.getElementById('modalDuration');
  const modalRelease = document.getElementById('modalRelease');
  const modalAvgScore = document.getElementById('modalAvgScore');
  const rateSelect = document.getElementById('rateSelect');
  const submitRateButton = document.getElementById('submitRateButton');
  const loginPrompt = document.getElementById('loginPrompt');
  const commentSection = document.querySelector('.comment-section');
  const commentInput = document.getElementById('commentInput');
  const commentSubmit = document.getElementById('commentSubmit');
  const commentSend = document.getElementById('commentSend');
  const commentPrompt = document.getElementById('commentPrompt');
  const userScore = document.getElementById('userScore');
  const userScoreValue = document.getElementById('userScoreValue');
  const commentsContainer = document.getElementById('commentsContainer');

  if (!modalTitle || !modalDescription || !noDescription || !modalGenre || !modalPlayers || 
      !modalDuration || !modalRelease || !modalAvgScore || !rateSelect || !submitRateButton || 
      !loginPrompt || !commentSection || !commentInput || !commentSubmit || !commentSend || 
      !commentPrompt || !userScore || !userScoreValue || !commentsContainer) {
    console.log('Un ou plusieurs éléments de la modale sont manquants dans le DOM, probablement pas sur la page d\'accueil.');
    return;
  }

  console.log('Affichage de la modale pour:', game.Nom_jeux, 'avec ID:', game.ID_jeux);
  currentGameId = game.ID_jeux;

  const descriptions = {
    'Catan': 'Dans CATAN (anciennement Les Colons de Catane), les joueurs construisent des colonies et des routes pour dominer l\'île.',
    'Pandemic': 'Pandemic est un jeu coopératif où les joueurs luttent contre des maladies pour sauver l\'humanité.',
    'Carcassonne': 'Carcassonne permet de construire une ville médiévale en plaçant des tuiles.',
    '7 Wonders': '7 Wonders est un jeu de stratégie où chaque joueur développe une civilisation.',
    'Dominion': 'Vous êtes un monarque, comme vos parents avant vous.',
    'Ticket to Ride': 'Ticket to Ride consiste à relier des villes en posant des wagons sur des routes.',
    'Codenames': 'Codenames est un jeu de devinettes où les équipes cherchent des agents secrets.',
    'Terraforming Mars': 'Terraforming Mars permet de transformer Mars en une planète habitable.',
    '7 Wonders Duel': '7 Wonders Duel est un jeu de stratégie rapide où deux joueurs s\'affrontent.',
    'Agricola': 'Agricola est un jeu de gestion où les joueurs développent une ferme.',
    'Puerto Rico': 'Dans Puerto Rico, les joueurs assument les rôles de puissances coloniales construisant leurs colonies.',
    'Splendor': 'Splendor est un jeu de collecte de jetons et de développement de cartes pour devenir un riche marchand.',
    'Scythe': 'Scythe est un jeu de stratégie dans une Europe alternative des années 1920, où les joueurs luttent pour le contrôle de territoires.',
    'Small World': 'Small World est un jeu de conquête où les joueurs contrôlent des peuples fantastiques pour dominer un monde trop petit.',
    'Ticket to Ride: Europe': 'Ticket to Ride: Europe vous emmène dans une aventure ferroviaire à travers l\'Europe, reliant des villes emblématiques.',
    'Azul': 'Azul vous invite à créer des mosaïques pour décorer les murs du palais royal d\'Évora.',
    'King of Tokyo': 'Dans King of Tokyo, vous incarnez des monstres mutants luttant pour la domination de la ville.',
    'Love Letter': 'Love Letter est un jeu de cartes rapide où vous tentez de faire parvenir une lettre d\'amour à la princesse.',
    'Power Grid': 'Power Grid est un jeu de stratégie économique où vous gérez des centrales électriques et des réseaux.',
    'Wingspan': 'Wingspan est un jeu compétitif où vous attirez des oiseaux dans votre réserve naturelle.',
    'Twilight Struggle': 'Twilight Struggle est un jeu de stratégie simulant la guerre froide entre les États-Unis et l\'URSS.',
    'Lost Cities': 'Lost Cities est un jeu de cartes pour deux joueurs où vous organisez des expéditions archéologiques.',
    'Robinson Crusoe: Adventures on the Cursed Island': 'Robinson Crusoe est un jeu coopératif où vous survivez sur une île maudite.',
    'Magic: The Gathering': 'Magic: The Gathering est un jeu de cartes à collectionner où vous invoquez des créatures et lancez des sorts.',
    'Arkham Horror: The Card Game': 'Arkham Horror: The Card Game est un jeu coopératif où vous enquêtez sur des mystères surnaturels.',
    'Sheriff of Nottingham': 'Dans Sheriff of Nottingham, bluffez pour passer des marchandises devant le shérif.',
    'Sagrada': 'Sagrada vous permet de créer des vitraux en plaçant des dés colorés.'
  };
  modalTitle.textContent = game.Nom_jeux;
  if (game.description && game.description.trim()) {
    modalDescription.textContent = game.description;
    noDescription.style.display = 'none';
  } else if (descriptions[game.Nom_jeux]) {
    modalDescription.textContent = descriptions[game.Nom_jeux];
    noDescription.style.display = 'none';
  } else {
    modalDescription.textContent = 'Aucune description disponible.';
    noDescription.style.display = 'block';
  }
  modalGenre.textContent = game.genre || 'Non spécifié';
  modalPlayers.textContent = `${game.min_joueurs || 'N/A'}-${game.max_joueurs || 'N/A'} joueurs`;
  modalDuration.textContent = `${game.duree_moyenne || 'N/A'} min`;
  modalRelease.textContent = game.date_Sortie || 'Non spécifié';
  modalAvgScore.textContent = parseFloat(game.note_moyenne) ? parseFloat(game.note_moyenne).toFixed(2) : 'Non noté';

  const token = localStorage.getItem('token');
  if (!token) {
    loginPrompt.style.display = 'block';
    commentPrompt.style.display = 'block';
    commentSection.style.display = 'none';
    rateSelect.style.display = 'none';
    submitRateButton.style.display = 'none';
    userScore.style.display = 'none';
    commentsContainer.style.display = 'none';
  } else {
    loginPrompt.style.display = 'none';
    commentPrompt.style.display = 'none';
    commentSection.style.display = 'block';
    rateSelect.style.display = 'block';
    submitRateButton.style.display = 'block';
    commentsContainer.style.display = 'block';

    const decoded = parseJwt(token);
    const idUtilisateur = decoded?.id;
    if (!idUtilisateur) {
      console.error('ID utilisateur non trouvé dans le token.');
      return;
    }

    fetchWithToken(`http://localhost:3000/api/notation/check?userId=${idUtilisateur}&gameId=${game.ID_jeux}`)
      .then(notationData => {
        console.log('Données de vérification:', notationData);
        if (notationData?.hasRated) {
          userScore.style.display = 'block';
          userScoreValue.textContent = notationData.score;
          rateSelect.value = notationData.score;
        } else {
          userScore.style.display = 'none';
          rateSelect.value = '';
        }
      })
      .catch(error => {
        console.error('Erreur lors de la vérification de la notation:', error);
        alert('Erreur lors de la vérification de la notation: ' + error.message);
      });

    // Charger et afficher les commentaires validés
    fetchComments(game.ID_jeux).then(comments => {
      displayComments(comments, commentsContainer);
    });

    submitRateButton.onclick = () => {
      const score = parseInt(rateSelect.value);
      if (!score || score < 1 || score > 10) {
        alert('Veuillez sélectionner une note entre 1 et 10.');
        return;
      }
      handleRate(game.ID_jeux, score, modalAvgScore, userScore, userScoreValue, rateSelect);
    };

    commentSubmit.onclick = () => {
      const contenu = commentInput.value.trim();
      if (!contenu) {
        alert('Veuillez entrer un commentaire.');
        return;
      }
      commentSend.style.display = 'inline-block';
      commentSubmit.style.display = 'none';
    };

    commentSend.onclick = () => {
      if (confirm('Voulez-vous soumettre ce commentaire pour validation par un administrateur ?')) {
        if (!currentGameId) {
          alert('Erreur: Aucun jeu sélectionné pour le commentaire.');
          return;
        }
        handleComment(currentGameId).then(() => {
          // Recharger les commentaires après soumission
          fetchComments(currentGameId).then(comments => {
            displayComments(comments, commentsContainer);
          });
        });
        commentSend.style.display = 'none';
        commentSubmit.style.display = 'inline-block';
        commentInput.value = '';
      }
    };
  }

  modal.style.display = 'block';
  console.log('Modale affichée pour:', game.Nom_jeux, 'avec ID:', game.ID_jeux);
}

async function handleRate(gameId, score, modalAvgScore, userScore, userScoreValue, rateSelect) {
  try {
    console.log('Envoi de la notation:', { score, idJeu: gameId });
    const data = await fetchWithToken('http://localhost:3000/api/notation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, idJeu: gameId })
    });
    console.log('Réponse de l\'API pour la notation:', data);
    alert('Note enregistrée avec succès!');
    modalAvgScore.textContent = data.avg_score ? parseFloat(data.avg_score).toFixed(2) : 'Non noté';
    userScore.style.display = 'block';
    userScoreValue.textContent = score;
    rateSelect.value = score;
    fetchGames();
  } catch (error) {
    console.error('Erreur lors de la notation:', error);
    alert('Erreur lors de la notation: ' + error.message);
  }
}

async function handleComment(gameId) {
  const commentInput = document.getElementById('commentInput');
  if (!commentInput) return;
  const contenu = commentInput.value.trim();
  if (!contenu) {
    alert('Veuillez entrer un commentaire.');
    return;
  }
  if (!gameId) {
    alert('Erreur: Aucun jeu sélectionné pour le commentaire.');
    return;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    alert('Erreur: Vous devez être connecté pour commenter.');
    return;
  }

  const decoded = parseJwt(token);
  const idUtilisateur = decoded?.id;
  if (!idUtilisateur) {
    console.error('Erreur: Impossible de récupérer l\'ID utilisateur depuis le token.');
    alert('Erreur: Problème d\'authentification. Veuillez vous reconnecter.');
    return;
  }

  try {
    const commentData = {
      contenu,
      idJeu: gameId,
      status: 'pending',
      idUtilisateur
    };
    console.log('Envoi du commentaire - Données:', commentData);
    const response = await fetchWithToken('http://localhost:3000/api/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(commentData)
    });
    console.log('Réponse complète de l\'API:', response);
    alert('Commentaire envoyé pour validation !');
    commentInput.value = '';
  } catch (error) {
    console.error('Erreur détaillée lors de l\'envoi du commentaire:', {
      message: error.message,
      status: error.status,
      response: error.response
    });
    if (error.status === 400) {
      alert('Erreur: Le commentaire est invalide ou manquant. Vérifiez les données envoyées.');
    } else if (error.status === 401) {
      alert('Erreur: Problème d\'authentification. Veuillez vous reconnecter.');
    } else if (error.status === 500) {
      alert('Erreur: Problème côté serveur. Consultez les logs serveur pour plus de détails.');
    } else {
      alert('Erreur lors de l\'envoi du commentaire: ' + (error.response?.message || error.message));
    }
    throw error;
  }
}

function setupSearch(allGames) {
  const searchInput = document.getElementById('searchInput');
  const genreFilter = document.getElementById('genreFilter');
  const playerFilter = document.getElementById('playerFilter');
  const durationFilter = document.getElementById('durationFilter');
  const gamesGrid = document.getElementById('gamesGrid');

  if (!searchInput || !genreFilter || !playerFilter || !durationFilter || !gamesGrid) {
    console.log('Un ou plusieurs éléments de recherche sont manquants dans le DOM, probablement pas sur la page d\'accueil.');
    return;
  }

  console.log('Initialisation de la recherche...');
  function filterGames() {
    const searchTerm = searchInput.value.toLowerCase();
    const genre = genreFilter.value;
    const playerRange = playerFilter.value;
    const durationRange = durationFilter.value;

    const filteredGames = allGames.filter(game => {
      const matchesSearch = game.Nom_jeux.toLowerCase().includes(searchTerm);
      const matchesGenre = !genre || game.genre === genre;
      const matchesPlayers = !playerRange || (
        (playerRange === '1' && game.min_joueurs === 1) ||
        (playerRange === '2' && game.min_joueurs <= 2 && game.max_joueurs >= 2) ||
        (playerRange === '3-4' && game.min_joueurs <= 4 && game.max_joueurs >= 3) ||
        (playerRange === '5+' && game.max_joueurs >= 5)
      );
      const matchesDuration = !durationRange || (
        (durationRange === '0-30' && game.duree_moyenne <= 30) ||
        (durationRange === '31-60' && game.duree_moyenne > 30 && game.duree_moyenne <= 60) ||
        (durationRange === '61-120' && game.duree_moyenne > 60 && game.duree_moyenne <= 120) ||
        (durationRange === '120+' && game.duree_moyenne > 120)
      );
      return matchesSearch && matchesGenre && matchesPlayers && matchesDuration;
    });

    gamesGrid.innerHTML = '';
    filteredGames.forEach(game => {
      const noteMoyenne = parseFloat(game.note_moyenne) || 0;
      const gameCard = document.createElement('div');
      gameCard.className = 'game-card';
      gameCard.innerHTML = `
        <img src="${game.image_url || '/img/default.jpg'}" alt="${game.Nom_jeux}" style="max-width: 150px;">
        <h3>${game.Nom_jeux}</h3>
      `;
      gameCard.addEventListener('click', () => {
        console.log('Clic sur:', game.Nom_jeux, 'avec ID:', game.ID_jeux);
        showGameModal(game);
      });
      gamesGrid.appendChild(gameCard);
    });
  }

  [searchInput, genreFilter, playerFilter, durationFilter].forEach(element => {
    element.addEventListener('input', filterGames);
  });
}

const closeButton = document.querySelector('.close');
if (closeButton) {
  closeButton.addEventListener('click', () => {
    const modal = document.getElementById('gameModal');
    if (modal) {
      modal.style.display = 'none';
      currentGameId = null;
    }
  });
}

window.addEventListener('click', (event) => {
  const modal = document.getElementById('gameModal');
  if (modal && event.target === modal) {
    modal.style.display = 'none';
    currentGameId = null;
  }
});

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Erreur lors du décodage du token:', error);
    return null;
  }
}

function displayUserInfo() {
  const token = localStorage.getItem('token');
  const userInfo = document.getElementById('userInfo');
  const logoutLink = document.getElementById('logoutLink');
  const loginLink = document.getElementById('loginLink');
  const addGameLink = document.getElementById('addGameLink');
  const voteSection = document.getElementById('voteSection');
  const adminLink = document.getElementById('adminLink');
  const profileLink = document.getElementById('profileLink'); // Ajout du lien vers le profil

  if (!userInfo || !logoutLink || !loginLink || !addGameLink || !voteSection || !adminLink || !profileLink) {
    console.log('Un ou plusieurs éléments de l\'interface utilisateur sont manquants dans le DOM, probablement pas sur la page d\'accueil.');
    return;
  }

  if (token) {
    const decoded = parseJwt(token);
    if (!decoded) {
      localStorage.removeItem('token');
      window.location.href = 'accounte.html';
      return;
    }
    userInfo.textContent = `Bienvenue, ${decoded.pseudo}`;
    logoutLink.style.display = 'inline';
    loginLink.style.display = 'none';
    addGameLink.style.display = 'inline';
    voteSection.style.display = 'block';
    profileLink.style.display = 'inline'; // Afficher le lien vers le profil
    logoutLink.onclick = () => {
      localStorage.removeItem('token');
      window.location.reload();
    };
    addGameLink.onclick = () => {
      window.location.href = 'add-game.html';
    };

    // Vérifier si l'utilisateur est admin
    if (decoded.role && decoded.role === 'admin') {
      adminLink.style.display = 'inline';
    } else {
      adminLink.style.display = 'none';
    }
  } else {
    userInfo.textContent = '';
    logoutLink.style.display = 'none';
    loginLink.style.display = 'inline';
    addGameLink.style.display = 'none';
    voteSection.style.display = 'none';
    adminLink.style.display = 'none';
    profileLink.style.display = 'none'; // Masquer le lien vers le profil
  }
}

function populateVoteSelect(games) {
  const select = document.getElementById('voteGameSelect');
  if (!select) {
    console.log('Élément #voteGameSelect non trouvé dans le DOM, probablement pas sur la page d\'accueil.');
    return;
  }
  select.innerHTML = '<option value="">Sélectionnez un jeu</option>';
  games.forEach(game => {
    const option = document.createElement('option');
    option.value = game.ID_jeux;
    option.textContent = game.Nom_jeux;
    select.appendChild(option);
  });
}

async function castVote() {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Veuillez vous connecter pour voter.');
    return;
  }
  const voteGameSelect = document.getElementById('voteGameSelect');
  if (!voteGameSelect) {
    console.log('Élément #voteGameSelect non trouvé dans le DOM.');
    return;
  }
  const gameId = voteGameSelect.value;
  if (!gameId) {
    alert('Veuillez sélectionner un jeu.');
    return;
  }
  try {
    const data = await fetchWithToken('http://localhost:3000/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, status: 'pending' })
    });
    alert('Vote proposé avec succès ! En attente de validation par un administrateur.');
    const voteResult = document.getElementById('voteResult');
    if (voteResult) {
      voteResult.textContent = data.message;
    }
    voteGameSelect.value = '';
  } catch (error) {
    console.error('Erreur:', error);
    alert('Erreur lors du vote: ' + error.message);
  }
}

// Exécuter les fonctions uniquement si les éléments nécessaires existent
if (document.getElementById('gameOfMonthImage')) {
  fetchGameOfMonth();
}
if (document.getElementById('gamesGrid')) {
  fetchGames();
}
displayUserInfo();