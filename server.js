const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const Database = require('./db.js');

const app = express();
const PORT = 3000;

// Configuration de multer pour l'upload des images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Veuillez uploader une image valide.'), false);
    }
    cb(null, true);
  }
});

app.use(cors({ origin: 'http://localhost:3001' }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

Database.initialize().catch(console.error);

// Middleware pour vérifier si l'utilisateur est admin
const isAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authentification requise.' });
  }
  try {
    const decoded = jwt.verify(token, 'votre_secret_key');
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Accès réservé aux administrateurs.' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalide.' });
  }
};

// Middleware pour authentifier le token
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authentification requise.' });
  }
  try {
    const decoded = jwt.verify(token, 'votre_secret_key');
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'jwt expired' });
    }
    return res.status(403).json({ message: 'Token invalide.' });
  }
};

// Nouvelle route pour uploader une image
app.post('/api/upload-image', authenticateToken, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucune image uploadée.' });
    }
    const imagePath = `/uploads/${req.file.filename}`;
    res.status(200).json({ message: 'Image uploadée avec succès.', imagePath });
  } catch (error) {
    console.error('Erreur lors de l\'upload de l\'image:', error);
    res.status(500).json({ message: error.message || 'Erreur lors de l\'upload de l\'image.' });
  }
});

// Route pour rafraîchir le token
app.post('/api/refresh-token', authenticateToken, async (req, res) => {
  try {
    const oldToken = req.headers.authorization?.split(' ')[1];
    if (!oldToken) {
      return res.status(401).json({ message: 'Token requis.' });
    }

    const decoded = jwt.verify(oldToken, 'votre_secret_key', { ignoreExpiration: true });
    const now = Math.floor(Date.now() / 1000);
    const tokenExpiration = decoded.exp;
    const maxRefreshTime = tokenExpiration + 24 * 60 * 60;
    if (now > maxRefreshTime) {
      return res.status(401).json({ message: 'Token trop ancien pour être rafraîchi. Veuillez vous reconnecter.' });
    }

    const [users] = await Database.pool.query('SELECT * FROM utilisateur WHERE ID_utilisateur = ?', [decoded.id]);
    if (!users.length) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    const user = users[0];
    const newToken = jwt.sign({ id: user.ID_utilisateur, role: user.role, pseudo: user.Pseudo }, 'votre_secret_key', { expiresIn: '1h' });
    res.json({ message: 'Token rafraîchi avec succès.', token: newToken });
  } catch (error) {
    console.error('Erreur lors du rafraîchissement du token:', error);
    res.status(500).json({ message: 'Erreur lors du rafraîchissement du token.' });
  }
});

// Route pour récupérer un utilisateur spécifique
app.get('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const requestingUserId = req.user?.id;

    if (parseInt(userId) !== requestingUserId) {
      return res.status(403).json({ message: 'Accès non autorisé.' });
    }

    const [users] = await Database.pool.query('SELECT * FROM utilisateur WHERE ID_utilisateur = ?', [userId]);
    if (!users.length) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    const user = users[0];
    res.json({
      ID_utilisateur: user.ID_utilisateur,
      Pseudo: user.Pseudo,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'utilisateur.' });
  }
});

app.get('/api/quizz', async (req, res) => {
  try {
    const [quizzes] = await Database.pool.query(
      `SELECT q.id_quizz, q.title, q.question, q.reponse_correcte, q.id_jeu, j.Nom_jeux AS game_name 
       FROM quizz q 
       LEFT JOIN jeux j ON q.id_jeu = j.ID_jeux`
    );
    if (!quizzes || quizzes.length === 0) {
      return res.status(404).json({ message: 'Aucun quizz trouvé.' });
    }
    res.json(quizzes);
  } catch (error) {
    console.error('Erreur lors de la récupération des quizz:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des quizz.' });
  }
});

// Route pour les participations aux quizz d'un utilisateur
app.get('/api/user-quizz-participations/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!req.user || parseInt(userId) !== req.user.id) {
      return res.status(403).json({ message: 'Accès non autorisé.' });
    }

    const [participations] = await Database.pool.query(
      `SELECT pq.*, q.id_jeu, q.question, j.Nom_jeux AS game_name 
       FROM participation_quizz pq 
       LEFT JOIN quizz q ON pq.ID_Quizz = q.id_quizz 
       LEFT JOIN jeux j ON q.id_jeu = j.ID_jeux 
       WHERE pq.ID_utilisateur = ?`,
      [userId]
    );
    if (!participations.length) {
      return res.json([]); // Retourne un tableau vide si aucune donnée
    }
    res.json(participations);
  } catch (error) {
    console.error('Erreur lors de la récupération des participations aux quizz:', error);
    if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(500).json({ message: 'Erreur de configuration de la table participation_quizz ou quizz.' });
    }
    res.status(500).json({ message: 'Erreur lors de la récupération des participations aux quizz.' });
  }
});

