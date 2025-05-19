const mysql = require('mysql2/promise');
require('dotenv').config();

class Database {
  static async initialize() {
    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
      });

      await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'boardgamearena'}`);
      await connection.end();

      const dbPool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'boardgamearena',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });

      Database.pool = dbPool;

      // Création des tables
      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS Utilisateur (
          ID_utilisateur INT PRIMARY KEY AUTO_INCREMENT,
          Pseudo VARCHAR(100) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          mot_de_passe VARCHAR(255) NOT NULL,
          role ENUM('admin', 'utilisateur') DEFAULT 'utilisateur'
        )
      `);

      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS Jeux (
          ID_jeux INT PRIMARY KEY AUTO_INCREMENT,
          Nom_jeux VARCHAR(255) NOT NULL,
          description TEXT,
          note_moyenne DECIMAL(3,2) DEFAULT 0,
          date_Sortie DATE,
          genre VARCHAR(100),
          min_joueurs INT,
          max_joueurs INT,
          duree_moyenne INT,
          image_url VARCHAR(255)
        )
      `);

      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS JeuxEnAttente (
          id INT PRIMARY KEY AUTO_INCREMENT,
          Nom_jeux VARCHAR(255) NOT NULL,
          description TEXT,
          genre VARCHAR(100),
          min_joueurs INT,
          max_joueurs INT,
          duree_moyenne INT,
          date_Sortie DATE,
          image_url VARCHAR(255),
          status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending'
        )
      `);

      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS Quizz (
          id_quizz INT PRIMARY KEY AUTO_INCREMENT,
          question TEXT NOT NULL,
          reponse_correcte TEXT NOT NULL,
          id_jeu INT NOT NULL,
          FOREIGN KEY (id_jeu) REFERENCES Jeux(ID_jeux) ON DELETE CASCADE
        )
      `);

      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS Participation_Quizz (
          ID_Quizz INT NOT NULL,
          ID_utilisateur INT NOT NULL,
          date_participation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          score_obtenu INT,
          PRIMARY KEY (ID_Quizz, ID_utilisateur),
          FOREIGN KEY (ID_Quizz) REFERENCES Quizz(id_quizz) ON DELETE CASCADE,
          FOREIGN KEY (ID_utilisateur) REFERENCES Utilisateur(ID_utilisateur) ON DELETE CASCADE
        )
      `);

      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS Commentaire (
          id_commentaire INT PRIMARY KEY AUTO_INCREMENT,
          contenu TEXT NOT NULL,
          date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          id_utilisateur INT NOT NULL,
          id_jeu INT NOT NULL,
          status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
          FOREIGN KEY (id_utilisateur) REFERENCES Utilisateur(ID_utilisateur) ON DELETE CASCADE,
          FOREIGN KEY (id_jeu) REFERENCES Jeux(ID_jeux) ON DELETE CASCADE
        )
      `);

      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS Likes (
          id_like INT PRIMARY KEY AUTO_INCREMENT,
          id_utilisateur INT NOT NULL,
          id_jeu INT NOT NULL,
          date_like TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (id_utilisateur) REFERENCES Utilisateur(ID_utilisateur) ON DELETE CASCADE,
          FOREIGN KEY (id_jeu) REFERENCES Jeux(ID_jeux) ON DELETE CASCADE
        )
      `);

      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS Notation (
          id_notation INT PRIMARY KEY AUTO_INCREMENT,
          score INT,
          id_utilisateur INT NOT NULL,
          id_jeu INT NOT NULL,
          FOREIGN KEY (id_utilisateur) REFERENCES Utilisateur(ID_utilisateur) ON DELETE CASCADE,
          FOREIGN KEY (id_jeu) REFERENCES Jeux(ID_jeux) ON DELETE CASCADE
        )
      `);

      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS Votes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          idUtilisateur INT NOT NULL,
          gameId INT NOT NULL,
          voteDate DATETIME DEFAULT CURRENT_TIMESTAMP,
          status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
          FOREIGN KEY (idUtilisateur) REFERENCES Utilisateur(ID_utilisateur) ON DELETE CASCADE,
          FOREIGN KEY (gameId) REFERENCES Jeux(ID_jeux) ON DELETE CASCADE
        )
      `);

      console.log('Tables créées ou déjà existantes.');

      // Ajout des index avec vérification préalable
      const [tablesJeux] = await dbPool.query(`SHOW TABLES LIKE 'Jeux'`);
      if (tablesJeux.length === 0) {
        throw new Error('La table Jeux n\'existe pas. Assurez-vous que la création des tables a réussi.');
      }
      const [indexesJeux] = await dbPool.query(`
        SELECT INDEX_NAME 
        FROM information_schema.STATISTICS 
        WHERE TABLE_NAME = 'Jeux' AND INDEX_NAME = 'idx_jeu_genre'
      `);
      if (indexesJeux.length === 0) {
        await dbPool.query(`CREATE INDEX idx_jeu_genre ON Jeux(genre)`);
        console.log('Index idx_jeu_genre créé avec succès.');
      } else {
        console.log('Index idx_jeu_genre existe déjà, ignoré.');
      }

      const [tablesNotation] = await dbPool.query(`SHOW TABLES LIKE 'Notation'`);
      if (tablesNotation.length === 0) {
        throw new Error('La table Notation n\'existe pas. Assurez-vous que la création des tables a réussi.');
      }
      const [indexesNotation] = await dbPool.query(`
        SELECT INDEX_NAME 
        FROM information_schema.STATISTICS 
        WHERE TABLE_NAME = 'Notation' AND INDEX_NAME = 'idx_notation_jeu'
      `);
      if (indexesNotation.length === 0) {
        await dbPool.query(`CREATE INDEX idx_notation_jeu ON Notation(id_jeu)`);
        console.log('Index idx_notation_jeu créé avec succès.');
      } else {
        console.log('Index idx_notation_jeu existe déjà, ignoré.');
      }

      const [tablesCommentaire] = await dbPool.query(`SHOW TABLES LIKE 'Commentaire'`);
      if (tablesCommentaire.length === 0) {
        throw new Error('La table Commentaire n\'existe pas. Assurez-vous que la création des tables a réussi.');
      }
      const [indexesCommentaire] = await dbPool.query(`
        SELECT INDEX_NAME 
        FROM information_schema.STATISTICS 
        WHERE TABLE_NAME = 'Commentaire' AND INDEX_NAME = 'idx_commentaire_jeu'
      `);
      if (indexesCommentaire.length === 0) {
        await dbPool.query(`CREATE INDEX idx_commentaire_jeu ON Commentaire(id_jeu)`);
        console.log('Index idx_commentaire_jeu créé avec succès.');
      } else {
        console.log('Index idx_commentaire_jeu existe déjà, ignoré.');
      }

      // Remplissage des tables
      // Table Utilisateur
      const [userRows] = await dbPool.query('SELECT COUNT(*) as count FROM Utilisateur');
      if (userRows[0].count === 0) {
        console.log('Insertion des utilisateurs initiaux...');
        const users = [
          { Pseudo: 'user1', email: 'user1@example.com', mot_de_passe: 'user123', role: 'utilisateur' },
          { Pseudo: 'user2', email: 'user2@example.com', mot_de_passe: 'user456', role: 'utilisateur' }
        ];

        for (const user of users) {
          await dbPool.query(
            'INSERT INTO Utilisateur (Pseudo, email, mot_de_passe, role) VALUES (?, ?, ?, ?)',
            [user.Pseudo, user.email, user.mot_de_passe, user.role]
          );
        }
        console.log('Utilisateurs initiaux insérés avec succès.');
      } else {
        console.log('La table Utilisateur contient déjà des données, aucune insertion effectuée.');
      }

      const admins = [
        { Pseudo: 'admin1', email: 'admin1@example.com', mot_de_passe: 'admin123', role: 'admin' },
        { Pseudo: 'admin2', email: 'admin2@example.com', mot_de_passe: 'admin456', role: 'admin' },
        { Pseudo: 'admin3', email: 'admin3@example.com', mot_de_passe: 'admin789', role: 'admin' }
      ];

      for (const admin of admins) {
        const [existingAdmin] = await dbPool.query('SELECT * FROM Utilisateur WHERE email = ?', [admin.email]);
        if (existingAdmin.length === 0) {
          console.log(`Insertion de l'admin ${admin.Pseudo}...`);
          await dbPool.query(
            'INSERT INTO Utilisateur (Pseudo, email, mot_de_passe, role) VALUES (?, ?, ?, ?)',
            [admin.Pseudo, admin.email, admin.mot_de_passe, admin.role]
          );
        } else if (existingAdmin[0].mot_de_passe !== admin.mot_de_passe) {
          console.log(`Mise à jour du mot de passe de l'admin ${admin.Pseudo}...`);
          await dbPool.query(
            'UPDATE Utilisateur SET mot_de_passe = ? WHERE email = ?',
            [admin.mot_de_passe, admin.email]
          );
        }
      }

      const [adminsRows] = await dbPool.query('SELECT * FROM Utilisateur WHERE role = "admin"');
      console.log('Admins présents dans la base:', adminsRows);

      // Table Jeux
      const [gameRows] = await dbPool.query('SELECT COUNT(*) as count FROM Jeux');
      if (gameRows[0].count === 0) {
        console.log('Insertion des jeux initiaux...');
        const jeux = [
          { Nom_jeux: 'Pandemic', description: 'Pandemic est un jeu coopératif où les joueurs luttent contre des maladies pour sauver l\'humanité.', note_moyenne: 7.59, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 2, max_joueurs: 4, duree_moyenne: 45, image_url: '/img/pandemic.jpg' },
          { Nom_jeux: 'Carcassonne', description: 'Carcassonne permet de construire une ville médiévale en plaçant des tuiles.', note_moyenne: 7.42, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 2, max_joueurs: 5, duree_moyenne: 45, image_url: '/img/carcassonne.jpg' },
          { Nom_jeux: 'Catan', description: 'Dans CATAN (anciennement Les Colons de Catane), les joueurs construisent des colonies et des routes pour dominer l\'île.', note_moyenne: 7.14, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 3, max_joueurs: 4, duree_moyenne: 120, image_url: '/img/catan.jpg' },
          { Nom_jeux: '7 Wonders', description: '7 Wonders est un jeu de stratégie où chaque joueur développe une civilisation.', note_moyenne: 7.74, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 2, max_joueurs: 7, duree_moyenne: 30, image_url: '/img/7wonders.jpg' },
          { Nom_jeux: 'Dominion', description: 'Dominion est un jeu de cartes où les joueurs construisent des decks pour obtenir la victoire.', note_moyenne: 7.61, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 2, max_joueurs: 4, duree_moyenne: 30, image_url: '/img/dominion.jpg' },
          { Nom_jeux: 'Ticket to Ride', description: 'Ticket to Ride consiste à relier des villes en posant des wagons sur des routes.', note_moyenne: 7.41, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 2, max_joueurs: 5, duree_moyenne: 60, image_url: '/img/tickettoride.jpg' },
          { Nom_jeux: 'Codenames', description: 'Codenames est un jeu de devinettes où les équipes cherchent des agents secrets.', note_moyenne: 7.6, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 2, max_joueurs: 8, duree_moyenne: 15, image_url: '/img/codenames.jpg' },
          { Nom_jeux: 'Terraforming Mars', description: 'Terraforming Mars permet de transformer Mars en une planète habitable.', note_moyenne: 8.42, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 1, max_joueurs: 5, duree_moyenne: 120, image_url: '/img/terraformingmars.jpg' },
          { Nom_jeux: '7 Wonders Duel', description: '7 Wonders Duel est un jeu de stratégie rapide où deux joueurs s\'affrontent.', note_moyenne: 8.11, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 2, max_joueurs: 2, duree_moyenne: 30, image_url: '/img/7wondersduel.jpg' },
          { Nom_jeux: 'Agricola', description: 'Agricola est un jeu de gestion où les joueurs développent une ferme.', note_moyenne: 7.93, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 1, max_joueurs: 5, duree_moyenne: 150, image_url: '/img/agricola.jpg' },
          { Nom_jeux: 'Puerto Rico', description: 'Dans Puerto Rico, les joueurs assument les rôles de puissances coloniales construisant leurs colonies.', note_moyenne: 7.97, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 3, max_joueurs: 5, duree_moyenne: 150, image_url: '/img/puertorico.jpg' },
          { Nom_jeux: 'Splendor', description: 'Splendor est un jeu de collecte de jetons et de développement de cartes pour devenir un riche marchand.', note_moyenne: 7.44, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 2, max_joueurs: 4, duree_moyenne: 30, image_url: '/img/splendor.jpg' },
          { Nom_jeux: 'Scythe', description: 'Scythe est un jeu de stratégie dans une Europe alternative des années 1920, où les joueurs luttent pour le contrôle de territoires.', note_moyenne: 8.22, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 1, max_joueurs: 5, duree_moyenne: 115, image_url: '/img/scythe.jpg' },
          { Nom_jeux: 'Small World', description: 'Small World est un jeu de conquête où les joueurs contrôlent des peuples fantastiques pour dominer un monde trop petit.', note_moyenne: 7.25, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 2, max_joueurs: 5, duree_moyenne: 80, image_url: '/img/smallworld.jpg' },
          { Nom_jeux: 'Ticket to Ride: Europe', description: 'Ticket to Ride: Europe vous emmène dans une aventure ferroviaire à travers l\'Europe, reliant des villes emblématiques.', note_moyenne: 7.54, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 2, max_joueurs: 5, duree_moyenne: 60, image_url: '/img/tickettorideeurope.jpg' },
          { Nom_jeux: 'Azul', description: 'Azul vous invite à créer des mosaïques pour décorer les murs du palais royal d\'Évora.', note_moyenne: 7.8, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 2, max_joueurs: 4, duree_moyenne: 45, image_url: '/img/azul.jpg' },
          { Nom_jeux: 'King of Tokyo', description: 'Dans King of Tokyo, vous incarnez des monstres mutants luttant pour la domination de la ville.', note_moyenne: 7.17, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 2, max_joueurs: 6, duree_moyenne: 30, image_url: '/img/kingoftokyo.jpg' },
          { Nom_jeux: 'Love Letter', description: 'Love Letter est un jeu de cartes rapide où vous tentez de faire parvenir une lettre d\'amour à la princesse.', note_moyenne: 7.23, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 2, max_joueurs: 4, duree_moyenne: 20, image_url: '/img/loveletter.jpg' },
          { Nom_jeux: 'Power Grid', description: 'Power Grid est un jeu de stratégie économique où vous gérez des centrales électriques et des réseaux.', note_moyenne: 7.84, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 2, max_joueurs: 6, duree_moyenne: 120, image_url: '/img/powergrid.jpg' },
          { Nom_jeux: 'Wingspan', description: 'Wingspan est un jeu compétitif où vous attirez des oiseaux dans votre réserve naturelle.', note_moyenne: 8.1, date_Sortie: '1970-01-01', genre: 'Stratégie', min_joueurs: 1, max_joueurs: 5, duree_moyenne: 70, image_url: '/img/wingspan.jpg' },
          { Nom_jeux: 'Twilight Struggle', description: 'Twilight Struggle est un jeu de stratégie simulant la guerre froide entre les États-Unis et l\'URSS.', note_moyenne: 8.28, date_Sortie: '1970-01-01', genre: 'Wargame', min_joueurs: 2, max_joueurs: 2, duree_moyenne: 180, image_url: '/img/twilightstruggle.jpg' },
          { Nom_jeux: 'Lost Cities', description: 'Lost Cities est un jeu de cartes pour deux joueurs où vous organisez des expéditions archéologiques.', note_moyenne: 7.19, date_Sortie: '1970-01-01', genre: 'Cartes', min_joueurs: 2, max_joueurs: 2, duree_moyenne: 30, image_url: '/img/lostcities.jpg' },
          { Nom_jeux: 'Robinson Crusoe: Adventures on the Cursed Island', description: 'Robinson Crusoe est un jeu coopératif où vous survivez sur une île maudite.', note_moyenne: 7.82, date_Sortie: '1970-01-01', genre: 'Dés', min_joueurs: 1, max_joueurs: 4, duree_moyenne: 120, image_url: '/img/robinsoncrusoe.jpg' },
          { Nom_jeux: 'Magic: The Gathering', description: 'Magic: The Gathering est un jeu de cartes à collectionner où vous invoquez des créatures et lancez des sorts.', note_moyenne: 7.54, date_Sortie: '1970-01-01', genre: 'Cartes', min_joueurs: 2, max_joueurs: 2, duree_moyenne: 20, image_url: '/img/magicthegathering.jpg' },
          { Nom_jeux: 'Arkham Horror: The Card Game', description: 'Arkham Horror: The Card Game est un jeu coopératif où vous enquêtez sur des mystères surnaturels.', note_moyenne: 8.16, date_Sortie: '1970-01-01', genre: 'Cartes', min_joueurs: 1, max_joueurs: 2, duree_moyenne: 120, image_url: '/img/arkhamhorror.jpg' },
          { Nom_jeux: 'Sheriff of Nottingham', description: 'Dans Sheriff of Nottingham, bluffez pour passer des marchandises devant le shérif.', note_moyenne: 7.12, date_Sortie: '1970-01-01', genre: 'Dés', min_joueurs: 3, max_joueurs: 5, duree_moyenne: 60, image_url: '/img/sheriffofnottingham.jpg' },
          { Nom_jeux: 'Sagrada', description: 'Sagrada vous permet de créer des vitraux en plaçant des dés colorés.', note_moyenne: 7.51, date_Sortie: '1970-01-01', genre: 'Dés', min_joueurs: 1, max_joueurs: 4, duree_moyenne: 45, image_url: '/img/sagrada.jpg' }
        ];

        for (const jeu of jeux) {
          await dbPool.query(
            'INSERT INTO Jeux (Nom_jeux, description, note_moyenne, date_Sortie, genre, min_joueurs, max_joueurs, duree_moyenne, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [jeu.Nom_jeux, jeu.description, jeu.note_moyenne, jeu.date_Sortie, jeu.genre, jeu.min_joueurs, jeu.max_joueurs, jeu.duree_moyenne, jeu.image_url]
          );
        }
        console.log('Jeux initiaux insérés avec succès.');
      } else {
        console.log('La table Jeux contient déjà des données, aucune insertion effectuée.');
      }

      // Table Quizz
      const [quizRows] = await dbPool.query('SELECT COUNT(*) as count FROM Quizz');
      if (quizRows[0].count === 0) {
        console.log('Insertion des quizz initiaux...');
        const quizzes = [
          { question: 'En quelle année est sorti le jeu Pandemic ?', reponse_correcte: '2008', id_jeu: 1 },
          { question: 'Quel est le nombre minimum de joueurs pour jouer à Carcassonne ?', reponse_correcte: '2', id_jeu: 2 },
          { question: 'Quel jeu est connu pour ses colonies et ses routes sur une île ?', reponse_correcte: 'Catan', id_jeu: 3 }
        ];

        for (const quiz of quizzes) {
          await dbPool.query(
            'INSERT INTO Quizz (question, reponse_correcte, id_jeu) VALUES (?, ?, ?)',
            [quiz.question, quiz.reponse_correcte, quiz.id_jeu]
          );
        }
        console.log('Quizz initiaux insérés avec succès.');
      } else {
        console.log('La table Quizz contient déjà des données, aucune insertion effectuée.');
      }

      // Table Notation
      const [notationRows] = await dbPool.query('SELECT COUNT(*) as count FROM Notation');
      if (notationRows[0].count === 0) {
        console.log('Insertion des notations initiales...');
        const notations = [
          { score: 8, id_utilisateur: 1, id_jeu: 1 }, // user1 note Pandemic 8/10
          { score: 7, id_utilisateur: 2, id_jeu: 1 }, // user2 note Pandemic 7/10
          { score: 9, id_utilisateur: 1, id_jeu: 2 }  // user1 note Carcassonne 9/10
        ];

        for (const notation of notations) {
          await dbPool.query(
            'INSERT INTO Notation (score, id_utilisateur, id_jeu) VALUES (?, ?, ?)',
            [notation.score, notation.id_utilisateur, notation.id_jeu]
          );
        }
        console.log('Notations initiales insérées avec succès.');
      } else {
        console.log('La table Notation contient déjà des données, aucune insertion effectuée.');
      }

      // Ajout des vues
      await dbPool.query(`
        CREATE OR REPLACE VIEW TopJeux AS
        SELECT j.ID_jeux, j.Nom_jeux, j.genre, AVG(n.score) AS avg_score
        FROM Jeux j
        LEFT JOIN Notation n ON j.ID_jeux = n.id_jeu
        GROUP BY j.ID_jeux, j.Nom_jeux, j.genre
        ORDER BY avg_score DESC
        LIMIT 10
      `);

      await dbPool.query(`
        CREATE OR REPLACE VIEW CommentairesApprouves AS
        SELECT c.id_commentaire, c.contenu, c.date, u.Pseudo, j.Nom_jeux
        FROM Commentaire c
        JOIN Utilisateur u ON c.id_utilisateur = u.ID_utilisateur
        JOIN Jeux j ON c.id_jeu = j.ID_jeux
        WHERE c.status = 'approved'
      `);

      await dbPool.query(`
        CREATE OR REPLACE VIEW UtilisateursActifs AS
        SELECT u.ID_utilisateur, u.Pseudo, COUNT(p.ID_Quizz) AS quizz_count
        FROM Utilisateur u
        LEFT JOIN Participation_Quizz p ON u.ID_utilisateur = p.ID_utilisateur
        GROUP BY u.ID_utilisateur, u.Pseudo
        ORDER BY quizz_count DESC
        LIMIT 10
      `);

      // Ajout des déclencheurs
      await dbPool.query(`DROP TRIGGER IF EXISTS maj_note_moyenne_after_notation`);
      await dbPool.query(`
        CREATE TRIGGER maj_note_moyenne_after_notation
        AFTER INSERT ON Notation
        FOR EACH ROW
        BEGIN
          UPDATE Jeux j
          SET j.note_moyenne = (SELECT AVG(n.score) FROM Notation n WHERE n.id_jeu = NEW.id_jeu)
          WHERE j.ID_jeux = NEW.id_jeu;
        END
      `);

      await dbPool.query(`DROP TRIGGER IF EXISTS maj_note_moyenne_after_notation_update`);
      await dbPool.query(`
        CREATE TRIGGER maj_note_moyenne_after_notation_update
        AFTER UPDATE ON Notation
        FOR EACH ROW
        BEGIN
          UPDATE Jeux j
          SET j.note_moyenne = (SELECT AVG(n.score) FROM Notation n WHERE n.id_jeu = NEW.id_jeu)
          WHERE j.ID_jeux = NEW.id_jeu;
        END
      `);

      await dbPool.query(`DROP TRIGGER IF EXISTS maj_vote_count_after_vote`);
      await dbPool.query(`
        CREATE TRIGGER maj_vote_count_after_vote
        AFTER INSERT ON Votes
        FOR EACH ROW
        BEGIN
          UPDATE Jeux
          SET note_moyenne = (SELECT COUNT(*) FROM Votes WHERE gameId = NEW.gameId AND status = 'approved')
          WHERE ID_jeux = NEW.gameId;
        END
      `);

      // Ajout des procédures
      await dbPool.query(`DROP PROCEDURE IF EXISTS ajouter_commentaire`);
      await dbPool.query(`
        CREATE PROCEDURE ajouter_commentaire(IN p_contenu TEXT, IN p_id_utilisateur INT, IN p_id_jeu INT)
        BEGIN
          INSERT INTO Commentaire (contenu, id_utilisateur, id_jeu, status)
          VALUES (p_contenu, p_id_utilisateur, p_id_jeu, 'pending');
        END
      `);

      await dbPool.query(`DROP PROCEDURE IF EXISTS ajouter_quizz`);
      await dbPool.query(`
        CREATE PROCEDURE ajouter_quizz(IN p_question TEXT, IN p_reponse_correcte TEXT, IN p_id_jeu INT)
        BEGIN
          INSERT INTO Quizz (question, reponse_correcte, id_jeu)
          VALUES (p_question, p_reponse_correcte, p_id_jeu);
        END
      `);

      await dbPool.query(`DROP PROCEDURE IF EXISTS enregistrer_participation_quizz`);
      await dbPool.query(`
        CREATE PROCEDURE enregistrer_participation_quizz(IN p_id_quizz INT, IN p_id_utilisateur INT, IN p_score INT)
        BEGIN
          INSERT INTO Participation_Quizz (ID_Quizz, ID_utilisateur, score_obtenu)
          VALUES (p_id_quizz, p_id_utilisateur, p_score);
        END
      `);

      console.log('Initialisation de la base de données terminée.');
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de la base de données:', error);
      throw error;
    }
  }

  static async query(sql, params) {
    const [rows] = await Database.pool.execute(sql, params);
    return rows;
  }

  static async getUsers() {
    const [rows] = await Database.pool.query('SELECT * FROM Utilisateur');
    return rows;
  }

  static async addUser(pseudo, email, password, role) {
    const [result] = await Database.pool.query(
      'INSERT INTO Utilisateur (Pseudo, email, mot_de_passe, role) VALUES (?, ?, ?, ?)',
      [pseudo, email, password, role]
    );
    return result.insertId;
  }

  static async deleteUser(id) {
    await Database.pool.query('DELETE FROM Utilisateur WHERE ID_utilisateur = ?', [id]);
  }

  static async getGames() {
    const [rows] = await Database.pool.query('SELECT * FROM Jeux');
    return rows;
  }

  static async getGameById(id) {
    const [rows] = await Database.pool.query('SELECT * FROM Jeux WHERE ID_jeux = ?', [id]);
    return rows[0];
  }

  static async addGame(nom, description, genre, minJoueurs, maxJoueurs, dureeMoyenne, dateSortie, imageUrl) {
    const [result] = await Database.pool.query(
      'INSERT INTO Jeux (Nom_jeux, description, genre, min_joueurs, max_joueurs, duree_moyenne, date_Sortie, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [nom, description, genre, minJoueurs, maxJoueurs, dureeMoyenne, dateSortie, imageUrl]
    );
    return result.insertId;
  }

  static async deleteGame(id) {
    await Database.pool.query('DELETE FROM Jeux WHERE ID_jeux = ?', [id]);
  }

  static async addPendingGame(nom, description, genre, minJoueurs, maxJoueurs, dureeMoyenne, dateSortie, imageUrl, status) {
    const [result] = await Database.pool.query(
      'INSERT INTO JeuxEnAttente (Nom_jeux, description, genre, min_joueurs, max_joueurs, duree_moyenne, date_Sortie, image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [nom, description, genre, minJoueurs, maxJoueurs, dureeMoyenne, dateSortie, imageUrl, status]
    );
    return result.insertId;
  }

  static async getPendingGames() {
    const [rows] = await Database.pool.query('SELECT * FROM JeuxEnAttente WHERE status = "pending"');
    return rows;
  }

  static async getQuizzes() {
    const [rows] = await Database.pool.query('SELECT * FROM Quizz');
    return rows;
  }

  static async addQuiz(question, reponseCorrecte, idJeu) {
    const [result] = await Database.pool.query(
      'INSERT INTO Quizz (question, reponse_correcte, id_jeu) VALUES (?, ?, ?)',
      [question, reponseCorrecte, idJeu]
    );
    return result.insertId;
  }

  static async addParticipationQuizz(idQuizz, idUtilisateur, scoreObtenu) {
    const [result] = await Database.pool.query(
      'INSERT INTO Participation_Quizz (ID_Quizz, ID_utilisateur, score_obtenu) VALUES (?, ?, ?)',
      [idQuizz, idUtilisateur, scoreObtenu]
    );
    return result.insertId;
  }

  static async getCommentsByGameId(jeuId) {
    const [rows] = await Database.pool.query(
      'SELECT c.*, u.Pseudo FROM Commentaire c JOIN Utilisateur u ON c.id_utilisateur = u.ID_utilisateur WHERE c.id_jeu = ? AND c.status = "approved"',
      [jeuId]
    );
    return rows;
  }

  static async addComment(contenu, idUtilisateur, idJeu, status) {
    const [result] = await Database.pool.query(
      'INSERT INTO Commentaire (contenu, id_utilisateur, id_jeu, status) VALUES (?, ?, ?, ?)',
      [contenu, idUtilisateur, idJeu, status]
    );
    return result.insertId;
  }

  static async getPendingComments() {
    const [rows] = await Database.pool.query(
      'SELECT c.*, j.Nom_jeux FROM Commentaire c JOIN Jeux j ON c.id_jeu = j.ID_jeux WHERE c.status = "pending"'
    );
    return rows;
  }

  static async getGameOfMonth() {
    const [rows] = await Database.pool.query(`
      SELECT j.*, AVG(n.score) as avg_score
      FROM Jeux j
      LEFT JOIN Notation n ON j.ID_jeux = n.id_jeu
      GROUP BY j.ID_jeux
      ORDER BY avg_score DESC, j.note_moyenne DESC
      LIMIT 1
    `);
    if (!rows || rows.length === 0) {
      const [defaultRows] = await Database.pool.query('SELECT * FROM Jeux ORDER BY note_moyenne DESC LIMIT 1');
      return defaultRows[0] || { Nom_jeux: 'Aucun jeu', note_moyenne: 0, image_url: '/img/default.jpg', month: 'Mai 2025' };
    }
    return { ...rows[0], month: 'Mai 2025' };
  }

  static async getGameOfMonthForUser(userId) {
    const [rows] = await Database.pool.query(`
      SELECT j.*, n.score
      FROM Jeux j
      JOIN Notation n ON j.ID_jeux = n.id_jeu
      WHERE n.id_utilisateur = ?
      ORDER BY n.score DESC
      LIMIT 1
    `, [userId]);
    if (rows.length === 0) {
      return await Database.getGameOfMonth();
    }
    return rows[0];
  }

  static async addLike(idUtilisateur, idJeu) {
    const [existing] = await Database.pool.query(
      'SELECT * FROM Likes WHERE id_utilisateur = ? AND id_jeu = ?',
      [idUtilisateur, idJeu]
    );
    if (existing.length) {
      throw new Error('Utilisateur a déjà aimé ce jeu');
    }
    const [result] = await Database.pool.query(
      'INSERT INTO Likes (id_utilisateur, id_jeu) VALUES (?, ?)',
      [idUtilisateur, idJeu]
    );
    return result.insertId;
  }

  static async addNotation(score, idUtilisateur, idJeu) {
    let notationId;
    const [existing] = await Database.pool.query(
      'SELECT * FROM Notation WHERE id_utilisateur = ? AND id_jeu = ?',
      [idUtilisateur, idJeu]
    );

    if (existing.length) {
      await Database.pool.query(
        'UPDATE Notation SET score = ? WHERE id_utilisateur = ? AND id_jeu = ?',
        [score, idUtilisateur, idJeu]
      );
      notationId = existing[0].id_notation;
    } else {
      const [result] = await Database.pool.query(
        'INSERT INTO Notation (score, id_utilisateur, id_jeu) VALUES (?, ?, ?)',
        [score, idUtilisateur, idJeu]
      );
      notationId = result.insertId;
    }

    await Database.pool.query(
      'UPDATE Jeux SET note_moyenne = (SELECT AVG(score) FROM Notation WHERE id_jeu = ?) WHERE ID_jeux = ?',
      [idJeu, idJeu]
    );

    const [avgScore] = await Database.pool.query(
      'SELECT AVG(score) as avg_score FROM Notation WHERE id_jeu = ?',
      [idJeu]
    );

    return { insertId: notationId, avg_score: avgScore[0].avg_score || 0 };
  }

  static async addVote(idUtilisateur, gameId) {
    const [existing] = await Database.pool.query(
      'SELECT * FROM Votes WHERE idUtilisateur = ? AND gameId = ?',
      [idUtilisateur, gameId]
    );
    if (existing.length) {
      throw new Error('Utilisateur a déjà voté pour ce jeu.');
    }
    const [result] = await Database.pool.query(
      'INSERT INTO Votes (idUtilisateur, gameId, status) VALUES (?, ?, ?)',
      [idUtilisateur, gameId, 'pending']
    );
    return result.insertId;
  }

  static async getVotes() {
    const [rows] = await Database.pool.query(
      'SELECT v.gameId, j.Nom_jeux, COUNT(*) as voteCount FROM Votes v JOIN Jeux j ON v.gameId = j.ID_jeux WHERE v.status = "approved" GROUP BY v.gameId, j.Nom_jeux'
    );
    return rows;
  }

  static async getPendingVotes() {
    const [rows] = await Database.pool.query(
      'SELECT v.*, j.Nom_jeux FROM Votes v JOIN Jeux j ON v.gameId = j.ID_jeux WHERE v.status = "pending"'
    );
    return rows;
  }

  static async getNotation(userId, gameId) {
    const [rows] = await Database.pool.query(
      'SELECT score FROM Notation WHERE id_utilisateur = ? AND id_jeu = ?',
      [userId, gameId]
    );
    if (rows.length > 0) {
      return { hasRated: true, score: rows[0].score };
    } else {
      return { hasRated: false };
    }
  }
}

module.exports = Database;