import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

// Placeholder for actual model fetching
const availableModels = [
  { id: 'astria-sdxl-1.0', name: 'Astria SDXL 1.0' },
  { id: 'stable-diffusion-2.1', name: 'Stable Diffusion 2.1' },
  { id: 'dall-e-3', name: 'DALL-E 3' },
];

const Prompts = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [prompts, setPrompts] = useState([]); 
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [selectedPrompts, setSelectedPrompts] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null); // For displaying errors

  const getToken = () => localStorage.getItem('token');

  // Fetch prompts
  useEffect(() => {
    const fetchPrompts = async () => {
      if (!projectId) return;
      setIsLoadingPrompts(true);
      setError(null); // Clear previous errors
      try {
        const token = getToken();
        if (!token) throw new Error('No auth token found');
        const response = await axios.get(`http://localhost:3001/api/projects/${projectId}/prompts`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPrompts(response.data);
      } catch (err) {
        console.error('Error fetching prompts:', err);
        setError(err.response?.data?.message || err.message || 'Failed to fetch prompts');
        if (err.response?.status === 401 || err.message === 'No auth token found') {
          navigate('/login');
        }
        setPrompts([]); 
      } finally {
        setIsLoadingPrompts(false);
      }
    };
    fetchPrompts();
  }, [projectId, navigate]);

  // --- CRUD Handlers with API calls ---

  const handleFavorite = async (id, currentIsFavorite) => {
    const newIsFavorite = !currentIsFavorite;
    // Optimistic UI update
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, isFavorite: newIsFavorite } : p));
    setError(null);
    try {
      const token = getToken();
      await axios.put(`http://localhost:3001/api/projects/${projectId}/prompts/${id}`, 
        { isFavorite: newIsFavorite },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Optional: Refetch or update state based on response if needed
    } catch (err) {
      console.error('Error updating favorite status:', err);
      setError(err.response?.data?.message || 'Failed to update favorite status');
      // Revert optimistic update on error
      setPrompts(prev => prev.map(p => p.id === id ? { ...p, isFavorite: currentIsFavorite } : p));
    }
  };

  const handleEdit = (id) => {
    const prompt = prompts.find(p => p.id === id);
    setEditingId(id);
    setEditContent(prompt.content);
  };

  const handleSave = async (id) => {
    const originalPrompt = prompts.find(p => p.id === id);
    if (!originalPrompt) return;
    const originalContent = originalPrompt.content;

    // Optimistic UI update
    setPrompts(prev => prev.map(p => 
      p.id === id ? { ...p, content: editContent, updatedAt: new Date().toISOString() } : p
    ));
    setEditingId(null);
    setError(null);

    try {
      const token = getToken();
      await axios.put(`http://localhost:3001/api/projects/${projectId}/prompts/${id}`, 
        { content: editContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.error('Error saving prompt:', err);
      setError(err.response?.data?.message || 'Failed to save prompt');
      // Revert optimistic update on error
      setPrompts(prev => prev.map(p => 
        p.id === id ? { ...p, content: originalContent, updatedAt: originalPrompt.updatedAt } : p
      ));
    }
  };

  const handleDelete = async (id) => {
    const originalPrompts = [...prompts];
    // Optimistic UI update
    setPrompts(prev => prev.filter(p => p.id !== id));
    setSelectedPrompts(prev => prev.filter(promptId => promptId !== id));
    setError(null);

    try {
      const token = getToken();
      await axios.delete(`http://localhost:3001/api/projects/${projectId}/prompts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Error deleting prompt:', err);
      setError(err.response?.data?.message || 'Failed to delete prompt');
      // Revert optimistic update on error
      setPrompts(originalPrompts);
    }
  };

  const handleSelect = (id) => {
    setSelectedPrompts(prevSelected => {
      if (prevSelected.includes(id)) {
        return prevSelected.filter(promptId => promptId !== id);
      } else {
        return [...prevSelected, id];
      }
    });
  };

  const handleGenerateImages = async () => {
    setIsGenerating(true);
    setError(null);
    const promptsToGenerate = prompts.filter(p => selectedPrompts.includes(p.id));
    const openaiApiKey = localStorage.getItem('openaiApiKey');
    const astriaApiKey = localStorage.getItem('astriaApiKey');
    const token = getToken();

    // Pre-flight checks
    if (!token) {
      setError('Authentication error. Please log in again.');
      setIsGenerating(false);
      navigate('/login');
      return;
    }

    if (selectedModel.includes('astria') && !astriaApiKey) {
      setError('Astria API Key not found. Please set it via the API Key page.');
      setIsGenerating(false);
      navigate('/api-key');
      return;
    }

    if (!selectedModel.includes('astria') && !openaiApiKey) {
      setError('OpenAI API Key not found. Please set it via the API Key page.');
      setIsGenerating(false);
      navigate('/api-key');
      return;
    }

    if (promptsToGenerate.length === 0) {
      setError('No prompts selected for generation.');
      setIsGenerating(false);
      return;
    }

    if (!selectedModel) {
      setError('No generation model selected.');
      setIsGenerating(false);
      return;
    }

    console.log(`Starting image generation request for project ${projectId} with model ${selectedModel}`);

    try {
      // Make the actual API call to the backend
      const response = await axios.post(
        `http://localhost:3001/api/projects/${projectId}/generate-images`,
        { 
          modelId: selectedModel, 
          prompts: promptsToGenerate.map(p => p.content)
        }, 
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'X-OpenAI-API-Key': openaiApiKey,
            'X-Astria-API-Key': astriaApiKey
          } 
        }
      );

      console.log('Image generation response from backend:', response.data);
      
      // --- Handle Backend Response --- 
      const successfulGenerations = response.data?.filter(r => !r.error && r.imageUrl) || [];
      const failedGenerations = response.data?.filter(r => r.error) || [];
      
      let alertMessage = `Image generation process finished.`;
      if (successfulGenerations.length > 0) {
        alertMessage += ` ${successfulGenerations.length} images generated successfully.`;
      }
      if (failedGenerations.length > 0) {
        alertMessage += ` ${failedGenerations.length} prompts failed. Check console for details.`;
        console.warn('Failed Generations:', failedGenerations);
      }
      alert(alertMessage);
      
      // Navigate to the results page regardless of partial failures
      navigate(`/results/${projectId}`); 

    } catch (err) {
      console.error('Error during image generation API call:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Failed to start or complete image generation task.');
    } finally {
      setIsGenerating(false);
    }
  };

  // --- Render Logic ---

  if (isLoadingPrompts) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading prompts...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Review & Select Prompts</h1>
        <p className="text-sm text-gray-500 mb-8">Project ID: {projectId}</p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {prompts.length === 0 && !isLoadingPrompts ? (
          <p className="text-center text-gray-500 py-10">No prompts found for this project. You might need to generate some first.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
              {prompts.map((prompt) => {
                const isSelected = selectedPrompts.includes(prompt.id);
                return (
                  <div
                    key={prompt.id}
                    className={`bg-white rounded-lg shadow-md p-4 border-2 flex flex-col ${ 
                      isSelected ? 'border-blue-500' : 'border-transparent'
                    }`}
                  >
                    {editingId === prompt.id ? (
                      // Edit mode JSX
                      <div className="space-y-3">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          rows={4}
                        />
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSave(prompt.id)}
                            className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode JSX
                      <>
                        <p className="text-sm text-gray-700 flex-grow mb-3">{prompt.content}</p>
                        <div className="flex justify-between items-center mt-auto pt-3 border-t border-gray-100">
                          <div className="flex space-x-1">
                            {/* Action Buttons: Favorite, Edit, Delete */}
                            <button
                              onClick={() => handleFavorite(prompt.id, prompt.isFavorite)}
                              title="Favorite"
                              className={`p-1.5 rounded-full ${ 
                                prompt.isFavorite ? 'text-yellow-500 bg-yellow-100' : 'text-gray-400' 
                              } hover:text-yellow-500 hover:bg-yellow-50`}
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleEdit(prompt.id)}
                              title="Edit"
                              className="p-1.5 text-gray-400 rounded-full hover:text-blue-500 hover:bg-blue-50"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(prompt.id)}
                              title="Delete"
                              className="p-1.5 text-gray-400 rounded-full hover:text-red-500 hover:bg-red-50"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                           {/* Select Button */}
                          <button
                            onClick={() => handleSelect(prompt.id)}
                            className={`px-3 py-1 text-xs font-medium rounded-md ${ 
                              isSelected 
                                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                            }`}
                          >
                            {isSelected ? 'Selected' : 'Select'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

             {/* Generation Settings Section */}
            <div className="bg-white p-6 rounded-lg shadow-md mt-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Generation Settings</h2>
              <div className="mb-4">
                <label htmlFor="modelSelect" className="block text-sm font-medium text-gray-700 mb-1">
                  Select Generation Model
                </label>
                <select 
                  id="modelSelect"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="" disabled>-- Choose a model --</option>
                  {availableModels.map(model => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleGenerateImages}
                disabled={selectedPrompts.length === 0 || !selectedModel || isGenerating}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? 'Starting Generation...' : `Generate Images (${selectedPrompts.length} selected)`}
              </button>
              {selectedPrompts.length === 0 && <p className="text-xs text-red-500 mt-1">Please select at least one prompt.</p>}
              {!selectedModel && <p className="text-xs text-red-500 mt-1">Please select a model.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Prompts; 