// Route pour enregistrer ou mettre à jour une participation à un quizz
app.post('/api/participation-quizz', authenticateToken, async (req, res) => {
  try {
    const { idQuizz, idUtilisateur, scoreObtenu } = req.body;
    if (!idQuizz || !idUtilisateur || scoreObtenu === undefined) {
      return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    if (req.user.id !== parseInt(idUtilisateur)) {
      return res.status(403).json({ message: 'Accès non autorisé.' });
    }

    // Validation et normalisation du score
    const normalizedScore = Math.min(20, Math.max(0, parseInt(scoreObtenu, 10)));
    if (isNaN(normalizedScore)) {
      return res.status(400).json({ message: 'Score invalide.' });
    }

    // Vérifier si l'utilisateur a déjà participé à ce quizz
    const [existing] = await Database.pool.query(
      'SELECT score_obtenu FROM participation_quizz WHERE ID_Quizz = ? AND ID_utilisateur = ?',
      [idQuizz, idUtilisateur]
    );

    if (existing.length > 0) {
      // Mettre à jour le score si le nouveau score est meilleur
      if (normalizedScore > existing[0].score_obtenu) {
        await Database.pool.query(
          'UPDATE participation_quizz SET score_obtenu = ?, date_participation = NOW() WHERE ID_Quizz = ? AND ID_utilisateur = ?',
          [normalizedScore, idQuizz, idUtilisateur]
        );
        return res.json({ message: 'Score mis à jour avec succès.' });
      } else {
        return res.json({ message: 'Le nouveau score n\'est pas meilleur, aucune mise à jour effectuée.' });
      }
    } else {
      // Insérer une nouvelle participation
      await Database.pool.query(
        'INSERT INTO participation_quizz (ID_Quizz, ID_utilisateur, date_participation, score_obtenu) VALUES (?, ?, NOW(), ?)',
        [idQuizz, idUtilisateur, normalizedScore]
      );
      return res.json({ message: 'Participation enregistrée avec succès.' });
    }
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de la participation:', error);
    res.status(500).json({ message: 'Erreur lors de l\'enregistrement de la participation.' });
  }
});

// Route pour les commentaires d'un utilisateur
app.get('/api/user-comments/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    if (parseInt(userId) !== req.user.id) {
      return res.status(403).json({ message: 'Accès non autorisé.' });
    }

    const [comments] = await Database.pool.query(
      `SELECT c.*, j.Nom_jeux 
       FROM commentaire c 
       JOIN jeux j ON c.id_jeu = j.ID_jeux 
       WHERE c.id_utilisateur = ?`,
      [userId]
    );
    res.json(comments);
  } catch (error) {
    console.error('Erreur lors de la récupération des commentaires:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des commentaires.' });
  }
});

// Route pour les notations d'un utilisateur
app.get('/api/user-ratings/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    if (parseInt(userId) !== req.user.id) {
      return res.status(403).json({ message: 'Accès non autorisé.' });
    }

    const [ratings] = await Database.pool.query(
      `SELECT n.score, j.Nom_jeux 
       FROM notation n 
       JOIN jeux j ON n.id_jeu = j.ID_jeux 
       WHERE n.id_utilisateur = ?`,
      [userId]
    );
    res.json(ratings);
  } catch (error) {
    console.error('Erreur lors de la récupération des notations:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des notations.' });
  }
});

// Route pour les votes d'un utilisateur
app.get('/api/user-votes/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    if (parseInt(userId) !== req.user.id) {
      return res.status(403).json({ message: 'Accès non autorisé.' });
    }

    const [votes] = await Database.pool.query(
      `SELECT v.gameId, v.voteDate, j.Nom_jeux 
       FROM votes v 
       JOIN jeux j ON v.gameId = j.ID_jeux 
       WHERE v.idUtilisateur = ?`,
      [userId]
    );
    res.json(votes);
  } catch (error) {
    console.error('Erreur lors de la récupération des votes:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des votes.' });
  }
});

