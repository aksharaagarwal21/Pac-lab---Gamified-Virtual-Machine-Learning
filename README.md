# PAC-LAB · Gamified Machine Learning Lab

A virtual lab that teaches ten core machine-learning algorithms through interactive simulations, quizzes and a Pac-Man-style level maze.

**[Live demo](https://pac-lab-steel.vercel.app/)**

## Features

- 10 experiments: data pre-processing, linear regression, cross-validation, logistic regression, PCA, SVM, k-means, decision trees, random forests and a perceptron
- Each experiment has theory, an interactive simulation and a quiz game
- In-browser Python editor (Pyodide in a web worker)
- Student accounts with XP, badges and progress tracking
- Faculty dashboard to follow classes and individual students

## Tech stack

React · Vite · TanStack Router · Express · MySQL · Playwright

## Run locally

Requires Node.js 18+ and MySQL 8.

```bash
npm install
```

Create a `.env` file with your database settings:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=pac_lab
SESSION_SECRET=any_long_random_string
```

```bash
npm run db:setup   # creates the tables, sample data and demo accounts
npm run dev:all    # starts the API and the frontend
```

## Tests

```bash
npm test               # unit tests
npm run test:browser   # Playwright browser tests
```

## Deployment

See [DEPLOY.md](DEPLOY.md) for deploying to Vercel with a hosted MySQL database.
