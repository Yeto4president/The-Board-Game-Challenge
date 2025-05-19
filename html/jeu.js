async function loadGameDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get("id");
  try {
    const response = await fetch(`/api/jeux/${gameId}`);
    const game = await response.json();
    const commentsResponse = await fetch(`/api/commentaires?jeu_id=${gameId}`);
    const comments = await commentsResponse.json();
    const gameDetail = document.getElementById("gameDetail");
    gameDetail.innerHTML = `
      <img src="../img/${game.Nom_jeux.toLowerCase().replace(/ /g, '-')}.jpg" alt="${game.Nom_jeux}" />
      <h2>${game.Nom_jeux}</h2>
      <p>${game.description || 'Aucune description disponible.'}</p>
      <p>Note moyenne : ${"★".repeat(Math.round(game.note_moyenne / 2))}${"☆".repeat(5 - Math.round(game.note_moyenne / 2))}</p>
      <h3>Commentaires</h3>
      ${comments.length ? comments.map(c => `<div class="comment">${c.Pseudo}: ${c.contenu} (${new Date(c.date).toLocaleDateString()})</div>`).join('') : '<p>Aucun commentaire pour le moment.</p>'}
      <form onsubmit="addComment(event, ${gameId})">
        <label for="comment">Ajouter un commentaire</label>
        <textarea id="comment" required></textarea>
        <label for="score">Noter (1-10)</label>
        <select id="score" required>
          ${Array.from({length: 10}, (_, i) => `<option value="${i+1}">${i+1}</option>`).join('')}
        </select>
        <button type="submit">Envoyer</button>
      </form>
    `;
  } catch (error) {
    console.error('Erreur:', error);
    document.getElementById("gameDetail").innerHTML = '<p>Erreur lors du chargement des détails du jeu.</p>';
  }
}

async function addComment(event, gameId) {
  event.preventDefault();
  const contenu = document.getElementById('comment').value;
  const score = document.getElementById('score').value;
  try {
    const commentResponse = await fetch('/api/commentaires', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenu, id_jeu: gameId })
    });
    const notationResponse = await fetch('/api/notations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, id_jeu: gameId })
    });
    if (commentResponse.ok && notationResponse.ok) {
      loadGameDetail();
    } else {
      alert('Vous devez être connecté pour commenter et noter.');
    }
  } catch (error) {
    alert('Erreur lors de l\'ajout du commentaire ou de la notation.');
  }
}

window.onload = loadGameDetail;