// Route pour le jeu du mois (public)
app.get('/api/game-of-month/random', async (req, res) => {
  try {
    const [rows] = await Database.pool.query('SELECT * FROM jeux ORDER BY RAND() LIMIT 1');
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ message: 'Aucun jeu disponible.' });
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du jeu du mois:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// Route pour le jeu du mois (utilisateur connecté)
app.get('/api/game-of-month/:idUtilisateur', authenticateToken, async (req, res) => {
  try {
    const { idUtilisateur } = req.params;
    const [rows] = await Database.pool.query('SELECT * FROM jeux WHERE ID_jeux IN (SELECT gameId FROM votes WHERE idUtilisateur = ?) ORDER BY RAND() LIMIT 1', [idUtilisateur]);
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      const [defaultGame] = await Database.pool.query('SELECT * FROM jeux ORDER BY RAND() LIMIT 1');
      res.json(defaultGame[0] || { message: 'Aucun jeu disponible.' });
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du jeu du mois:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du jeu du mois.' });
  }
});

// Route pour modifier un utilisateur
app.put('/api/users/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { pseudo, email, role } = req.body;
    await Database.pool.query(
      'UPDATE utilisateur SET Pseudo = ?, email = ?, role = ? WHERE ID_utilisateur = ?',
      [pseudo, email, role, id]
    );
    res.json({ message: 'Utilisateur modifié avec succès.' });
  } catch (error) {
    console.error('Erreur lors de la modification de l\'utilisateur:', error);
    res.status(500).json({ message: 'Erreur lors de la modification de l\'utilisateur.' });
  }
});

// Route pour modifier un jeu
app.put('/api/games/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { Nom_jeux, genre, min_joueurs, max_joueurs, duree_moyenne, date_Sortie, description } = req.body;
    await Database.pool.query(
      'UPDATE jeux SET Nom_jeux = ?, genre = ?, min_joueurs = ?, max_joueurs = ?, duree_moyenne = ?, date_Sortie = ?, description = ? WHERE ID_jeux = ?',
      [Nom_jeux, genre, min_joueurs, max_joueurs, duree_moyenne, date_Sortie, description, id]
    );
    res.json({ message: 'Jeu modifié avec succès.' });
  } catch (error) {
    console.error('Erreur lors de la modification du jeu:', error);
    res.status(500).json({ message: 'Erreur lors de la modification du jeu.' });
  }
});

app.post('/api/vote', authenticateToken, async (req, res) => {
  try {
    const { gameId } = req.body;
    const idUtilisateur = req.user?.id;

    const [existingVotes] = await Database.pool.query(
      'SELECT * FROM votes WHERE idUtilisateur = ? AND gameId = ?',
      [idUtilisateur, gameId]
    );
    if (existingVotes.length > 0) {
      return res.status(400).json({ message: 'Vous avez déjà voté pour ce jeu.' });
    }

    const [game] = await Database.pool.query('SELECT * FROM jeux WHERE ID_jeux = ?', [gameId]);
    if (!game.length) {
      return res.status(404).json({ message: 'Jeu non trouvé.' });
    }

    await Database.pool.query(
      'INSERT INTO votes (idUtilisateur, gameId) VALUES (?, ?)',
      [idUtilisateur, gameId]
    );
    res.json({ message: 'Vote enregistré avec succès.' });
  } catch (error) {
    console.error('Erreur lors du vote:', error);
    res.status(500).json({ message: 'Erreur lors du vote: ' + error.message });
  }
});

