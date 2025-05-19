async function loadUsers() {
  try {
    const response = await fetch('/api/users');
    const users = await response.json();
    const userTableBody = document.querySelector("#userTable tbody");
    userTableBody.innerHTML = users.map(user => `
      <tr>
        <td>${user.Pseudo}</td>
        <td>${user.email}</td>
        <td>${user.role}</td>
        <td>
          <button class="action-btn" onclick="deleteUser(${user.ID_utilisateur})">Supprimer</button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Erreur:', error);
    document.querySelector("#userTable tbody").innerHTML = '<tr><td colspan="4">Erreur lors du chargement des utilisateurs.</td></tr>';
  }
}

async function loadGames() {
  try {
    const response = await fetch('/api/jeux');
    const games = await response.json();
    const gameTableBody = document.querySelector("#gameTable tbody");
    gameTableBody.innerHTML = games.map(game => `
      <tr>
        <td>${game.Nom_jeux}</td>
        <td>${game.genre}</td>
        <td>
          <button class="action-btn" onclick="deleteGame(${game.ID_jeux})">Supprimer</button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Erreur:', error);
    document.querySelector("#gameTable tbody").innerHTML = '<tr><td colspan="3">Erreur lors du chargement des jeux.</td></tr>';
  }
}

document.getElementById('addUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const role = document.getElementById('role').value;
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Pseudo: username, email, mot_de_passe: password, role })
    });
    if (response.ok) {
      loadUsers();
    } else {
      alert('Erreur lors de l\'ajout de l\'utilisateur.');
    }
  } catch (error) {
    alert('Erreur lors de l\'ajout de l\'utilisateur.');
  }
});

document.getElementById('addGameForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const gameName = document.getElementById('gameName').value;
  const description = document.getElementById('description').value;
  const genre = document.getElementById('genre').value;
  const minPlayers = document.getElementById('minPlayers').value;
  const maxPlayers = document.getElementById('maxPlayers').value;
  const duree = document.getElementById('duree').value;
  try {
    const response = await fetch('/api/jeux', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Nom_jeux: gameName,
        description,
        genre,
        min_joueurs: minPlayers,
        max_joueurs: maxPlayers,
        duree_moyenne: duree
      })
    });
    if (response.ok) {
      loadGames();
    } else {
      alert('Erreur lors de l\'ajout du jeu.');
    }
  } catch (error) {
    alert('Erreur lors de l\'ajout du jeu.');
  }
});

async function deleteUser(userId) {
  if (confirm('Voulez-vous supprimer cet utilisateur ?')) {
    try {
      const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (response.ok) {
        loadUsers();
      } else {
        alert('Erreur lors de la suppression de l\'utilisateur.');
      }
    } catch (error) {
      alert('Erreur lors de la suppression de l\'utilisateur.');
    }
  }
}

async function deleteGame(gameId) {
  if (confirm('Voulez-vous supprimer ce jeu ?')) {
    try {
      const response = await fetch(`/api/jeux/${gameId}`, { method: 'DELETE' });
      if (response.ok) {
        loadGames();
      } else {
        alert('Erreur lors de la suppression du jeu.');
      }
    } catch (error) {
      alert('Erreur lors de la suppression du jeu.');
    }
  }
}

window.onload = () => {
  loadUsers();
  loadGames();
};