import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const ProjectBrief = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [brief, setBrief] = useState('');
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const getToken = () => localStorage.getItem('token');

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const currentImageCount = images.length;
    const allowedNewFiles = Math.max(0, 10 - currentImageCount);
    if (files.length > allowedNewFiles) {
        alert(`You can only upload ${allowedNewFiles} more image(s). Max 10 allowed.`);
    }

    const newImages = files.slice(0, allowedNewFiles).map(file => ({
      id: URL.createObjectURL(file) + '-' + file.name,
      file,
      preview: URL.createObjectURL(file),
      tags: ''
    }));
    setImages(prevImages => [...prevImages, ...newImages]);
    
    e.target.value = null;
  };

  const handleTagChange = (imageId, newTagString) => {
    setImages(prevImages => 
      prevImages.map(image => 
        image.id === imageId ? { ...image, tags: newTagString } : image
      )
    );
  };
  
  const handleRemoveImage = (imageId) => {
    const imageToRemove = images.find(img => img.id === imageId);
    if (imageToRemove) {
      URL.revokeObjectURL(imageToRemove.preview);
    }
    setImages(prevImages => prevImages.filter(image => image.id !== imageId));
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (images.length === 0) {
        alert('Please upload at least one reference image.');
        return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const token = getToken();
      if (!token) throw new Error('Authentication token not found.');

      const projectResponse = await axios.post('http://localhost:3001/api/projects', {
        name,
        description,
        brief
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const projectId = projectResponse.data.id;

      const formData = new FormData();
      images.forEach(image => {
        formData.append('images', image.file);
      });
      
      const tagsArray = images.map(image => 
        image.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      );
      formData.append('tags', JSON.stringify(tagsArray));

      await axios.post(`http://localhost:3001/api/projects/${projectId}/images`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      await axios.post(
        `http://localhost:3001/api/projects/${projectId}/generate-prompts`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-OpenAI-API-Key': localStorage.getItem('openaiApiKey')
          }
        }
      );

      navigate(`/prompts/${projectId}`);
    } catch (err) {
      console.error('Error creating project:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'An error occurred during project creation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Create New Project</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="block text-sm font-medium text-gray-700">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Project Brief</label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              rows={6}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Reference Images (up to 10)</label>
             <p className="text-xs text-gray-500 mb-2">Upload images that represent the style or content you want.</p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
             {images.length === 0 && <p className="text-xs text-red-500 mt-1">Please upload at least one image.</p>}
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((image) => (
                <div key={image.id} className="relative border border-gray-200 rounded-lg p-2 group">
                   <button 
                     type="button"
                     onClick={() => handleRemoveImage(image.id)}
                     className="absolute -top-2 -right-2 z-10 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                     aria-label="Remove image"
                   >
                     X
                   </button>
                  <img
                    src={image.preview}
                    alt={`Reference preview`}
                    className="w-full h-40 object-cover rounded-md mb-2"
                  />
                  <label htmlFor={`tags-${image.id}`} className="sr-only">Tags for image {image.file.name}</label>
                  <input
                    id={`tags-${image.id}`}
                    type="text"
                    placeholder="Add tags (comma separated)"
                    value={image.tags}
                    onChange={(e) => handleTagChange(image.id, e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-1.5"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || images.length === 0}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating Project...' : 'Create Project & Generate Prompts'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProjectBrief; 