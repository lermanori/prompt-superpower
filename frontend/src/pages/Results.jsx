import { useLocation, useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';

const Results = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [projectName, setProjectName] = useState(''); // State for project name
  // Remove model/prompts from location state - we fetch results directly
  // const { prompts, model } = location.state || { prompts: [], model: null }; 
  
  const [results, setResults] = useState([]); // Store fetched results metadata
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedResults, setSelectedResults] = useState([]); // State for selected results
  const [downloading, setDownloading] = useState({}); // State for individual downloads

  const getToken = () => localStorage.getItem('token');

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    const fetchData = async () => { // Renamed function
      setIsLoading(true);
      setError(null);
      const token = getToken();
      if (!token) {
        navigate('/login');
        return;
      }
      
      try {
        console.log(`[ResultsPage] Fetching data for projectId: ${projectId}`);
        // Fetch project details and results in parallel
        const [projectDetailsRes, resultsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/projects/${projectId}`, { // Fetch project details
             headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API_BASE_URL}/api/projects/${projectId}/results`, {
             headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        
        console.log('[ResultsPage] Received project details:', projectDetailsRes.data);
        console.log('[ResultsPage] Received results:', resultsRes.data);

        setProjectName(projectDetailsRes.data.name || 'Untitled Project'); // Set project name
        
        const initialResults = resultsRes.data.map(r => ({ ...r, isFavorite: r.isFavorite || false }));
        setResults(initialResults); 

      } catch (err) {
         console.error('[ResultsPage] Error fetching data:', err);
         setError(err.response?.data?.message || 'Failed to load project data or results.');
         if (err.response?.status === 401 || err.response?.status === 403) {
           navigate('/login');
         }
      } finally {
         setIsLoading(false);
      }
    };

    fetchData(); // Call the renamed function
  }, [projectId, navigate]);

  // --- Handler for Save/Favorite Button --- 
  const handleSaveResult = async (resultId, currentIsFavorite) => {
    const newIsFavorite = !currentIsFavorite;
    
    // Optimistic UI Update
    setResults(prevResults => 
      prevResults.map(r => r.id === resultId ? { ...r, isFavorite: newIsFavorite } : r)
    );
    setError(null); // Clear previous errors related to saving

    try {
      const token = getToken();
      await axios.put(
        `${API_BASE_URL}/api/projects/${projectId}/results/${resultId}`,
        { isFavorite: newIsFavorite }, // Send the new favorite status
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`[handleSaveResult] Toggled favorite for result ${resultId} to ${newIsFavorite}`);
      // Backend confirms, state is already updated optimistically

    } catch (err) {
      console.error('[handleSaveResult] Error updating favorite status:', err);
      setError(`Failed to save favorite status for result ${resultId}.`);
      // Revert optimistic update on error
      setResults(prevResults => 
        prevResults.map(r => r.id === resultId ? { ...r, isFavorite: currentIsFavorite } : r)
      );
    }
  };

  // --- Handler for Select Button --- 
  const handleSelectResult = (resultId) => {
      setSelectedResults(prevSelected => {
          if (prevSelected.includes(resultId)) {
              return prevSelected.filter(id => id !== resultId);
          } else {
              return [...prevSelected, resultId];
          }
      });
  };
  
  // --- Handler for Individual Download Button --- 
  const handleDownloadResult = async (imageUrl, resultId) => {
    const token = getToken();
    if (!token) {
      setError('Authentication error. Please log in again.');
      navigate('/login');
      return;
    }
    setError(null);
    setDownloading(prev => ({ ...prev, [resultId]: true })); // Set loading for this specific button

    const fullImageUrl = `${API_BASE_URL}${imageUrl}`;
    console.log(`[Download] Fetching image: ${fullImageUrl}`);

    try {
      const response = await fetch(fullImageUrl, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}` 
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const filename = `${resultId}.png`; // Or derive from originalName if stored

      // Create link and trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Clean up
      window.URL.revokeObjectURL(url);
      a.remove();
      console.log(`[Download] Triggered download for ${filename}`);

    } catch (err) {
      console.error('[Download] Error:', err);
      setError(`Failed to download image ${resultId}. ${err.message}`);
    } finally {
      setDownloading(prev => ({ ...prev, [resultId]: false })); // Clear loading for this button
    }
  };
  
  // --- Handler for Export All Button --- 
  const handleExportAll = async () => {
      const token = getToken();
      if (!token) {
          setError('Authentication error. Please log in again.');
          navigate('/login');
          return;
      }
      setError(null); // Clear previous errors
      
      const exportUrl = `${API_BASE_URL}/api/projects/${projectId}/export`;
      console.log('Requesting export from URL:', exportUrl);

      try {
          const response = await fetch(exportUrl, { 
              method: 'GET', // Explicitly state method
              headers: { 
                  'Authorization': `Bearer ${token}`
                  // Content-Type is not needed for GET
               } 
           });

          if (!response.ok) { 
               // Try to get error message from backend if it sent JSON
               let errorMsg = `Export failed: ${response.status} ${response.statusText}`;
               try {
                   const errorData = await response.json();
                   errorMsg = errorData.message || errorMsg;
               } catch (jsonError) {
                    // Ignore if response wasn't JSON
               }
               throw new Error(errorMsg); 
           }
          
          // Get filename from Content-Disposition header
          const disposition = response.headers.get('content-disposition');
          let filename = `project_${projectName}_results.zip`; // Default filename
          if (disposition && disposition.includes('attachment')) {
              const filenameMatch = disposition.match(/filename="?([^;"]+)"?/i);
              if (filenameMatch && filenameMatch[1]) {
                  filename = filenameMatch[1];
              }
          }
          
          const blob = await response.blob(); 

          // Create a link and click it to trigger download
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = filename; 
          document.body.appendChild(a);
          a.click();
          
          // Clean up
          window.URL.revokeObjectURL(url);
          a.remove();
          console.log('Export download triggered for:', filename);

      } catch (err) {
          console.error('Export error:', err);
          setError('Failed to export project results. ' + err.message);
      }
  };

  // Display logic based on fetched results
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading results...</div>;
  }

  if (error) {
     return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <p className="text-red-600 text-xl mb-4">Error loading results:</p>
        <p className="text-red-500 bg-red-100 p-3 rounded mb-4">{error}</p>
        <Link to={`/dashboard`} className="text-blue-600 hover:underline">
          Go back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Generated Results</h1>
      <p className="text-xl text-gray-600 mb-6">For Project: <span className="font-semibold">{projectName}</span> (ID: {projectId})</p>

      {/* Display error if any */}
       {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
             <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-700">X</button>
          </div>
        )}

      {results.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500">No results found for this project yet.</p>
            <p className="mt-2">
              <Link to={`/prompts/${projectId}`} className="text-blue-600 hover:underline">
                 Go back to generate images &rarr;
              </Link>
            </p>
           </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map(result => {
              const isSelected = selectedResults.includes(result.id);
              return (
                <div 
                    key={result.id} 
                    className={`bg-white rounded-lg shadow-md overflow-hidden flex flex-col border-2 ${isSelected ? 'border-blue-500' : 'border-transparent'}`}>
                  {/* Use result.imageUrl which points to the backend-served image */}
                  <img src={`${API_BASE_URL}${result.imageUrl}`} 
                       alt={result.prompt}
                       className="w-full h-64 object-cover bg-gray-200" // Added bg color
                       onError={(e) => { e.target.style.display = 'none'; /* Hide if image fails */ }} />
                  <div className="p-3 flex flex-col flex-grow">
                    <p className="text-xs text-gray-500 mb-1">Model: {result.modelIdUsed}</p>
                    <p className="text-sm text-gray-700 truncate flex-grow" title={result.prompt}>{result.prompt}</p>
                    
                    <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center space-x-2">
                        {/* Left side buttons: Select, Save */}
                        <div className="flex space-x-2">
                            <button 
                                onClick={() => handleSelectResult(result.id)}
                                title={isSelected ? "Deselect" : "Select"}
                                className={`text-xs px-2 py-1 rounded ${isSelected 
                                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                               {isSelected ? 'Selected' : 'Select'}
                            </button>
                        </div>
                        {/* Right side button: Download - Changed to button */}
                        <button 
                           onClick={() => handleDownloadResult(result.imageUrl, result.id)}
                           disabled={downloading[result.id]} // Disable while downloading this specific image
                           className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 text-gray-700 disabled:opacity-50">
                           {downloading[result.id] ? 'Downloading...' : 'Download'}
                        </button>
                    </div>
                  </div>
                </div>
              );
          })}
        </div>
      )}
      
      {/* Update bulk actions */}
      {results.length > 0 && (
          <div className="mt-8 text-center">
            <button 
              onClick={handleExportAll}
              className="px-6 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              Export All Results (.zip)
            </button>
          </div>
      )}

      <div className="mt-6 text-center">
          <Link to={`/prompts/${projectId}`} className="text-blue-600 hover:underline">
            &larr; Back to Prompts
          </Link>
        </div>
    </div>
  );
};

export default Results; 