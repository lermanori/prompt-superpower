# Prompt Superpower

A full-stack web application for managing and automating AI image generation prompts.

## Features

- User authentication and authorization
- Project management for AI image generation
- Prompt management and organization
- Image upload and processing
- Results tracking and visualization
- Modern, responsive UI built with React and Chakra UI

## Tech Stack

### Frontend
- React
- Vite
- Chakra UI
- Axios for API calls
- React Router for navigation

### Backend
- Node.js
- Express.js
- File system storage
- Authentication middleware

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/prompt-superpower.git
cd prompt-superpower
```

2. Install frontend dependencies:
```bash
cd frontend
npm install
```

3. Install backend dependencies:
```bash
cd ../backend
npm install
```

4. Create a `.env` file in the backend directory with the following variables:
```
PORT=3000
JWT_SECRET=your_jwt_secret
```

5. Start the development servers:

Frontend:
```bash
cd frontend
npm run dev
```

Backend:
```bash
cd backend
npm start
```

The frontend will be available at `http://localhost:5173` and the backend at `http://localhost:3000`.

## Deployment

The frontend is configured for deployment on GitHub Pages. The backend can be deployed on any Node.js hosting platform like Heroku, Railway, or Render.

## License

MIT