app.get('/api/votes', isAdmin, async (req, res) => {
  try {
    const [votes] = await Database.pool.query(
      'SELECT v.gameId, j.Nom_jeux, COUNT(*) as voteCount FROM votes v JOIN jeux j ON v.gameId = j.ID_jeux GROUP BY v.gameId, j.Nom_jeux'
    );
    res.json(votes);
  } catch (error) {
    console.error('Erreur lors de la récupération des votes:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des votes.' });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { Pseudo, email, mot_de_passe, role } = req.body;
    if (!Pseudo || !email || !mot_de_passe) {
      return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    const [existing] = await Database.pool.query('SELECT * FROM utilisateur WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
    }

    const [result] = await Database.pool.query(
      'INSERT INTO utilisateur (Pseudo, email, mot_de_passe, role) VALUES (?, ?, ?, ?)',
      [Pseudo, email, mot_de_passe, role || 'utilisateur']
    );
    res.status(201).json({ message: 'Inscription réussie.', userId: result.insertId });
  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({ message: 'Erreur lors de l\'inscription.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;
    if (!email || !mot_de_passe) {
      return res.status(400).json({ message: 'Email et mot de passe requis.' });
    }

    const [users] = await Database.pool.query('SELECT * FROM utilisateur WHERE email = ?', [email]);
    if (!users.length) {
      console.log('Utilisateur non trouvé pour email:', email);
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }
    const user = users[0];
    console.log('Utilisateur trouvé:', user);
    if (user.mot_de_passe !== mot_de_passe) {
      console.log('Mot de passe incorrect pour email:', email, 'Saisi:', mot_de_passe, 'Attendu:', user.mot_de_passe);
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    const token = jwt.sign({ id: user.ID_utilisateur, role: user.role, pseudo: user.Pseudo }, 'votre_secret_key', { expiresIn: '1h' });
    console.log('Connexion réussie pour:', email, 'Rôle:', user.role);
    res.json({ message: 'Connexion réussie.', token, role: user.role });
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({ message: 'Erreur lors de la connexion.' });
  }
});

app.get('/api/jeux', async (req, res) => {
  try {
    const games = await Database.getGames();
    console.log('Jeux récupérés:', games);
    if (!games || games.length === 0) {
      return res.status(404).json({ message: 'Aucun jeu trouvé.' });
    }
    res.json(games);
  } catch (error) {
    console.error('Erreur lors de la récupération des jeux:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des jeux.' });
  }
});

app.get('/api/game-info', async (req, res) => {
  try {
    const { game } = req.query;
    const [rows] = await Database.pool.query('SELECT * FROM jeux WHERE Nom_jeux = ?', [game]);
    if (!rows.length) {
      return res.status(404).json({ message: 'Jeu non trouvé.' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Erreur lors de la récupération des infos du jeu:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des infos du jeu.' });
  }
});

app.get('/api/notation/check', authenticateToken, async (req, res) => {
  try {
    const { userId, gameId } = req.query;
    if (!userId || !gameId) {
      return res.status(400).json({ message: 'userId et gameId sont requis.' });
    }

    if (req.user?.id !== parseInt(userId)) {
      return res.status(403).json({ message: 'Accès non autorisé.' });
    }

    const notation = await Database.getNotation(userId, gameId);
    res.json(notation);
  } catch (error) {
    console.error('Erreur lors de la vérification de la notation:', error);
    res.status(500).json({ message: 'Erreur lors de la vérification de la notation: ' + error.message });
  }
});

app.post('/api/notation', authenticateToken, async (req, res) => {
  try {
    const { score, idJeu } = req.body;
    const idUtilisateur = req.user.id;

    const result = await Database.addNotation(score, idUtilisateur, idJeu);
    res.json({ message: 'Notation ajoutée avec succès.', avg_score: result.avg_score, user_score: score });
  } catch (error) {
    console.error('Erreur lors de l\'ajout de la notation:', error);
    res.status(500).json({ message: error.message || 'Erreur lors de l\'ajout de la notation.' });
  }
});

app.post('/api/comment', authenticateToken, async (req, res) => {
  try {
    const { contenu, idJeu, status } = req.body;
    const idUtilisateur = req.user.id;

    await Database.addComment(contenu, idUtilisateur, idJeu, status);
    res.json({ message: 'Commentaire ajouté avec succès.' });
  } catch (error) {
    console.error('Erreur lors de l\'ajout du commentaire:', error);
    res.status(500).json({ message: 'Erreur lors de l\'ajout du commentaire.' });
  }
});

app.get('/api/comments/:gameId', authenticateToken, async (req, res) => {
  try {
    const gameId = req.params.gameId;
    const [comments] = await Database.pool.query(
      `SELECT c.id_commentaire AS id, c.contenu, c.date AS createdAt, c.id_utilisateur AS idUtilisateur, u.Pseudo AS pseudo
       FROM commentaire c
       JOIN utilisateur u ON c.id_utilisateur = u.ID_utilisateur
       WHERE c.id_jeu = ? AND c.status = 'approved'`,
      [gameId]
    );
    res.json(comments);
  } catch (error) {
    console.error('Erreur lors de la récupération des commentaires:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des commentaires.' });
  }
});

app.post('/api/propose-game', authenticateToken, async (req, res) => {
  try {
    const { Nom_jeux, description, genre, min_joueurs, max_joueurs, duree_moyenne, date_Sortie, image_url, status } = req.body;
    if (!Nom_jeux || !genre || !min_joueurs || !max_joueurs || !duree_moyenne || !date_Sortie || !image_url) {
      return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis.' });
    }

    const [result] = await Database.pool.query(
      'INSERT INTO JeuxEnAttente (Nom_jeux, description, genre, min_joueurs, max_joueurs, duree_moyenne, date_Sortie, image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [Nom_jeux, description || '', genre, min_joueurs, max_joueurs, duree_moyenne, date_Sortie, image_url, status]
    );
    res.status(201).json({ message: 'Jeu proposé avec succès.', id: result.insertId });
  } catch (error) {
    console.error('Erreur lors de la proposition du jeu:', error);
    res.status(500).json({ message: 'Erreur lors de la proposition du jeu.' });
  }
});

app.get('/api/pending-games', isAdmin, async (req, res) => {
  try {
    const [rows] = await Database.pool.query('SELECT * FROM JeuxEnAttente WHERE status = "pending"');
    res.json(rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des jeux en attente:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des jeux en attente.' });
  }
});

app.post('/api/validate-game/:id', isAdmin, async (req, res) => {
  try {
    const gameId = req.params.id;
    const { action } = req.body;
    if (action === 'approve') {
      const [game] = await Database.pool.query('SELECT * FROM JeuxEnAttente WHERE id = ?', [gameId]);
      const gameData = game[0];
      await Database.pool.query(
        'INSERT INTO jeux (Nom_jeux, description, genre, min_joueurs, max_joueurs, duree_moyenne, date_Sortie, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [gameData.Nom_jeux, gameData.description, gameData.genre, gameData.min_joueurs, gameData.max_joueurs, gameData.duree_moyenne, gameData.date_Sortie, gameData.image_url]
      );
    }
    await Database.pool.query('UPDATE JeuxEnAttente SET status = ? WHERE id = ?', [action === 'approve' ? 'approved' : 'rejected', gameId]);
    res.json({ message: `Jeu ${action === 'approve' ? 'approuvé' : 'rejeté'} avec succès.` });
  } catch (error) {
    console.error('Erreur lors de la validation du jeu:', error);
    res.status(500).json({ message: 'Erreur lors de la validation du jeu.' });
  }
});

app.get('/api/pending-comments', isAdmin, async (req, res) => {
  try {
    const [rows] = await Database.pool.query('SELECT c.*, j.Nom_jeux FROM commentaire c JOIN jeux j ON c.id_jeu = j.ID_jeux WHERE c.status = "pending"');
    res.json(rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des commentaires en attente:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des commentaires en attente.' });
  }
});

app.post('/api/validate-comment/:id', isAdmin, async (req, res) => {
  try {
    const commentId = req.params.id;
    const { action } = req.body;
    await Database.pool.query('UPDATE commentaire SET status = ? WHERE id_commentaire = ?', [action === 'approve' ? 'approved' : 'rejected', commentId]);
    res.json({ message: `Commentaire ${action === 'approve' ? 'approuvé' : 'rejeté'} avec succès.` });
  } catch (error) {
    console.error('Erreur lors de la validation du commentaire:', error);
    res.status(500).json({ message: 'Erreur lors de la validation du commentaire.' });
  }
});

app.get('/api/users', isAdmin, async (req, res) => {
  try {
    const [rows] = await Database.pool.query('SELECT * FROM utilisateur');
    res.json(rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs.' });
  }
});

app.delete('/api/users/:id', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    await Database.pool.query('DELETE FROM utilisateur WHERE ID_utilisateur = ?', [userId]);
    res.json({ message: 'Utilisateur supprimé avec succès.' });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'utilisateur.' });
  }
});

app.delete('/api/games/:id', isAdmin, async (req, res) => {
  try {
    const gameId = req.params.id;
    await Database.pool.query('DELETE FROM jeux WHERE ID_jeux = ?', [gameId]);
    res.json({ message: 'Jeu supprimé avec succès.' });
  } catch (error) {
    console.error('Erreur lors de la suppression du jeu:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du jeu.' });
  }
});

// Gestionnaire 404 par défaut pour les routes non trouvées
app.use((req, res) => {
  res.status(404).json({ message: 'Route non trouvée.' });
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});