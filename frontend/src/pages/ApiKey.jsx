import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ApiKey = () => {
  const navigate = useNavigate();
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [astriaApiKey, setAstriaApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load saved API keys if they exist
    const savedOpenaiKey = localStorage.getItem('openaiApiKey');
    const savedAstriaKey = localStorage.getItem('astriaApiKey');
    if (savedOpenaiKey) setOpenaiApiKey(savedOpenaiKey);
    if (savedAstriaKey) setAstriaApiKey(savedAstriaKey);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Save API keys to localStorage
      localStorage.setItem('openaiApiKey', openaiApiKey);
      localStorage.setItem('astriaApiKey', astriaApiKey);
      
      // Test the OpenAI API key
      const openaiResponse = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`
        }
      });

      if (!openaiResponse.ok) {
        throw new Error('Invalid OpenAI API key');
      }

      // Test the Astria API key
      const astriaResponse = await fetch('https://api.astria.ai/v1/models', {
        headers: {
          'Authorization': `Bearer ${astriaApiKey}`
        }
      });

      if (!astriaResponse.ok) {
        throw new Error('Invalid Astria API key');
      }

      // Navigate to dashboard on success
      navigate('/dashboard');
    } catch (error) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Enter Your API Keys
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Your API keys will be stored securely in your browser's localStorage
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="openaiApiKey" className="block text-sm font-medium text-gray-700">
                OpenAI API Key
              </label>
              <div className="mt-1">
                <input
                  id="openaiApiKey"
                  name="openaiApiKey"
                  type="password"
                  required
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="sk-..."
                />
              </div>
            </div>

            <div>
              <label htmlFor="astriaApiKey" className="block text-sm font-medium text-gray-700">
                Astria API Key
              </label>
              <div className="mt-1">
                <input
                  id="astriaApiKey"
                  name="astriaApiKey"
                  type="password"
                  required
                  value={astriaApiKey}
                  onChange={(e) => setAstriaApiKey(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="ast-..."
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {isLoading ? 'Verifying...' : 'Save API Keys'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ApiKey; 