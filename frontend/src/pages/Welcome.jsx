import { Link as RouterLink } from 'react-router-dom';

const Welcome = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-8">
          Welcome to Prompt Superpower
        </h1>
        <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
          Your AI-powered platform for creating, testing, and optimizing prompts.
          Get started by creating an account or logging in.
        </p>
        <div className="space-x-4">
          <RouterLink
            to="/signup"
            className="inline-block px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign Up
          </RouterLink>
          <RouterLink
            to="/login"
            className="inline-block px-8 py-4 border-2 border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
          >
            Login
          </RouterLink>
        </div>
      </div>
    </div>
  );
};

export default Welcome; 