document.addEventListener('DOMContentLoaded', () => {
  let currentQuiz = null;
  let currentQuestionIndex = 0;
  let score = 0;
  let quizzes = [];

  // Fonction pour parser le token JWT
  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      return null;
    }
  }

  // Fonction pour générer des options aléatoires si elles sont absentes
  function generateRandomOptions(correctAnswer) {
    let options = [correctAnswer];
    while (options.length < 4) {
      let randomOption;
      do {
        if (parseInt(correctAnswer)) {
          randomOption = (parseInt(correctAnswer) + Math.floor(Math.random() * 20) - 10).toString();
        } else {
          randomOption = (Math.floor(Math.random() * 100) + 1900).toString();
        }
      } while (options.includes(randomOption));
      options.push(randomOption);
    }
    return options.sort(() => Math.random() - 0.5);
  }

  // Données par défaut avec des thèmes variés et des questions uniques
  const defaultQuizzes = [
    {
      id_quizz: 1,
      title: "Histoire des Jeux de Société",
      concept: "Plongez dans l'histoire fascinante des jeux de société, de l'Antiquité à aujourd'hui.",
      questions: [
        { question: "Quel est le plus ancien jeu de société connu ?", options: ["Monopoly", "Senet", "Échecs", "Go"], reponse_correcte: "Senet" },
        { question: "En quelle année Monopoly a-t-il été commercialisé ?", options: ["1920", "1935", "1945", "1950"], reponse_correcte: "1935" },
        { question: "Quel pays a inventé les échecs ?", options: ["Chine", "Inde", "Perse", "Russie"], reponse_correcte: "Inde" },
        { question: "Quel jeu utilisait des osselets dans l'Antiquité ?", options: ["Backgammon", "Knucklebones", "Ludo", "Parcheesi"], reponse_correcte: "Knucklebones" },
        { question: "Qui a créé le jeu Catan ?", options: ["Klaus Teuber", "Reiner Knizia", "Uwe Rosenberg", "Sid Sackson"], reponse_correcte: "Klaus Teuber" },
        { question: "Quel jeu était populaire à la cour de Louis XIV ?", options: ["Trictrac", "Monopoly", "Risk", "Scrabble"], reponse_correcte: "Trictrac" },
        { question: "En quelle année les règles modernes des échecs ont-elles été codifiées ?", options: ["1475", "1600", "1850", "1900"], reponse_correcte: "1475" },
        { question: "Quel jeu romain utilisait un plateau circulaire ?", options: ["Ludus Latrunculorum", "Senet", "Go", "Backgammon"], reponse_correcte: "Ludus Latrunculorum" },
        { question: "Quel pays a vu naître le jeu de Go ?", options: ["Japon", "Chine", "Corée", "Vietnam"], reponse_correcte: "Chine" },
        { question: "Quel jeu a été conçu pendant la Première Guerre mondiale ?", options: ["Stratego", "Risk", "Diplomacy", "Cluedo"], reponse_correcte: "Diplomacy" },
        { question: "Quel jeu victorien utilisait des cartes illustrées ?", options: ["Happy Families", "Monopoly", "Scrabble", "Catan"], reponse_correcte: "Happy Families" },
        { question: "Quel jeu médiéval utilisait des dés et des pions ?", options: ["Tables", "Chess", "Go", "Ludo"], reponse_correcte: "Tables" },
        { question: "Quelle civilisation a joué au jeu de Mehen ?", options: ["Égyptienne", "Grecque", "Romaine", "Mésopotamienne"], reponse_correcte: "Égyptienne" },
        { question: "Quel jeu a été popularisé par les croisades ?", options: ["Backgammon", "Chess", "Senet", "Go"], reponse_correcte: "Backgammon" },
        { question: "En quelle année le Scrabble a-t-il été inventé ?", options: ["1931", "1945", "1950", "1960"], reponse_correcte: "1931" },
        { question: "Quel jeu chinois a influencé les échecs ?", options: ["Xiangqi", "Go", "Mahjong", "Weiqi"], reponse_correcte: "Xiangqi" },
        { question: "Quel jeu a été joué par les Incas ?", options: ["Pachisi", "Tumbala", "Ludo", "Parcheesi"], reponse_correcte: "Tumbala" },
        { question: "Quel jeu a été créé en 1904 par Elizabeth Magie ?", options: ["The Landlord's Game", "Monopoly", "Risk", "Cluedo"], reponse_correcte: "The Landlord's Game" },
        { question: "Quel jeu a été popularisé en Europe au 13e siècle ?", options: ["Chess", "Go", "Backgammon", "Senet"], reponse_correcte: "Chess" },
        { question: "Quel jeu utilisait des pierres dans l'Antiquité grecque ?", options: ["Petteia", "Senet", "Go", "Ludus"], reponse_correcte: "Petteia" }
      ]
    },
    {
      id_quizz: 2,
      title: "Stratégies de Jeux",
      concept: "Testez vos compétences sur les règles et les stratégies des jeux de société classiques.",
      questions: [
        { question: "Combien de cases un cavalier peut-il parcourir aux échecs ?", options: ["2", "3", "4", "6"], reponse_correcte: "3" },
        { question: "Combien de ressources y a-t-il dans Catan ?", options: ["4", "5", "6", "7"], reponse_correcte: "5" },
        { question: "Combien de maisons faut-il pour un hôtel dans Monopoly ?", options: ["2", "3", "4", "5"], reponse_correcte: "4" },
        { question: "Combien de territoires faut-il conquérir pour gagner à Risk ?", options: ["10", "20", "42", "50"], reponse_correcte: "42" },
        { question: "Combien de points vaut une ville complète à Carcassonne ?", options: ["5", "10", "15", "20"], reponse_correcte: "10" },
        { question: "Quelle lettre donne le plus de points au Scrabble ?", options: ["Q", "Z", "J", "X"], reponse_correcte: "Q" },
        { question: "Combien de cartes faut-il pour une route de 6 dans Ticket to Ride ?", options: ["4", "5", "6", "7"], reponse_correcte: "6" },
        { question: "Combien de tours y a-t-il dans 7 Wonders ?", options: ["2", "3", "4", "5"], reponse_correcte: "3" },
        { question: "Combien de cartes de base dans Dominion ?", options: ["7", "10", "12", "15"], reponse_correcte: "10" },
        { question: "Combien de joueurs maximum dans Pandemic ?", options: ["3", "4", "5", "6"], reponse_correcte: "4" },
        { question: "Combien de suspects dans Cluedo ?", options: ["5", "6", "7", "8"], reponse_correcte: "6" },
        { question: "Combien de dés attaque-t-on avec 3 armées dans Risk ?", options: ["1", "2", "3", "4"], reponse_correcte: "3" },
        { question: "Quel nombre est le plus rare sur les tuiles de Catan ?", options: ["6", "8", "9", "12"], reponse_correcte: "12" },
        { question: "Combien de meeples par joueur dans Carcassonne ?", options: ["5", "7", "9", "11"], reponse_correcte: "7" },
        { question: "Combien de points pour une route de 6 dans Ticket to Ride ?", options: ["6", "10", "15", "20"], reponse_correcte: "15" },
        { question: "Combien de cartes par âge dans 7 Wonders ?", options: ["5", "7", "9", "11"], reponse_correcte: "7" },
        { question: "Combien de cartes dans un deck initial de Dominion ?", options: ["7", "10", "12", "15"], reponse_correcte: "10" },
        { question: "Combien de cartes ville au départ dans Pandemic ?", options: ["3", "4", "5", "6"], reponse_correcte: "4" },
        { question: "Combien de pièces à conviction dans Cluedo ?", options: ["18", "21", "24", "27"], reponse_correcte: "21" },
        { question: "Combien de cartes bonus pour 3 territoires dans Risk ?", options: ["2", "4", "6", "8"], reponse_correcte: "4" }
      ]
    },
    {
      id_quizz: 3,
      title: "Jeux Modernes",
      concept: "Découvrez les jeux et tendances qui marquent l'ère contemporaine des jeux de société.",
      questions: [
        { question: "Quel jeu a remporté le Spiel des Jahres en 2019 ?", options: ["Wingspan", "Azul", "Carcassonne", "Ticket to Ride"], reponse_correcte: "Wingspan" },
        { question: "Quel jeu utilise des oiseaux comme thème principal ?", options: ["Wingspan", "Everdell", "Kingdomino", "Azul"], reponse_correcte: "Wingspan" },
        { question: "Quel jeu moderne a un thème de construction de ville avec des arbres ?", options: ["Everdell", "Carcassonne", "Azul", "Puerto Rico"], reponse_correcte: "Everdell" },
        { question: "Quel jeu utilise des tuiles de couleur pour un palais ?", options: ["Azul", "Dominion", "Pandemic", "7 Wonders"], reponse_correcte: "Azul" },
        { question: "Quel jeu traite de la terraformation de Mars ?", options: ["Terraforming Mars", "Pandemic", "Forbidden Stars", "Eclipse"], reponse_correcte: "Terraforming Mars" },
        { question: "Qui a conçu Wingspan ?", options: ["Elizabeth Hargrave", "Antoine Bauza", "Reiner Knizia", "Uwe Rosenberg"], reponse_correcte: "Elizabeth Hargrave" },
        { question: "Quel jeu moderne utilise des meeples en bois pour des fermes ?", options: ["Carcassonne", "Wingspan", "Azul", "Terraforming Mars"], reponse_correcte: "Carcassonne" },
        { question: "Quel jeu a un thème de course de pirates ?", options: ["Jamaica", "Dead Men Tell No Tales", "Pirates Cove", "SeaFall"], reponse_correcte: "Jamaica" },
        { question: "Quel jeu moderne traite des zombies ?", options: ["Zombicide", "Pandemic", "Dead of Winter", "Last Night on Earth"], reponse_correcte: "Zombicide" },
        { question: "Quel jeu utilise des cubes pour construire sur Mars ?", options: ["Catan", "Terraforming Mars", "Wingspan", "Azul"], reponse_correcte: "Terraforming Mars" },
        { question: "Quel jeu a un thème de chemins de fer ?", options: ["Ticket to Ride", "Railways of the World", "Steam", "TransAmerica"], reponse_correcte: "Ticket to Ride" },
        { question: "Quel jeu a été publié en 2016 ?", options: ["Azul", "Wingspan", "Terraforming Mars", "Everdell"], reponse_correcte: "Terraforming Mars" },
        { question: "Quel jeu utilise des dés pour des actions de construction ?", options: ["Azul", "Kingsburg", "Wingspan", "Carcassonne"], reponse_correcte: "Kingsburg" },
        { question: "Quel jeu a un thème de jardinage avec des écureuils ?", options: ["Everdell", "Wingspan", "Arboretum", "Sakura"], reponse_correcte: "Everdell" },
        { question: "Quel jeu moderne simule une civilisation ?", options: ["7 Wonders", "Through the Ages", "Civilization", "Nations"], reponse_correcte: "Through the Ages" },
        { question: "Quel jeu utilise des cartes pour des pouvoirs royaux ?", options: ["Dominion", "7 Wonders", "Race for the Galaxy", "Star Realms"], reponse_correcte: "Dominion" },
        { question: "Quel jeu a un thème de survie en hiver ?", options: ["Dead of Winter", "Pandemic", "Zombicide", "Forbidden Desert"], reponse_correcte: "Dead of Winter" },
        { question: "Qui a créé 7 Wonders ?", options: ["Antoine Bauza", "Elizabeth Hargrave", "Reiner Knizia", "Uwe Rosenberg"], reponse_correcte: "Antoine Bauza" },
        { question: "Quel jeu utilise des tuiles hexagonales pour des îles ?", options: ["Catan", "Terraforming Mars", "Azul", "Wingspan"], reponse_correcte: "Catan" },
        { question: "Quel jeu moderne est un mystère collaboratif ?", options: ["Sherlock Holmes", "Mysterium", "Cluedo", "Deception: Murder in Hong Kong"], reponse_correcte: "Mysterium" }
      ]
    }
  ];

  fetch('http://localhost:3000/api/quizz')
    .then(response => {
      if (!response.ok) throw new Error('Erreur lors de la récupération des quizz: ' + response.statusText);
      return response.json();
    })
    .then(data => {
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Les données de l\'API sont vides ou invalides.');
      }

      // Regrouper les questions par id_quizz
      const groupedQuizzes = {};
      data.forEach(item => {
        if (!groupedQuizzes[item.id_quizz]) {
          groupedQuizzes[item.id_quizz] = {
            id_quizz: item.id_quizz,
            title: item.title || `Quizz ${item.id_quizz} - Jeux de Société`,
            concept: item.concept || `Testez vos connaissances sur les jeux de société (Quizz ${item.id_quizz}).`,
            questions: []
          };
        }
        groupedQuizzes[item.id_quizz].questions.push({
          question: item.question,
          reponse_correcte: item.reponse_correcte,
          options: item.options || generateRandomOptions(item.reponse_correcte)
        });
      });

      // Vérifier si les données de l'API contiennent des questions variées
      const apiQuizzes = Object.values(groupedQuizzes);
      const hasVariety = apiQuizzes.every(quiz => {
        const questions = quiz.questions.map(q => q.question);
        return new Set(questions).size === questions.length && questions.length >= 20;
      });

      if (!hasVariety) {
        console.warn('Les données de l\'API ne contiennent pas assez de questions variées. Utilisation des données par défaut.');
        quizzes = defaultQuizzes;
      } else {
        quizzes = apiQuizzes.map(quiz => {
          quiz.questions = quiz.questions.slice(0, 20); // Limiter à 20 questions
          return quiz;
        });
      }

      displayQuizList();
    })
    .catch(error => {
      console.error('Erreur:', error.message);
      quizzes = defaultQuizzes;
      displayQuizList();
      document.getElementById('quizzError').textContent = 'Erreur lors du chargement des quizz. Utilisation de données par défaut.';
    });

  function displayQuizList() {
    const quizContainer = document.getElementById('quizContainer');
    quizContainer.innerHTML = '<div id="quizList" class="quiz-list"></div>';
    const quizList = document.getElementById('quizList');
    if (quizzes.length === 0) {
      quizContainer.innerHTML = '<p>Aucun quizz disponible.</p>';
      return;
    }
    quizzes.forEach((quiz, index) => {
      const quizItem = document.createElement('div');
      quizItem.className = 'quiz-item';
      quizItem.innerHTML = `
        <h3>${quiz.title}</h3>
        <p>${quiz.concept}</p>
        <button class="start-quiz-button" data-index="${index}">Commencer</button>
      `;
      quizList.appendChild(quizItem);
    });

    // Attacher les écouteurs d'événements aux boutons
    document.querySelectorAll('.start-quiz-button').forEach(button => {
      button.addEventListener('click', () => {
        const index = parseInt(button.getAttribute('data-index'));
        startQuiz(index);
      });
    });
  }

  window.startQuiz = function(index) {
    currentQuiz = quizzes[index];
    currentQuestionIndex = 0;
    score = 0;
    document.getElementById('quizList').style.display = 'none';
    displayQuestion();
  };

  function displayQuestion() {
    if (!currentQuiz || !currentQuiz.questions || currentQuestionIndex >= 20 || currentQuestionIndex >= currentQuiz.questions.length) {
      endQuiz();
      return;
    }
    const question = currentQuiz.questions[currentQuestionIndex];
    const quizContainer = document.getElementById('quizContainer');
    quizContainer.innerHTML = `
      <h3>Question ${currentQuestionIndex + 1} / 20 - ${currentQuiz.title}</h3>
      <p>${question.question || 'Question non disponible'}</p>
      <div id="options">
        ${Array.isArray(question.options) ? question.options.map(option => `<button class="option-button" data-option="${option}">${option || 'Option vide'}</button>`).join('') : '<p>Options non disponibles</p>'}
      </div>
      <div id="quizzError"></div>
    `;

    // Attacher les écouteurs d'événements aux boutons d'options
    document.querySelectorAll('.option-button').forEach(button => {
      button.addEventListener('click', () => {
        const selectedOption = button.getAttribute('data-option');
        checkAnswer(question.reponse_correcte, selectedOption);
      });
    });
  }

  window.checkAnswer = function(correctAnswer, selectedAnswer) {
    if (selectedAnswer === correctAnswer) score++;
    currentQuestionIndex++;
    displayQuestion();
  };

  function endQuiz() {
    const quizContainer = document.getElementById('quizContainer');
    const totalQuestions = Math.min(20, currentQuiz.questions.length);
    const percentage = (score / totalQuestions) * 100;
    let judgment = '';
    if (percentage >= 90) judgment = 'Excellent ! Vous êtes un maître des jeux de société !';
    else if (percentage >= 70) judgment = 'Très bien ! Vous avez une bonne connaissance.';
    else if (percentage >= 50) judgment = 'Pas mal ! Vous pouvez encore améliorer.';
    else judgment = 'Il faudra réviser, mais ne vous découragez pas !';

    quizContainer.innerHTML = `
      <h3>Votre Score - ${currentQuiz.title}</h3>
      <p>Votre score : ${score} / ${totalQuestions} (${percentage.toFixed(1)}%)</p>
      <p>${judgment}</p>
      <button class="restart-button">Recommencer</button>
    `;

    document.querySelector('.restart-button').addEventListener('click', () => {
      location.reload();
    });

    const token = localStorage.getItem('token');
    if (token) {
      const decodedToken = parseJwt(token);
      const userId = decodedToken.id; // Extraire l'ID utilisateur depuis le token
      if (!userId) {
        console.error('ID utilisateur non trouvé dans le token');
        return;
      }
      fetch('http://localhost:3000/api/participation-quizz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          idQuizz: currentQuiz.id_quizz,
          idUtilisateur: userId,
          scoreObtenu: score
        })
      })
        .then(response => {
          if (!response.ok) throw new Error('Erreur lors de l\'enregistrement du score: ' + response.statusText);
          return response.json();
        })
        .then(data => console.log('Score enregistré:', data))
        .catch(error => console.error('Erreur lors de l\'enregistrement du score:', error));
    }
  }
});