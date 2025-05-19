# The-Board-Game-Challenge

## Overview
Boardgame is a web application designed for board game enthusiasts. It allows users to explore an online game library, view game details, rate and comment on games, participate in quizzes, and vote for their favorite games. The project is currently in development, featuring a static front-end (HTML/CSS) and a back-end built with Node.js and MySQL.

## Features
- Display a list of available games.
- View game details (name, genre, average rating, etc.).
- Rate and comment on games (pending full implementation).
- Participate in game-related quizzes.
- Propose new games (with admin validation).
- Vote for games.
- Upload images for proposed games.

## Prerequisites
- **Node.js** and **npm** installed.
- **MySQL** set up with the database initialized.
- A local development environment (e.g., text editor, terminal).

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/boardgamearena.git
cd boardgamearena
```
### 2. Install Dependencies
```bash
npm install
```
### 3. Set Up the Database
- Create a MySQL database named boardgamearena.
- Run the SQL script initialize_boardgamearena.sql to set up tables and initial data.
- Update the db.js file with your MySQL credentials (host, user, password, database).
### 4. Start the Server
```bash
node server.js
```
The server will be available at http://localhost:3000.

### 5. Serve the Front-End
- Place index.html and styles.css in a public folder.
- Ensure server.js serves this folder with app.use(express.static('public'));.
- Open http://localhost:3000 in your browser.
## Usage
- The main page (index.html) displays a list of games fetched via the GET /api/jeux API endpoint.
- Features like authentication (login, registration) and interactions (comments, votes) require forms to be implemented.
- Admins can validate pending games and comments using dedicated API routes.
## Development
### Technologies Used
- Front-End: HTML5, CSS3 (currently static, with plans to integrate JavaScript/React).
- Back-End: Node.js with Express.js, MySQL (via mysql2/promise).
- Others: JWT for authentication, Multer for image uploads.
### Project Structure
- server.js: Main server file with API routes.
- db.js: Database connection and query logic.
- public/: Folder containing front-end files (index.html, styles.css).
- uploads/: Folder for storing uploaded images.
### Database Schema
- Utilisateur: Stores user information (ID, pseudo, email, password, role).
- Jeux: Stores game details (ID, name, description, genre, etc.).
- JeuxEnAttente: Stores proposed games awaiting validation.
- Quizz: Stores quiz questions.
- Participation_Quizz: Stores quiz participation records.
- Commentaire: Stores game comments.
- Likes: Stores likes for games.
- Notation: Stores game ratings.
- Votes: Stores votes for games.
### API Endpoints
- GET /api/jeux: Fetch all games.
- POST /api/login: User login with JWT token generation.
- POST /api/register: Register a new user.
- POST /api/comment: Add a comment (requires authentication).
- POST /api/notation: Rate a game.
- POST /api/vote: Vote for a game.
- POST /api/propose-game: Propose a new game.
- GET /api/pending-games: Fetch pending games (admin only).
- POST /api/validate-game/:id: Approve/reject a proposed game (admin only).
### To-Do
- Add HTML forms for login and user interactions (e.g., ratings, comments).
- Integrate JavaScript for dynamic API calls.
- Transition to React for a more dynamic front-end.
- Encrypt passwords using bcrypt in the database.
- Add a Location table to manage game rentals.
## Contributing
Contributions are welcome! Please follow these steps:

- 1.Fork the repository.
- 2.Create a new branch (git checkout -b feature/your-feature).
- 3.Commit your changes (git commit -m "Add your feature").
- 4.Push to the branch (git push origin feature/your-feature).
- 5.Open a pull request.



