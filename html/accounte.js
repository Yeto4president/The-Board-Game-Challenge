document.addEventListener('DOMContentLoaded', () => {
    // Onglets
    document.getElementById('registerTab').addEventListener('click', () => {
      document.getElementById('registerForm').style.display = 'block';
      document.getElementById('loginForm').style.display = 'none';
      document.getElementById('registerTab').classList.add('active');
      document.getElementById('loginTab').classList.remove('active');
    });

    document.getElementById('loginTab').addEventListener('click', () => {
      document.getElementById('registerForm').style.display = 'none';
      document.getElementById('loginForm').style.display = 'block';
      document.getElementById('loginTab').classList.add('active');
      document.getElementById('registerTab').classList.remove('active');
    });

    // Inscription
    document.getElementById('registerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const pseudo = document.getElementById('registerPseudo').value;
      const email = document.getElementById('registerEmail').value;
      const password = document.getElementById('registerPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (password !== confirmPassword) {
        alert('Les mots de passe ne correspondent pas.');
        return;
      }

      fetch('http://localhost:3000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo, email, password })
      })
        .then(response => response.json())
        .then(data => {
          if (data.message) {
            alert(data.message);
            if (data.token) {
              localStorage.setItem('token', data.token);
              localStorage.setItem('userId', data.userId);
              window.location.href = 'accueil.html';
            }
          }
        })
        .catch(error => {
          console.error('Erreur lors de l\'inscription:', error);
          alert('Erreur lors de l\'inscription.');
        });
    });

    // Connexion
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;

      fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
        .then(response => response.json())
        .then(data => {
          if (data.token) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('userId', data.userId);
            alert('Connexion réussie !');
            window.location.href = 'accueil.html';
          } else {
            alert(data.message || 'Erreur lors de la connexion.');
          }
        })
        .catch(error => {
          console.error('Erreur lors de la connexion:', error);
          alert('Erreur lors de la connexion.');
        });
    });
  });