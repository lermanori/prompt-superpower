import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Dashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = getToken();
        if (!token) {
          navigate('/login');
          return;
        }
        const response = await axios.get('http://localhost:3001/api/projects', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProjects(response.data);
      } catch (err) {
        console.error('Error fetching projects:', err);
        setError(err.response?.data?.message || 'Failed to fetch projects');
        if (err.response?.status === 401) {
          navigate('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [navigate]);

  const handleCreateProject = () => {
    navigate('/project/new');
  };

  const handleViewPrompts = (projectId) => {
    navigate(`/prompts/${projectId}`);
  };

  const handleEditProject = (projectId) => {
    navigate(`/project/edit/${projectId}`);
  };

  const handleViewResults = (projectId) => {
    navigate(`/results/${projectId}`);
  };

  const handleDeleteProject = async (projectId, projectName) => {
    if (!window.confirm(`Are you sure you want to delete the project "${projectName}"? This action cannot be undone.`)) {
      return;
    }
    setError(null);
    try {
      const token = getToken();
      await axios.delete(`http://localhost:3001/api/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(prevProjects => prevProjects.filter(p => p.id !== projectId));
    } catch (err) {
      console.error('Error deleting project:', err);
      setError(err.response?.data?.message || 'Failed to delete project');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading projects...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Projects</h1>
          <button
            onClick={handleCreateProject}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Create New Project
          </button>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {projects.length === 0 && !isLoading ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No projects</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new project.</p>
            <div className="mt-6">
              <button
                onClick={handleCreateProject}
                type="button"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Create New Project
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white overflow-hidden shadow rounded-lg flex flex-col"
              >
                <div className="px-4 py-5 sm:p-6 flex-grow">
                  <h3 className="text-lg font-medium text-gray-900">
                    {project.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {project.description || 'No description'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleViewPrompts(project.id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      View Prompts
                    </button>
                    <button
                      onClick={() => handleViewResults(project.id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      View Results
                    </button>
                    <button
                      onClick={() => handleEditProject(project.id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                    >
                      Edit Project
                    </button>
                    <button
                      onClick={() => handleDeleteProject(project.id, project.name)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 border-t border-gray-200">
                  <div className="text-xs text-gray-500">
                    Created on {new Date(project.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard; 