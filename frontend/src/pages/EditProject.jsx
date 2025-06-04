import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const EditProject = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [brief, setBrief] = useState('');
  const [existingImages, setExistingImages] = useState([]); // For images already uploaded
  const [newImages, setNewImages] = useState([]); // For newly added images in this edit session
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState(null);

  const getToken = () => localStorage.getItem('token');

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    const fetchProjectData = async () => {
      setIsLoading(true);
      setError(null);
      const token = getToken();
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        // Fetch project details and images in parallel
        const [projectRes, imagesRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/projects/${projectId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_BASE_URL}/api/projects/${projectId}/images`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const projectData = projectRes.data;
        setName(projectData.name);
        setDescription(projectData.description || '');
        setBrief(projectData.brief || '');
        
        // Map existing images to include tags as a string for the input
        setExistingImages(imagesRes.data.map(img => ({
          ...img,
          tags: img.tags.join(', ') // Convert tags array back to comma-separated string
        })));

      } catch (err) {
        console.error('Error fetching project data:', err);
        setError(err.response?.data?.message || 'Failed to load project data.');
        if (err.response?.status === 401 || err.response?.status === 403) {
          navigate('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjectData();
  }, [projectId, navigate]);

  // Handlers for new image uploads (similar to ProjectBrief)
  const handleNewImageUpload = (e) => {
     const files = Array.from(e.target.files);
     const currentTotalImages = existingImages.length + newImages.length;
     const allowedNewFiles = Math.max(0, 10 - currentTotalImages);
     
     if (files.length > allowedNewFiles) {
        alert(`You can only upload ${allowedNewFiles} more image(s). Max 10 total.`);
     }

     const processedNewImages = files.slice(0, allowedNewFiles).map(file => ({
       id: URL.createObjectURL(file) + '-' + file.name, 
       file,
       preview: URL.createObjectURL(file),
       tags: '' 
     }));
     setNewImages(prev => [...prev, ...processedNewImages]);
     e.target.value = null;
  };

  const handleNewImageTagChange = (imageId, newTagString) => {
     setNewImages(prev => 
       prev.map(image => 
         image.id === imageId ? { ...image, tags: newTagString } : image
       )
     );
  };
  
  const handleRemoveNewImage = (imageId) => {
     const imageToRemove = newImages.find(img => img.id === imageId);
     if (imageToRemove) {
       URL.revokeObjectURL(imageToRemove.preview); 
     }
     setNewImages(prev => prev.filter(image => image.id !== imageId));
  }

  // Handlers for existing images (update tags, delete)
  const handleExistingImageTagChange = (imageId, newTagString) => {
    setExistingImages(prev =>
      prev.map(image =>
        image.id === imageId ? { ...image, tags: newTagString } : image
      )
    );
    // TODO: Add backend call to update tags for this specific image later if needed
    // Or, more simply, update all tags when the main project is saved.
  };

  const handleRemoveExistingImage = (imageId) => {
    // TODO: Implement backend call to delete the image record and file
    // For now, just remove from state
    setExistingImages(prev => prev.filter(image => image.id !== imageId));
     alert('Image removal from backend not yet implemented. Removed from view only.');
  };


  // Handler for updating project details
  const handleUpdateProject = async (e) => {
     e.preventDefault();
     setIsUpdating(true);
     setError(null);
     const token = getToken();

     try {
        // 1. Update core project details
        await axios.put(`${API_BASE_URL}/api/projects/${projectId}`, 
          { name, description, brief },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // 2. TODO: Update existing image tags (if changed) - requires backend endpoint
        // 3. TODO: Delete removed existing images - requires backend endpoint
        // 4. TODO: Upload NEW images and their tags - requires backend endpoint

        alert('Project details updated! Image updates/additions not yet implemented.');
        // Optionally navigate back or show success
        // navigate(`/dashboard`);

     } catch (err) {
       console.error('Error updating project:', err);
       setError(err.response?.data?.message || 'Failed to update project.');
     } finally {
       setIsUpdating(false);
     }
  };

  // Handler for regenerating prompts
  const handleRegeneratePrompts = async () => {
     if (!window.confirm('Are you sure you want to regenerate prompts? This may add duplicates if old prompts are not cleared first.')) {
         return;
     }
     setIsRegenerating(true);
     setError(null);
     const token = getToken();

     try {
       // Call the existing generate-prompts endpoint
       const response = await axios.post(
         `${API_BASE_URL}/api/projects/${projectId}/generate-prompts`,
         {},
         {
           headers: {
             Authorization: `Bearer ${token}`,
             'X-OpenAI-API-Key': localStorage.getItem('openaiApiKey')
           }
         }
       );
       alert(`Successfully regenerated ${response.data.length} prompts!`);
       // Navigate to prompts page to view them
       navigate(`/prompts/${projectId}`);

     } catch (err) {
        console.error('Error regenerating prompts:', err);
        setError(err.response?.data?.message || 'Failed to regenerate prompts.');
     } finally {
        setIsRegenerating(false);
     }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading project details...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Edit Project: {name}</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form onSubmit={handleUpdateProject} className="space-y-8 mb-10">
          {/* Project Name, Description, Brief inputs */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Project Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Project Brief</label>
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" rows={6} required />
          </div>

          {/* Existing Images Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">Existing Reference Images</h2>
            {existingImages.length === 0 ? (
                 <p className="text-sm text-gray-500">No existing images.</p>
            ) : (
                 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {existingImages.map((image) => (
                        <div key={image.id} className="relative border border-gray-200 rounded-lg p-2 group">
                           <button 
                             type="button"
                             onClick={() => handleRemoveExistingImage(image.id)}
                             className="absolute -top-2 -right-2 z-10 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                             aria-label="Remove image (backend TODO)"
                             title="Remove image (backend not implemented)"
                           >
                             X
                           </button>
                          <img src={`http://localhost:3001${image.url}`} // Assuming backend serves uploads correctly
                               alt={`Existing reference ${image.originalName}`}
                               className="w-full h-40 object-cover rounded-md mb-2"/>
                          <label htmlFor={`tags-existing-${image.id}`} className="sr-only">Tags for {image.originalName}</label>
                          <input
                            id={`tags-existing-${image.id}`}
                            type="text"
                            placeholder="Add tags (comma separated)"
                            value={image.tags}
                            onChange={(e) => handleExistingImageTagChange(image.id, e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-1.5"
                          />
                        </div>
                    ))}
                 </div>
            )}
          </div>

          {/* Add New Images Section */}
           <div className="space-y-4">
             <h2 className="text-lg font-medium text-gray-900">Add New Reference Images</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700">Upload New Images (max 10 total)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleNewImageUpload}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  disabled={(existingImages.length + newImages.length) >= 10}
                />
                 {(existingImages.length + newImages.length) >= 10 && <p className="text-xs text-red-500 mt-1">Maximum number of images reached.</p>}
              </div>
               {/* New Image Previews */}
              {newImages.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {newImages.map((image) => (
                    <div key={image.id} className="relative border border-gray-200 rounded-lg p-2 group">
                       <button 
                         type="button"
                         onClick={() => handleRemoveNewImage(image.id)}
                          className="absolute -top-2 -right-2 z-10 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                         aria-label="Remove new image"
                       >
                         X
                       </button>
                      <img src={image.preview} alt="New reference preview" className="w-full h-40 object-cover rounded-md mb-2"/>
                      <label htmlFor={`tags-new-${image.id}`} className="sr-only">Tags for new image {image.file.name}</label>
                      <input
                        id={`tags-new-${image.id}`}
                        type="text"
                        placeholder="Add tags (comma separated)"
                        value={image.tags}
                        onChange={(e) => handleNewImageTagChange(image.id, e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-1.5"
                      />
                    </div>
                  ))}
                </div>
              )}
           </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isUpdating || isRegenerating}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            {isUpdating ? 'Saving Changes...' : 'Save Project Changes'}
          </button>
        </form>
        
         {/* Regenerate Prompts Section */}
         <div className="mt-10 pt-6 border-t">
             <h2 className="text-xl font-semibold text-gray-800 mb-3">Generate Prompts</h2>
             <p className="text-sm text-gray-600 mb-4">
                 Regenerate prompts based on the current brief and images. Note: This currently adds new prompts; it doesn't replace existing ones.
             </p>
             <button
                 onClick={handleRegeneratePrompts}
                 disabled={isUpdating || isRegenerating}
                 className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
               >
                 {isRegenerating ? 'Regenerating...' : 'Regenerate Prompts'}
             </button>
         </div>

         <div className="mt-6 text-center">
            <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-600 hover:underline">
                Cancel and return to Dashboard
            </button>
         </div>

      </div>
    </div>
  );
};

export default EditProject; 